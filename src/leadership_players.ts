import {leadershipEsc,leadershipHeader,leadershipShellCss} from "./leadership_shell";
import {playerActor,playerPermitted,playerRedirect,playerSameOrigin,type PlayerActor} from "./player_access";
import {formatPlayerBirthday,getPlayerMaxBaseLevel,readPlayerProfileForm} from "./player_profile_fields";
import {auditPlayer,loadStoredPlayer,recordPlayerRankChange,type StoredPlayer} from "./player_store";

interface Env { DB:D1Database; APP_URL:string }

type PlayerListRow=StoredPlayer&{account_id:number|null;discord_username:string|null};

const html=(body:string,status=200)=>new Response(body,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});
const pageCss=`<style>*{box-sizing:border-box}html{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,#090e18 100%);color:#eef3ff}h1,h2,p{margin-top:0}.pagehead{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:22px}.pagehead h1{margin:0 0 5px;font-size:1.7rem}.pagehead p,.hint,.meta{color:#90a0bb}.button,button{border:0;border-radius:10px;padding:11px 15px;background:#5865f2;color:#fff;text-decoration:none;font:inherit;font-weight:800;cursor:pointer}.button.secondary,button.secondary{background:#26344d;color:#e8eef9}.button.danger,button.danger{background:#6b2935}.tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px}.tabs a{padding:8px 11px;border:1px solid #34445f;border-radius:999px;color:#aebddd;text-decoration:none;font-size:.84rem;font-weight:800}.tabs a.active{background:#26344d;color:#fff}.players{display:grid;gap:10px}.playerrow{display:flex;align-items:center;gap:16px;padding:15px 16px;border:1px solid #2b3850;border-radius:13px;background:#10192a;text-decoration:none;color:inherit}.playerrow:hover{border-color:#425572}.pname{font-weight:850}.meta{font-size:.84rem;margin-top:4px}.grow{flex:1}.status{font-size:.74rem;font-weight:850;padding:5px 8px;border-radius:999px;background:#1e3145;color:#b9cbe5}.status.login{background:#18392d;color:#9ce0bd}.empty{padding:28px;border:1px dashed #34445f;border-radius:13px;color:#90a0bb;text-align:center}.formcard{border:1px solid #2b3850;border-radius:14px;background:#10192a;padding:20px}.fieldgrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.fieldgrid>div{min-width:0}label{display:block;margin-bottom:7px;font-size:.82rem;font-weight:800;color:#cbd6e8}input,select{width:100%;border:1px solid #34445f;border-radius:10px;background:#0d1524;color:#eef3ff;padding:11px 12px;font:inherit}.hint{font-size:.76rem;margin-top:6px}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:20px}.notice{padding:12px 14px;margin-bottom:16px;border:1px solid #315d4b;border-radius:10px;background:#112c23;color:#a9dec7}.warning{padding:12px 14px;margin-bottom:16px;border:1px solid #67404a;border-radius:10px;background:#2c1720;color:#e3b8c2}@media(max-width:650px){.pagehead{align-items:flex-start;flex-direction:column}.fieldgrid{grid-template-columns:1fr}.playerrow{align-items:flex-start}.status{white-space:nowrap}}</style>`;

const shell=async(request:Request,env:Env,title:string,content:string)=>{const head=await leadershipHeader(request,env);return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${leadershipEsc(title)}</title>${pageCss}${leadershipShellCss(head.accent,head.icon)}</head><body><main>${head.html}${content}</main></body></html>`)};

const requireActor=async(request:Request,env:Env)=>{const actor=await playerActor(request,env);return actor};

const listPlayers=async(request:Request,env:Env,actor:PlayerActor)=>{
  if(!await playerPermitted(env,actor,"players.edit")&&!await playerPermitted(env,actor,"players.manage_membership"))return html("Forbidden",403);
  const show=new URL(request.url).searchParams.get("show")==="inactive"?"inactive":"active";
  const rows=await env.DB.prepare(`SELECT p.id,p.display_name,p.rank,p.base_level,p.is_active,p.joined_at,p.left_at,p.birthday_month,p.birthday_day,a.id AS account_id,ai.provider_username AS discord_username FROM players p LEFT JOIN accounts a ON a.player_id=p.id AND a.is_active=1 AND a.approval_status='active' LEFT JOIN account_identities ai ON ai.account_id=a.id AND ai.provider='discord' WHERE p.is_active=? ORDER BY p.display_name COLLATE NOCASE`).bind(show==="active"?1:0).all<PlayerListRow>();
  const canAdd=await playerPermitted(env,actor,"players.manage_membership");
  const cards=(rows.results??[]).map(p=>`<a class="playerrow" href="/leadership/players/${p.id}"><div class="grow"><div class="pname">${leadershipEsc(p.display_name)}</div><div class="meta">Player ID ${p.id} · R${p.rank}${p.base_level?` · Base ${p.base_level}`:""}${p.discord_username?` · Discord ${leadershipEsc(p.discord_username)}`:""}</div></div>${p.account_id?'<span class="status login">Login Active</span>':show==="inactive"?'<span class="status">Former Member</span>':''}</a>`).join("");
  return shell(request,env,"Players",`<div class="pagehead"><div><h1>Players</h1><p>Roster, profiles, birthdays, rank history and platform access.</p></div>${canAdd?'<a class="button" href="/leadership/players/new">Add Player</a>':''}</div><div class="tabs"><a class="${show==="active"?'active':''}" href="/leadership/players">Active Players</a><a class="${show==="inactive"?'active':''}" href="/leadership/players?show=inactive">Former Players</a></div><div class="players">${cards||'<div class="empty">No players to show.</div>'}</div>`);
};

const playerForm=async(request:Request,env:Env,actor:PlayerActor,player:StoredPlayer|null)=>{
  const isNew=!player;
  const permission=isNew?"players.manage_membership":"players.edit";
  if(!await playerPermitted(env,actor,permission))return html("Forbidden",403);
  const max=await getPlayerMaxBaseLevel(env);
  const rank=player?.rank??1;
  const base=player?.base_level??null;
  const birthday=formatPlayerBirthday(player?.birthday_day,player?.birthday_month);
  const ranks=Array.from({length:5},(_,i)=>i+1).map(n=>`<option value="${n}"${n===rank?' selected':''}>R${n}</option>`).join("");
  const levels=['<option value="">Not set</option>',...Array.from({length:max},(_,i)=>i+1).map(n=>`<option value="${n}"${n===base?' selected':''}>${n}</option>`)].join("");
  const saved=new URL(request.url).searchParams.get("saved")==="1"?'<div class="notice">Player changes saved.</div>':"";
  const error=new URL(request.url).searchParams.get("error")?'<div class="warning">Please check the player details and try again.</div>':"";
  const title=isNew?"Add Player":`Edit ${player!.display_name}`;
  const action=isNew?"/leadership/players/create":`/leadership/players/${player!.id}/update`;
  const membership=!isNew?`<div><label>Joined</label><input name="joined_at" type="date" value="${leadershipEsc(player!.joined_at??"")}"></div><div><label>Left</label><input name="left_at" type="date" value="${leadershipEsc(player!.left_at??"")}"><div class="hint">Use “Move to former members” below for normal departures.</div></div>`:`<div><label>Joined</label><input name="joined_at" type="date"></div><div></div>`;
  const formerAction=!isNew?(player!.is_active?`<form method="post" action="/leadership/players/${player!.id}/deactivate"><button class="danger" type="submit">Move to former members</button></form>`:`<form method="post" action="/leadership/players/${player!.id}/reactivate"><button class="secondary" type="submit">Return to active roster</button></form>`):"";
  return shell(request,env,title,`${saved}${error}<div class="pagehead"><div><h1>${leadershipEsc(title)}</h1><p>${isNew?'Create a permanent player identity.':'Player ID '+player!.id}</p></div><a class="button secondary" href="/leadership/players${player&&!player.is_active?'?show=inactive':''}">← Players</a></div><div class="formcard"><form method="post" action="${action}"><div class="fieldgrid"><div><label>Player name</label><input name="display_name" maxlength="80" required value="${leadershipEsc(player?.display_name??"")}"></div><div><label>Rank</label><select name="rank">${ranks}</select></div><div><label>Base Level</label><select name="base_level">${levels}</select></div><div><label>Birthday</label><input name="birthday" type="text" inputmode="numeric" maxlength="5" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])" value="${birthday}"><div class="hint">Day and month only · DD/MM</div></div>${membership}</div><div class="actions"><button type="submit">Save changes</button><a class="button secondary" href="/leadership/players">Cancel</a></div></form>${formerAction?`<div class="actions">${formerAction}</div>`:""}</div>`);
};

const createPlayer=async(request:Request,env:Env,actor:PlayerActor)=>{
  if(!await playerPermitted(env,actor,"players.manage_membership"))return html("Forbidden",403);
  if(!playerSameOrigin(request,env))return html("Forbidden",403);
  const v=await readPlayerProfileForm(request,env);
  if(!v.valid)return playerRedirect("/leadership/players/new?error=invalid",request);
  if(v.rank===5&&!await playerPermitted(env,actor,"players.manage_protected_rank"))return html("Protected R5 rank requires explicit permission",403);
  try{
    const out=await env.DB.prepare("INSERT INTO players (display_name,rank,base_level,is_active,joined_at,left_at,birthday_month,birthday_day) VALUES (?,?,?,?,?,?,?,?)").bind(v.name,v.rank,v.base,v.left?0:1,v.joined,v.left,v.birthdayMonth,v.birthdayDay).run();
    const id=Number(out.meta.last_row_id);
    await recordPlayerRankChange(env,actor,id,null,v.rank,"Player created");
    await auditPlayer(env,actor,"player.created",id,{display_name:v.name,rank:v.rank,base_level:v.base,birthday_month:v.birthdayMonth,birthday_day:v.birthdayDay});
    return playerRedirect(`/leadership/players/${id}?saved=1`,request);
  }catch{return playerRedirect("/leadership/players/new?error=duplicate",request)}
};

const updatePlayer=async(request:Request,env:Env,actor:PlayerActor,id:number)=>{
  if(!await playerPermitted(env,actor,"players.edit"))return html("Forbidden",403);
  if(!playerSameOrigin(request,env))return html("Forbidden",403);
  const old=await loadStoredPlayer(env,id);if(!old)return html("Not found",404);
  const v=await readPlayerProfileForm(request,env);if(!v.valid)return playerRedirect(`/leadership/players/${id}?error=invalid`,request);
  if(v.rank!==old.rank&&(v.rank===5||old.rank===5)&&!await playerPermitted(env,actor,"players.manage_protected_rank"))return html("Protected R5 rank requires explicit permission",403);
  try{
    await env.DB.prepare("UPDATE players SET display_name=?,rank=?,base_level=?,joined_at=?,birthday_month=?,birthday_day=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(v.name,v.rank,v.base,v.joined,v.birthdayMonth,v.birthdayDay,id).run();
    if(v.rank!==old.rank)await recordPlayerRankChange(env,actor,id,old.rank,v.rank,"Rank changed in player profile");
    await auditPlayer(env,actor,"player.updated",id,{display_name:v.name,rank:v.rank,base_level:v.base,joined_at:v.joined,birthday_month:v.birthdayMonth,birthday_day:v.birthdayDay},{display_name:old.display_name,rank:old.rank,base_level:old.base_level,joined_at:old.joined_at,birthday_month:old.birthday_month,birthday_day:old.birthday_day});
    return playerRedirect(`/leadership/players/${id}?saved=1`,request);
  }catch{return playerRedirect(`/leadership/players/${id}?error=duplicate`,request)}
};

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const actor=await requireActor(request,env);if(!actor)return playerRedirect("/login",request);
  const url=new URL(request.url),path=url.pathname;
  if(request.method==="GET"&&path==="/leadership/players")return listPlayers(request,env,actor);
  if(request.method==="GET"&&path==="/leadership/players/new")return playerForm(request,env,actor,null);
  const edit=path.match(/^\/leadership\/players\/(\d+)$/);if(request.method==="GET"&&edit){const player=await loadStoredPlayer(env,Number(edit[1]));return player?playerForm(request,env,actor,player):html("Not found",404)}
  if(request.method==="POST"&&path==="/leadership/players/create")return createPlayer(request,env,actor);
  const update=path.match(/^\/leadership\/players\/(\d+)\/update$/);if(request.method==="POST"&&update)return updatePlayer(request,env,actor,Number(update[1]));
  return html("Not found",404);
}} satisfies ExportedHandler<Env>;
