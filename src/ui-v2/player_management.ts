import {playerActor,playerSameOrigin} from "../player_access";
import {deactivatePlayerMembership,disconnectPlayerLogin,reactivatePlayerMembership,setPlayerLoginAccess} from "../player_membership";
import {formatPlayerBirthday,getPlayerMaxBaseLevel,readPlayerProfileForm} from "../player_profile_fields";
import {loadStoredPlayer} from "../player_store";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type RankRow={rank_level:number;display_name:string;colour:string};
type PendingAccount={id:number;display_name:string;provider_username:string|null};
type AvailablePlayer={id:number;display_name:string;rank:number;rank_name:string|null;rank_colour:string|null};
type LinkedAccount={id:number;display_name:string;provider_username:string|null;is_active:number;is_owner:number;approval_status:string};
type RankHistory={old_rank:number|null;new_rank:number;changed_at:string;note:string|null};
type PrivateNote={id:number;note:string;created_at:string;updated_at:string;created_by:string|null;updated_by:string|null};
type PlayerPerformance={total_strength:number|null;squad_1_power:number|null;total_hero_power:number|null};
type RosterSnapshot=PlayerPerformance&{recorded_at:string;source:string};

const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const validId=(value:string)=>/^\d+$/.test(value)&&Number(value)>0;
const auditStatement=(env:UiV2Env,context:UiV2Context,action:string,entityType:string,entityId:string,oldValues:unknown,newValues:unknown,metadata:unknown={})=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,entityType,entityId,"ui-v2-players",JSON.stringify(oldValues),JSON.stringify(newValues),JSON.stringify(metadata));

const managementCss=`<style>
.manage-return{margin-bottom:18px}.manage-notice{margin-bottom:17px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.8rem;font-weight:800}.manage-notice.error{border-color:color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger)}.manage-card{padding:21px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.manage-card h2{margin:0 0 6px;font-size:1.05rem}.manage-card>p{margin:0 0 18px;color:var(--ui-muted);font-size:.8rem;line-height:1.5}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:block;min-width:0}.field.full{grid-column:1/-1}.field>span{display:block;margin-bottom:6px;color:var(--ui-secondary);font-size:.74rem;font-weight:850}.field input,.field select{width:100%;min-width:0;max-width:100%;padding:11px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.field input[type=date]{display:block;-webkit-appearance:none;appearance:none;inline-size:100%;max-inline-size:100%}.field input[type=date]::-webkit-date-and-time-value{min-width:0;text-align:left}.field small{display:block;margin-top:6px;color:var(--ui-muted);font-size:.67rem;line-height:1.4}.form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.manage-button{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:900;text-decoration:none;cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease,box-shadow .15s ease}.manage-button.secondary{border:1px solid var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.manage-button.secondary:hover{border-color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 9%,var(--ui-surface-3));color:var(--ui-hover);box-shadow:0 0 16px color-mix(in srgb,var(--ui-hover) 10%,transparent)}.manage-button.danger{border:1px solid color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 10%,var(--ui-surface-3));color:var(--ui-danger)}.access-summary{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:14px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--ui-warning) 48%,var(--ui-line));border-radius:13px;background:color-mix(in srgb,var(--ui-warning) 8%,var(--ui-surface-2))}.access-summary strong{color:var(--ui-warning);font-size:1.2rem}.access-summary span{color:var(--ui-muted);font-size:.78rem}.access-list{display:grid;gap:10px}.access-card{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(330px,1.5fr) auto;gap:12px;align-items:end;padding:16px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.access-person strong,.access-person span{display:block}.access-person strong{font-size:.92rem}.access-person span{margin-top:4px;color:var(--ui-muted);font-size:.7rem}.access-approve{display:grid;grid-template-columns:minmax(190px,1fr) auto;gap:8px;align-items:end}.access-approve label{margin:0}.empty-access{padding:28px;border:1px dashed var(--ui-line-strong);border-radius:13px;color:var(--ui-muted);text-align:center}@media(max-width:820px){.access-card{grid-template-columns:1fr}.access-approve{grid-template-columns:1fr auto}}@media(max-width:600px){.field-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.form-actions{display:grid;grid-template-columns:1fr}.access-approve{grid-template-columns:1fr}.manage-button{width:100%}.manage-return{width:auto}}
</style>`;

const profileCss=`<style>
.profile-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(285px,.55fr);gap:14px;align-items:start}.profile-stack{display:grid;gap:14px}.profile-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.profile-heading h2{margin:0}.member-badge{padding:6px 9px;border-radius:999px;background:color-mix(in srgb,var(--ui-success) 11%,var(--ui-surface-3));color:var(--ui-success);font-size:.68rem;font-weight:900}.member-badge.former{background:color-mix(in srgb,var(--ui-danger) 11%,var(--ui-surface-3));color:var(--ui-danger)}.performance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:17px 0}.performance-stat{min-width:0;padding:15px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-3)}.performance-stat span,.performance-stat strong,.performance-stat small{display:block}.performance-stat span{color:var(--ui-secondary);font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.performance-stat strong{margin-top:7px;color:var(--ui-text);font-size:1.2rem}.performance-stat small{margin-top:4px;color:var(--ui-muted);font-size:.65rem}.performance-editor{margin:0 0 17px;padding:15px;border:1px solid var(--ui-line);border-radius:12px;background:color-mix(in srgb,var(--ui-secondary) 4%,var(--ui-surface-3))}.performance-editor h3{margin:0 0 5px;font-size:.86rem}.performance-editor>p{margin:0 0 13px;color:var(--ui-muted);font-size:.7rem;line-height:1.45}.performance-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.performance-fields .field input{background:var(--ui-surface-2)}.performance-editor .form-actions{margin-top:13px}.snapshot-wrap{overflow:auto;border:1px solid var(--ui-line);border-radius:12px}.snapshot-table{width:100%;min-width:570px;border-collapse:collapse}.snapshot-table th,.snapshot-table td{padding:10px 12px;border-bottom:1px solid var(--ui-line);font-size:.7rem;text-align:right;white-space:nowrap}.snapshot-table th:first-child,.snapshot-table td:first-child{text-align:left}.snapshot-table th{color:var(--ui-muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.05em}.snapshot-table tr:last-child td{border-bottom:0}.snapshot-source{display:block;margin-top:3px;color:var(--ui-muted);font-size:.6rem}.account-panel{padding:14px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-3)}.account-panel strong,.account-panel span{display:block}.account-panel strong{font-size:.86rem}.account-panel span{margin-top:5px;color:var(--ui-muted);font-size:.72rem;line-height:1.45}.account-panel .linked{color:var(--ui-success)}.account-panel .disabled{color:var(--ui-danger)}.account-actions{display:grid;gap:8px;margin-top:12px}.account-actions.membership-note{display:block;margin-top:12px}.account-actions .manage-button{width:100%}.history-list{display:grid;gap:8px}.history-row{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px solid var(--ui-line)}.history-row:last-child{border-bottom:0}.history-row strong{font-size:.78rem}.history-row span{color:var(--ui-muted);font-size:.68rem;text-align:right}.profile-empty{color:var(--ui-muted);font-size:.76rem}.membership-actions{display:grid;gap:10px}.membership-note{margin:0;color:var(--ui-muted);font-size:.72rem;line-height:1.5}.notes-list{display:grid;gap:10px;margin-top:16px}.note-item{padding:13px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-3)}.note-item textarea,.note-new textarea{width:100%;min-height:88px;resize:vertical;padding:10px 11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-2);color:var(--ui-text);font:inherit;font-size:.78rem;line-height:1.5}.note-meta{margin:7px 0 0;color:var(--ui-muted);font-size:.65rem}.note-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.note-new{margin-top:16px}.note-new .manage-button{margin-top:9px}@media(max-width:1100px){.profile-layout{grid-template-columns:1fr}.profile-layout .date-field{grid-column:1/-1}}@media(max-width:700px){.performance-fields{grid-template-columns:1fr}}@media(max-width:600px){.profile-heading{align-items:flex-start}.performance-grid{grid-template-columns:1fr}.history-row{display:block}.history-row span{margin-top:5px;text-align:left}.note-actions{display:grid;grid-template-columns:1fr}}
</style>`;

function rankOption(rank:RankRow,selected?:number){
  const title=rank.display_name.trim();
  return `<option value="${rank.rank_level}"${rank.rank_level===selected?" selected":""}>R${rank.rank_level}${title.toLowerCase()!==`r${rank.rank_level}`?` · ${esc(title)}`:""}</option>`;
}

async function addPage(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageMembership)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Add Player",description:"You do not have permission to add players.",body:"",activePath:"/ui-v2/players"}),403);
  const [ranks,maxBase]=await Promise.all([
    env.DB.prepare("SELECT rank_level,display_name,colour FROM alliance_ranks ORDER BY rank_level").all<RankRow>(),
    getPlayerMaxBaseLevel(env)
  ]);
  const error=new URL(request.url).searchParams.get("error");
  const notice=error?`<div class="manage-notice error">${error==="duplicate"?"An active player already uses that name.":"Check the player details and try again."}</div>`:"";
  const body=`${managementCss}<a class="manage-button secondary manage-return" href="/ui-v2/players">← Players</a>${notice}<section class="manage-card"><h2>Player identity</h2><p>Create the permanent player record first. Discord access can be matched to it later without relying on the player’s current name.</p><form method="post" action="/ui-v2/players/new"><div class="field-grid"><label class="field full"><span>Player name</span><input name="display_name" maxlength="80" autocomplete="off" required></label><label class="field"><span>Rank</span><select name="rank" required>${(ranks.results??[]).map(rankOption).join("")}</select></label><label class="field"><span>Base level</span><input name="base_level" type="number" inputmode="numeric" min="1" max="${maxBase}" placeholder="Not set"><small>Current platform maximum: ${maxBase}</small></label><label class="field"><span>Joined</span><input name="joined_at" type="date"></label><label class="field"><span>Birthday</span><input name="birthday" inputmode="numeric" maxlength="5" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])"><small>Optional · day and month only</small></label></div><div class="form-actions"><a class="manage-button secondary" href="/ui-v2/players">Cancel</a><button class="manage-button" type="submit">Add player</button></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Add Player",description:"Add a new active member to the alliance roster.",body,activePath:"/ui-v2/players"}));
}

async function createPlayer(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const value=await readPlayerProfileForm(request,env);
  if(!value.valid||!validIsoDate(value.joined))return redirect(request,"/ui-v2/players/new?error=invalid");
  if(value.rank===5&&!context.user.canManageProtectedRank)return new Response("Protected R5 rank requires explicit permission",{status:403});
  try{
    const inserted=await env.DB.prepare("INSERT INTO players (display_name,rank,base_level,is_active,joined_at,left_at,birthday_month,birthday_day) VALUES (?,?,?,1,?,NULL,?,?)").bind(value.name,value.rank,value.base,value.joined,value.birthdayMonth,value.birthdayDay).run();
    const id=Number(inserted.meta.last_row_id);
    await env.DB.batch([
      env.DB.prepare("INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note) VALUES (?,NULL,?,?,?)").bind(id,value.rank,context.user.accountId,"Player created"),
      auditStatement(env,context,"player.created","player",String(id),null,{display_name:value.name,rank:value.rank,base_level:value.base,joined_at:value.joined,birthday_month:value.birthdayMonth,birthday_day:value.birthdayDay})
    ]);
    return redirect(request,`/ui-v2/players?created=${encodeURIComponent(value.name)}`);
  }catch{return redirect(request,"/ui-v2/players/new?error=duplicate")}
}

function playerLabel(player:AvailablePlayer){
  const title=player.rank_name?.trim();
  return `${player.display_name} · R${player.rank}${title&&title.toLowerCase()!==`r${player.rank}`?` · ${title}`:""}`;
}

async function accessPage(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canApproveAccounts)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Waiting Access",description:"You do not have permission to approve accounts.",body:"",activePath:"/ui-v2/players"}),403);
  const [pending,players]=await Promise.all([
    env.DB.prepare("SELECT a.id,a.display_name,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.approval_status='pending' AND a.is_active=1 AND a.is_owner=0 ORDER BY a.created_at").all<PendingAccount>(),
    env.DB.prepare("SELECT p.id,p.display_name,p.rank,r.display_name rank_name,r.colour rank_colour FROM players p LEFT JOIN alliance_ranks r ON r.rank_level=p.rank LEFT JOIN accounts a ON a.player_id=p.id WHERE p.is_active=1 AND a.id IS NULL ORDER BY p.display_name COLLATE NOCASE").all<AvailablePlayer>()
  ]);
  const rows=pending.results??[],available=players.results??[],url=new URL(request.url);
  const saved=url.searchParams.get("saved"),error=url.searchParams.get("error");
  const notice=saved?`<div class="manage-notice">${saved==="approved"?"Discord access approved and linked to the player.":"Access request rejected."}</div>`:error?`<div class="manage-notice error">${error==="linked"?"That player is already linked to another account.":"Choose an available active player and try again."}</div>`:"";
  const options=available.map(player=>`<option value="${player.id}">${esc(playerLabel(player))}</option>`).join("");
  const cards=rows.map(account=>`<article class="access-card"><div class="access-person"><strong>${esc(account.provider_username||account.display_name)}</strong><span>Discord sign-in waiting to be matched</span></div><form class="access-approve" method="post" action="/ui-v2/players/access/${account.id}/approve"><label class="field"><span>Match to player</span><select name="player_id" required><option value="">Choose player…</option>${options}</select></label><button class="manage-button" type="submit">Approve</button></form><form method="post" action="/ui-v2/players/access/${account.id}/reject" onsubmit="return confirm('Reject this access request?');"><button class="manage-button danger" type="submit">Reject</button></form></article>`).join("");
  const body=`${managementCss}<a class="manage-button secondary manage-return" href="/ui-v2/players">← Players</a>${notice}<div class="access-summary"><div><strong>${rows.length}</strong><span>${rows.length===1?"account is":"accounts are"} waiting for approval</span></div><span>${available.length} unlinked active ${available.length===1?"player":"players"} available</span></div><div class="access-list">${cards||'<div class="empty-access">No Discord accounts are waiting for access.</div>'}</div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Waiting Access",description:"Match each Discord sign-in to the correct active player before approving entry.",body,activePath:"/ui-v2/players"}));
}

async function approveAccount(request:Request,env:UiV2Env,context:UiV2Context,accountId:number){
  if(!context.user.canApproveAccounts||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),playerId=Number(form.get("player_id"));
  if(!Number.isInteger(playerId)||playerId<1)return redirect(request,"/ui-v2/players/access?error=player");
  const [account,player,used]=await Promise.all([
    env.DB.prepare("SELECT id,display_name,approval_status FROM accounts WHERE id=? AND approval_status='pending' AND is_active=1 AND is_owner=0").bind(accountId).first<{id:number;display_name:string;approval_status:string}>(),
    env.DB.prepare("SELECT id,display_name FROM players WHERE id=? AND is_active=1").bind(playerId).first<{id:number;display_name:string}>(),
    env.DB.prepare("SELECT id FROM accounts WHERE player_id=? AND id<>?").bind(playerId,accountId).first<{id:number}>()
  ]);
  if(!account||!player)return redirect(request,"/ui-v2/players/access?error=player");
  if(used)return redirect(request,"/ui-v2/players/access?error=linked");
  const group=await env.DB.prepare("SELECT id FROM permission_groups WHERE public_id='group-members' LIMIT 1").first<{id:number}>();
  const statements=[
    env.DB.prepare("UPDATE accounts SET player_id=?,display_name=?,approval_status='active',approved_at=CURRENT_TIMESTAMP,approved_by_account_id=?,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(playerId,player.display_name,context.user.accountId,accountId),
    auditStatement(env,context,"account.approved","account",String(accountId),{approval_status:account.approval_status,player_id:null},{approval_status:"active",player_id:playerId},{player_display_name:player.display_name})
  ];
  if(group)statements.splice(1,0,env.DB.prepare("INSERT OR IGNORE INTO account_groups (account_id,group_id,added_by_account_id) VALUES (?,?,?)").bind(accountId,group.id,context.user.accountId));
  await env.DB.batch(statements);
  return redirect(request,"/ui-v2/players/access?saved=approved");
}

async function rejectAccount(request:Request,env:UiV2Env,context:UiV2Context,accountId:number){
  if(!context.user.canApproveAccounts||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const account=await env.DB.prepare("SELECT id,approval_status FROM accounts WHERE id=? AND approval_status='pending' AND is_active=1 AND is_owner=0").bind(accountId).first<{id:number;approval_status:string}>();
  if(!account)return new Response("Account not found",{status:404});
  await env.DB.batch([
    env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE account_id=? AND revoked_at IS NULL").bind(accountId),
    env.DB.prepare("UPDATE accounts SET approval_status='rejected',rejected_at=CURRENT_TIMESTAMP,rejection_reason='Rejected by Leadership',is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(accountId),
    auditStatement(env,context,"account.rejected","account",String(accountId),{approval_status:account.approval_status},{approval_status:"rejected",is_active:0})
  ]);
  return redirect(request,"/ui-v2/players/access?saved=rejected");
}

function historyTime(value:string){
  const date=new Date(`${value.replace(" ","T")}Z`);
  if(Number.isNaN(date.getTime()))return value;
  return new Intl.DateTimeFormat("en-GB",{dateStyle:"medium",timeStyle:"short",timeZone:"Europe/London"}).format(date);
}

function compactPower(value:number|null){
  if(value===null)return "—";
  const absolute=Math.abs(value),unit=absolute>=1e9?[1e9,"B"]:absolute>=1e6?[1e6,"M"]:absolute>=1e3?[1e3,"K"]:null;
  if(!unit)return new Intl.NumberFormat("en-GB").format(value);
  return `${(value/(unit[0] as number)).toFixed(value%(unit[0] as number)===0?0:1)}${unit[1]}`;
}

const exactPower=(value:number|null)=>value===null?"Not uploaded":new Intl.NumberFormat("en-GB").format(value);

function parsePerformancePower(value:FormDataEntryValue|null){
  const text=String(value??"").trim();
  if(!text)return{valid:true,value:null};
  const match=text.replaceAll(",","").replace(/\s+/g,"").match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/i);
  if(!match)return{valid:false,value:null};
  const multiplier=!match[2]?1:match[2].toUpperCase()==="K"?1e3:match[2].toUpperCase()==="M"?1e6:1e9;
  const power=Math.round(Number(match[1])*multiplier);
  return{valid:Number.isSafeInteger(power)&&power>=0,value:power};
}

function validIsoDate(value:string|null){
  if(!value)return true;
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return false;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
  return date.getUTCFullYear()===Number(match[1])&&date.getUTCMonth()===Number(match[2])-1&&date.getUTCDate()===Number(match[3]);
}

async function playerPage(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManagePlayers)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Player Profile",description:"You do not have permission to view player management.",body:"",activePath:"/ui-v2/players"}),403);
  const [player,ranks,maxBase,linked,history,performance,snapshots]=await Promise.all([
    loadStoredPlayer(env,playerId),
    env.DB.prepare("SELECT rank_level,display_name,colour FROM alliance_ranks ORDER BY rank_level").all<RankRow>(),
    getPlayerMaxBaseLevel(env),
    env.DB.prepare("SELECT a.id,a.display_name,a.is_active,a.is_owner,a.approval_status,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.player_id=? LIMIT 1").bind(playerId).first<LinkedAccount>(),
    env.DB.prepare("SELECT old_rank,new_rank,changed_at,note FROM player_rank_history WHERE player_id=? ORDER BY changed_at DESC LIMIT 12").bind(playerId).all<RankHistory>(),
    env.DB.prepare("SELECT p.player_power total_strength,p.total_hero_power,(SELECT power FROM player_squads s WHERE s.player_id=p.id AND s.squad_number=1 LIMIT 1) squad_1_power FROM players p WHERE p.id=?").bind(playerId).first<PlayerPerformance>(),
    env.DB.prepare("SELECT total_strength,squad_1_power,total_hero_power,recorded_at,source FROM player_roster_snapshots WHERE player_id=? ORDER BY recorded_at DESC,id DESC LIMIT 8").bind(playerId).all<RosterSnapshot>()
  ]);
  if(!player)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Player not found",description:"That player record no longer exists.",body:`${managementCss}<a class="manage-button secondary manage-return" href="/ui-v2/players">← Players</a>`,activePath:"/ui-v2/players"}),404);
  const notes=context.user.canManagePrivateNotes
    ?await env.DB.prepare("SELECT n.id,n.note,n.created_at,n.updated_at,c.display_name created_by,u.display_name updated_by FROM player_private_notes n LEFT JOIN accounts c ON c.id=n.created_by_account_id LEFT JOIN accounts u ON u.id=n.updated_by_account_id WHERE n.player_id=? ORDER BY n.updated_at DESC").bind(playerId).all<PrivateNote>()
    :null;

  const url=new URL(request.url),saved=url.searchParams.get("saved"),error=url.searchParams.get("error");
  const notice=saved?`<div class="manage-notice">${saved==="deactivated"?"Player moved to Former Players.":saved==="reactivated"?"Player returned to the active roster.":saved==="disconnected"?"Discord access disconnected. The permanent player record and history were kept.":saved==="login-disabled"?"Login access disabled and active sessions revoked.":saved==="login-enabled"?"Login access enabled.":saved==="performance"?"Roster performance updated and added to the player’s history.":saved==="note-created"?"Private note added.":saved==="note-updated"?"Private note saved.":saved==="note-deleted"?"Private note deleted.":"Player details saved."}</div>`:error?`<div class="manage-notice error">${error==="duplicate"?"An active player already uses that name.":error==="note"?"Enter a note before saving.":error==="performance"?"Enter each power as a whole number or use K, M or B.":"Check the player details and try again."}</div>`:"";
  const rankRows=ranks.results??[],historyRows=history.results??[];
  const disabled=context.user.canEditPlayers?"":" disabled";
  const formActions=context.user.canEditPlayers?`<div class="form-actions"><a class="manage-button secondary" href="/ui-v2/players">Cancel</a><button class="manage-button" type="submit">Save changes</button></div>`:"";
  const leftField=player.is_active?"":`<label class="field date-field full"><span>Leaving date</span><input name="left_at" type="date" value="${player.left_at??""}"${disabled}><small>For historical correction only. Use Return to active roster to reactivate this player.</small></label>`;
  const details=`<section class="manage-card"><div class="profile-heading"><h2>Player details</h2><span class="member-badge${player.is_active?"":" former"}">${player.is_active?"Active member":"Former member"}</span></div><form method="post" action="/ui-v2/players/${player.id}/update"><div class="field-grid"><label class="field full"><span>Player name</span><input name="display_name" maxlength="80" autocomplete="off" required value="${esc(player.display_name)}"${disabled}></label><label class="field"><span>Rank</span><select name="rank" required${disabled}>${rankRows.map(rank=>rankOption(rank,player.rank)).join("")}</select></label><label class="field"><span>Base level</span><input name="base_level" type="number" inputmode="numeric" min="1" max="${maxBase}" value="${player.base_level??""}" placeholder="Not set"${disabled}><small>Current platform maximum: ${maxBase}</small></label><label class="field date-field"><span>Joined</span><input name="joined_at" type="date" value="${player.joined_at??""}"${disabled}></label><label class="field date-field"><span>Birthday</span><input name="birthday" inputmode="numeric" maxlength="5" value="${formatPlayerBirthday(player.birthday_day,player.birthday_month)}" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])"${disabled}><small>Optional · day and month only</small></label>${leftField}</div>${formActions}</form></section>`;
  const current=performance??{total_strength:null,squad_1_power:null,total_hero_power:null},snapshotRows=snapshots.results??[];
  const stat=(label:string,value:number|null)=>`<div class="performance-stat"><span>${esc(label)}</span><strong>${esc(compactPower(value))}</strong><small>${esc(exactPower(value))}</small></div>`;
  const snapshotMarkup=snapshotRows.map(row=>`<tr><td>${esc(historyTime(row.recorded_at))}<span class="snapshot-source">${row.source==="manual"?"Manual update":"Roster upload"}</span></td><td>${esc(compactPower(row.total_strength))}</td><td>${esc(compactPower(row.squad_1_power))}</td><td>${esc(compactPower(row.total_hero_power))}</td></tr>`).join("");
  const performanceEditor=context.user.canEditPlayers?`<form class="performance-editor" method="post" action="/ui-v2/players/${player.id}/performance"><h3>Update manually</h3><p>Add the figures as they become available. Commas and abbreviations such as 120M are accepted; leave a field blank to clear it.</p><div class="performance-fields"><label class="field"><span>Total Strength</span><input name="total_strength" inputmode="decimal" value="${current.total_strength??""}" placeholder="e.g. 120M"></label><label class="field"><span>Squad 1 Power</span><input name="squad_1_power" inputmode="decimal" value="${current.squad_1_power??""}" placeholder="Add later"></label><label class="field"><span>Total Hero Power</span><input name="total_hero_power" inputmode="decimal" value="${current.total_hero_power??""}" placeholder="Add later"></label></div><div class="form-actions"><button class="manage-button" type="submit">Save performance</button></div></form>`:"";
  const performanceCard=`<section class="manage-card"><h2>Roster Performance</h2><p>Figures can be entered manually as they become available or refreshed through a roster spreadsheet.</p><div class="performance-grid">${stat("Total Strength",current.total_strength)}${stat("Squad 1 Power",current.squad_1_power)}${stat("Total Hero Power",current.total_hero_power)}</div>${performanceEditor}${snapshotMarkup?`<div class="snapshot-wrap"><table class="snapshot-table"><thead><tr><th>Performance update</th><th>Total Strength</th><th>Squad 1</th><th>Hero Power</th></tr></thead><tbody>${snapshotMarkup}</tbody></table></div>`:'<div class="profile-empty">No performance history has been recorded yet.</div>'}</section>`;
  const accountState=linked?(linked.is_active&&linked.approval_status==="active"?"linked":"disabled"):"";
  const accountText=linked?`${linked.provider_username?`@${linked.provider_username}`:linked.display_name}${linked.is_owner?" · Owner":""}`:"No Discord account is linked to this player.";
  const accountControls:string[]=[];
  if(linked&&!linked.is_owner&&context.user.canManageAccounts)accountControls.push(linked.is_active?`<form method="post" action="/ui-v2/players/${player.id}/login-disable" onsubmit="return confirm('Disable this player’s login access and revoke their active sessions?');"><button class="manage-button secondary" type="submit">Disable Login</button></form>`:`<form method="post" action="/ui-v2/players/${player.id}/login-enable"><button class="manage-button" type="submit">Enable Login</button></form>`);
  if(linked&&!linked.is_owner&&context.user.canManageMembership)accountControls.push(`<form method="post" action="/ui-v2/players/${player.id}/disconnect" onsubmit="return confirm('Disconnect this Discord login? Their sessions and access groups will be removed, but the player record will be kept.');"><button class="manage-button danger" type="submit">Disconnect Discord</button></form>`);
  const accountActions=linked?.is_owner?`<p class="membership-note account-actions">The Owner’s Discord login is protected and cannot be changed here.</p>`:accountControls.length?`<div class="account-actions">${accountControls.join("")}</div>`:"";
  const account=`<section class="manage-card"><h2>Discord & account</h2><p>The login remains separate from the permanent player record.</p><div class="account-panel"><strong class="${accountState}">${linked?(accountState==="linked"?"Discord linked":"Account disabled"):"Not linked"}</strong><span>${esc(accountText)}</span>${accountActions}</div></section>`;
  const historyMarkup=historyRows.map(item=>`<div class="history-row"><strong>${item.old_rank?`R${item.old_rank} → `:""}R${item.new_rank}</strong><span>${esc(historyTime(item.changed_at))}${item.note?` · ${esc(item.note)}`:""}</span></div>`).join("");
  const historyCard=`<section class="manage-card"><h2>Rank history</h2><p>Promotions and rank changes remain attached to this player.</p><div class="history-list">${historyMarkup||'<div class="profile-empty">No rank changes have been recorded yet.</div>'}</div></section>`;
  const noteRows=(notes?.results??[]).map(item=>`<article class="note-item"><form method="post" action="/ui-v2/players/${player.id}/notes/${item.id}/update"><textarea name="note" maxlength="2000" required>${esc(item.note)}</textarea><p class="note-meta">${esc(item.updated_by||item.created_by||"Unknown")} · ${esc(historyTime(item.updated_at))}</p><div class="note-actions"><button class="manage-button secondary" type="submit">Save note</button></div></form><form class="note-actions" method="post" action="/ui-v2/players/${player.id}/notes/${item.id}/delete" onsubmit="return confirm('Delete this private note?');"><button class="manage-button danger" type="submit">Delete</button></form></article>`).join("");
  const notesCard=context.user.canManagePrivateNotes?`<section class="manage-card"><h2>Private Leadership Notes</h2><p>Only authorised Leadership members can view or change these notes.</p><form class="note-new" method="post" action="/ui-v2/players/${player.id}/notes"><textarea name="note" maxlength="2000" required placeholder="Add a private note about this player…"></textarea><button class="manage-button" type="submit">Add note</button></form><div class="notes-list">${noteRows||'<div class="profile-empty">No private notes have been added.</div>'}</div></section>`:"";
  const membership=context.user.canManageMembership?`<section class="manage-card"><h2>Membership</h2><p>${player.is_active?"Moving a player to Former Players preserves their record and history.":"Return this player to the active roster when they rejoin."}</p><div class="membership-actions">${player.is_active?`<form method="post" action="/ui-v2/players/${player.id}/deactivate" onsubmit="return confirm('Move this player to Former Players? A linked non-owner Discord login will be removed.');"><button class="manage-button danger" type="submit">Move to Former Players</button></form><p class="membership-note">A linked non-owner login is disconnected and must be approved again if the player returns.</p>`:`<form method="post" action="/ui-v2/players/${player.id}/reactivate"><button class="manage-button" type="submit">Return to active roster</button></form><p class="membership-note">Discord access is not restored automatically.</p>`}</div></section>`:"";
  const body=`${managementCss}${profileCss}<a class="manage-button secondary manage-return" href="/ui-v2/players">← Players</a>${notice}<div class="profile-layout"><div class="profile-stack">${details}${performanceCard}${historyCard}${notesCard}</div><aside class="profile-stack">${account}${membership}</aside></div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:`Player #${player.id}`,title:player.display_name,description:"Manage the player record, membership and linked account in one place.",body,activePath:"/ui-v2/players"}));
}

async function updatePlayer(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canEditPlayers||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const old=await loadStoredPlayer(env,playerId);
  if(!old)return new Response("Player not found",{status:404});
  const value=await readPlayerProfileForm(request,env);
  if(!value.valid||!validIsoDate(value.joined)||!validIsoDate(value.left))return redirect(request,`/ui-v2/players/${playerId}?error=invalid`);
  if(value.rank!==old.rank&&(value.rank===5||old.rank===5)&&!context.user.canManageProtectedRank)return new Response("Protected R5 rank requires explicit permission",{status:403});
  const leftAt=old.is_active?old.left_at:value.left;
  const oldValues={display_name:old.display_name,rank:old.rank,base_level:old.base_level,joined_at:old.joined_at,left_at:old.left_at,birthday_month:old.birthday_month,birthday_day:old.birthday_day};
  const newValues={display_name:value.name,rank:value.rank,base_level:value.base,joined_at:value.joined,left_at:leftAt,birthday_month:value.birthdayMonth,birthday_day:value.birthdayDay};
  try{
    const statements=[
      env.DB.prepare("UPDATE players SET display_name=?,rank=?,base_level=?,joined_at=?,left_at=?,birthday_month=?,birthday_day=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(value.name,value.rank,value.base,value.joined,leftAt,value.birthdayMonth,value.birthdayDay,playerId),
      auditStatement(env,context,"player.updated","player",String(playerId),oldValues,newValues)
    ];
    if(value.rank!==old.rank)statements.splice(1,0,env.DB.prepare("INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note) VALUES (?,?,?,?,?)").bind(playerId,old.rank,value.rank,context.user.accountId,"Rank changed in player profile"));
    await env.DB.batch(statements);
    return redirect(request,`/ui-v2/players/${playerId}?saved=1`);
  }catch{return redirect(request,`/ui-v2/players/${playerId}?error=duplicate`)}
}

async function updatePerformance(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canEditPlayers||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),strength=parsePerformancePower(form.get("total_strength")),squad=parsePerformancePower(form.get("squad_1_power")),heroes=parsePerformancePower(form.get("total_hero_power"));
  if(!strength.valid||!squad.valid||!heroes.valid)return redirect(request,`/ui-v2/players/${playerId}?error=performance`);
  const [player,old]=await Promise.all([
    loadStoredPlayer(env,playerId),
    env.DB.prepare("SELECT p.player_power total_strength,p.total_hero_power,(SELECT power FROM player_squads s WHERE s.player_id=p.id AND s.squad_number=1 LIMIT 1) squad_1_power FROM players p WHERE p.id=?").bind(playerId).first<PlayerPerformance>()
  ]);
  if(!player||!old)return new Response("Player not found",{status:404});
  const next={total_strength:strength.value,squad_1_power:squad.value,total_hero_power:heroes.value};
  const squadStatement=squad.value===null
    ?env.DB.prepare("DELETE FROM player_squads WHERE player_id=? AND squad_number=1").bind(playerId)
    :env.DB.prepare("INSERT INTO player_squads (player_id,squad_number,power) VALUES (?,1,?) ON CONFLICT(player_id,squad_number) DO UPDATE SET power=excluded.power,updated_at=CURRENT_TIMESTAMP").bind(playerId,squad.value);
  await env.DB.batch([
    env.DB.prepare("UPDATE players SET player_power=?,total_hero_power=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(strength.value,heroes.value,playerId),
    squadStatement,
    env.DB.prepare("INSERT INTO player_roster_snapshots (player_id,total_strength,squad_1_power,total_hero_power,recorded_by_account_id,source) VALUES (?,?,?,?,?,'manual')").bind(playerId,strength.value,squad.value,heroes.value,context.user.accountId),
    auditStatement(env,context,"player.performance_updated","player",String(playerId),old,next,{update_source:"manual"})
  ]);
  return redirect(request,`/ui-v2/players/${playerId}?saved=performance`);
}

async function changeMembership(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,action:"deactivate"|"reactivate"){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const actor=await playerActor(request,env);
  if(!actor)return redirect(request,"/login");
  const result=action==="deactivate"?await deactivatePlayerMembership(request,env,actor,playerId):await reactivatePlayerMembership(request,env,actor,playerId);
  return result??redirect(request,`/ui-v2/players/${playerId}?saved=${action}d`);
}

async function disconnectAccount(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const actor=await playerActor(request,env);
  if(!actor)return redirect(request,"/login");
  const result=await disconnectPlayerLogin(request,env,actor,playerId);
  return result??redirect(request,`/ui-v2/players/${playerId}?saved=disconnected`);
}

async function changeLoginAccess(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,enable:boolean){
  if(!context.user.canManageAccounts||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const actor=await playerActor(request,env);
  if(!actor)return redirect(request,"/login");
  const result=await setPlayerLoginAccess(request,env,actor,playerId,enable);
  return result??redirect(request,`/ui-v2/players/${playerId}?saved=login-${enable?"enabled":"disabled"}`);
}

async function createNote(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManagePrivateNotes||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  if(!await loadStoredPlayer(env,playerId))return new Response("Player not found",{status:404});
  const form=await request.formData(),note=String(form.get("note")||"").trim();
  if(!note||note.length>2000)return redirect(request,`/ui-v2/players/${playerId}?error=note`);
  const inserted=await env.DB.prepare("INSERT INTO player_private_notes (player_id,note,created_by_account_id,updated_by_account_id) VALUES (?,?,?,?)").bind(playerId,note,context.user.accountId,context.user.accountId).run();
  const noteId=String(inserted.meta.last_row_id);
  await auditStatement(env,context,"player.note_created","player_note",noteId,null,{player_id:playerId,note_length:note.length});
  return redirect(request,`/ui-v2/players/${playerId}?saved=note-created`);
}

async function updateNote(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,noteId:number){
  if(!context.user.canManagePrivateNotes||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const old=await env.DB.prepare("SELECT id,note FROM player_private_notes WHERE id=? AND player_id=?").bind(noteId,playerId).first<{id:number;note:string}>();
  if(!old)return new Response("Note not found",{status:404});
  const form=await request.formData(),note=String(form.get("note")||"").trim();
  if(!note||note.length>2000)return redirect(request,`/ui-v2/players/${playerId}?error=note`);
  await env.DB.batch([
    env.DB.prepare("UPDATE player_private_notes SET note=?,updated_by_account_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND player_id=?").bind(note,context.user.accountId,noteId,playerId),
    auditStatement(env,context,"player.note_updated","player_note",String(noteId),{player_id:playerId,note_length:old.note.length},{player_id:playerId,note_length:note.length})
  ]);
  return redirect(request,`/ui-v2/players/${playerId}?saved=note-updated`);
}

async function deleteNote(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,noteId:number){
  if(!context.user.canManagePrivateNotes||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const old=await env.DB.prepare("SELECT id,note FROM player_private_notes WHERE id=? AND player_id=?").bind(noteId,playerId).first<{id:number;note:string}>();
  if(!old)return new Response("Note not found",{status:404});
  await env.DB.batch([
    auditStatement(env,context,"player.note_deleted","player_note",String(noteId),{player_id:playerId,note_length:old.note.length},null),
    env.DB.prepare("DELETE FROM player_private_notes WHERE id=? AND player_id=?").bind(noteId,playerId)
  ]);
  return redirect(request,`/ui-v2/players/${playerId}?saved=note-deleted`);
}

export async function handleUiV2PlayerManagement(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(path==="/ui-v2/players/new")return request.method==="GET"?addPage(request,env,context):request.method==="POST"?createPlayer(request,env,context):new Response("Method not allowed",{status:405});
  if(path==="/ui-v2/players/access")return request.method==="GET"?accessPage(request,env,context):new Response("Method not allowed",{status:405});
  const action=path.match(/^\/ui-v2\/players\/access\/(\d+)\/(approve|reject)$/);
  if(request.method==="POST"&&action&&validId(action[1]))return action[2]==="approve"?approveAccount(request,env,context,Number(action[1])):rejectAccount(request,env,context,Number(action[1]));
  const noteAction=path.match(/^\/ui-v2\/players\/(\d+)\/notes\/(\d+)\/(update|delete)$/);
  if(request.method==="POST"&&noteAction&&validId(noteAction[1])&&validId(noteAction[2]))return noteAction[3]==="update"?updateNote(request,env,context,Number(noteAction[1]),Number(noteAction[2])):deleteNote(request,env,context,Number(noteAction[1]),Number(noteAction[2]));
  const profile=path.match(/^\/ui-v2\/players\/(\d+)(?:\/(update|performance|deactivate|reactivate|disconnect|login-enable|login-disable|notes))?$/);
  if(profile&&validId(profile[1])){
    const playerId=Number(profile[1]),profileAction=profile[2];
    if(!profileAction&&request.method==="GET")return playerPage(request,env,context,playerId);
    if(profileAction==="update"&&request.method==="POST")return updatePlayer(request,env,context,playerId);
    if(profileAction==="performance"&&request.method==="POST")return updatePerformance(request,env,context,playerId);
    if((profileAction==="deactivate"||profileAction==="reactivate")&&request.method==="POST")return changeMembership(request,env,context,playerId,profileAction);
    if(profileAction==="disconnect"&&request.method==="POST")return disconnectAccount(request,env,context,playerId);
    if((profileAction==="login-enable"||profileAction==="login-disable")&&request.method==="POST")return changeLoginAccess(request,env,context,playerId,profileAction==="login-enable");
    if(profileAction==="notes"&&request.method==="POST")return createNote(request,env,context,playerId);
    return new Response("Method not allowed",{status:405});
  }
  return null;
}
