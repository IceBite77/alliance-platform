import {playerActor,playerSameOrigin} from "../player_access";
import {deactivatePlayerMembership,disconnectPlayerLogin,reactivatePlayerMembership,setPlayerLoginAccess} from "../player_membership";
import {formatPlayerBirthday,getPlayerMaxBaseLevel,getPlayerMaxOverlordLevel,readPlayerProfileForm} from "../player_profile_fields";
import {loadStoredPlayer} from "../player_store";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type RankRow={rank_level:number;display_name:string;colour:string};
type PendingAccount={id:number;display_name:string;provider_username:string|null};
type AvailablePlayer={id:number;display_name:string;rank:number;rank_name:string|null;rank_colour:string|null};
type LinkedAccount={id:number;display_name:string;provider_username:string|null;is_active:number;is_owner:number;approval_status:string};
type RankHistory={old_rank:number|null;new_rank:number;changed_at:string;note:string|null};
type PrivateNote={id:number;note:string;created_at:string;updated_at:string;created_by:string|null;updated_by:string|null};
type PlayerPerformance={total_strength:number|null;total_hero_power:number|null};
type SquadLoadout={squad_number:number;power:number|null};
type TacticalDrone={level:number|null};
type OverlordLoadout={level:number|null;assigned_squad:number|null};
type RosterSnapshot=PlayerPerformance&{squad_1_power:number|null;squad_2_power:number|null;squad_3_power:number|null;squad_4_power:number|null;recorded_at:string;source:string};

const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const validId=(value:string)=>/^\d+$/.test(value)&&Number(value)>0;
const auditStatement=(env:UiV2Env,context:UiV2Context,action:string,entityType:string,entityId:string,oldValues:unknown,newValues:unknown,metadata:unknown={})=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,entityType,entityId,"ui-v2-players",JSON.stringify(oldValues),JSON.stringify(newValues),JSON.stringify(metadata));

const managementCss=`<style>
.manage-return{margin-bottom:18px}.manage-notice{margin-bottom:17px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.8rem;font-weight:800}.manage-notice.error{border-color:color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger)}.manage-card{padding:21px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.manage-card h2{margin:0 0 6px;font-size:1.05rem}.manage-card>p{margin:0 0 18px;color:var(--ui-muted);font-size:.8rem;line-height:1.5}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:block;min-width:0}.field.full{grid-column:1/-1}.field>span{display:block;margin-bottom:6px;color:var(--ui-secondary);font-size:.74rem;font-weight:850}.field input,.field select{width:100%;min-width:0;max-width:100%;padding:11px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.field input[type=date]{display:block;-webkit-appearance:none;appearance:none;inline-size:100%;max-inline-size:100%}.field input[type=date]::-webkit-date-and-time-value{min-width:0;text-align:left}.field small{display:block;margin-top:6px;color:var(--ui-muted);font-size:.67rem;line-height:1.4}.form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.manage-button{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:900;text-decoration:none;cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease,box-shadow .15s ease}.manage-button.secondary{border:1px solid var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.manage-button.secondary:hover{border-color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 9%,var(--ui-surface-3));color:var(--ui-hover);box-shadow:0 0 16px color-mix(in srgb,var(--ui-hover) 10%,transparent)}.manage-button.danger{border:1px solid color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 10%,var(--ui-surface-3));color:var(--ui-danger)}.access-summary{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:14px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--ui-warning) 48%,var(--ui-line));border-radius:13px;background:color-mix(in srgb,var(--ui-warning) 8%,var(--ui-surface-2))}.access-summary strong{color:var(--ui-warning);font-size:1.2rem}.access-summary span{color:var(--ui-muted);font-size:.78rem}.access-list{display:grid;gap:10px}.access-card{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(330px,1.5fr) auto;gap:12px;align-items:end;padding:16px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.access-person strong,.access-person span{display:block}.access-person strong{font-size:.92rem}.access-person span{margin-top:4px;color:var(--ui-muted);font-size:.7rem}.access-approve{display:grid;grid-template-columns:minmax(190px,1fr) auto;gap:8px;align-items:end}.access-approve label{margin:0}.empty-access{padding:28px;border:1px dashed var(--ui-line-strong);border-radius:13px;color:var(--ui-muted);text-align:center}@media(max-width:820px){.access-card{grid-template-columns:1fr}.access-approve{grid-template-columns:1fr auto}}@media(max-width:600px){.field-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.form-actions{display:grid;grid-template-columns:1fr}.access-approve{grid-template-columns:1fr}.manage-button{width:100%}.manage-return{width:auto}}
</style>`;

const profileCss=`<style>
.profile-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(285px,.55fr);gap:14px;align-items:start}.profile-stack{display:grid;gap:14px}.profile-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.profile-heading h2{margin:0}.member-badge{padding:6px 9px;border-radius:999px;background:color-mix(in srgb,var(--ui-success) 11%,var(--ui-surface-3));color:var(--ui-success);font-size:.68rem;font-weight:900}.member-badge.former{background:color-mix(in srgb,var(--ui-danger) 11%,var(--ui-surface-3));color:var(--ui-danger)}.performance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:17px 0}.performance-stat{min-width:0;padding:15px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-3)}.performance-stat span,.performance-stat strong,.performance-stat small{display:block}.performance-stat span{color:var(--ui-secondary);font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.05em}.performance-stat strong{margin-top:7px;color:var(--ui-text);font-size:1.2rem}.performance-stat small{margin-top:4px;color:var(--ui-muted);font-size:.65rem}.performance-editor{margin:0 0 17px;padding:15px;border:1px solid var(--ui-line);border-radius:12px;background:color-mix(in srgb,var(--ui-secondary) 4%,var(--ui-surface-3))}.performance-editor h3{margin:0 0 5px;font-size:.86rem}.performance-editor>p{margin:0 0 13px;color:var(--ui-muted);font-size:.7rem;line-height:1.45}.performance-fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.performance-fields .field input{background:var(--ui-surface-2)}.performance-editor .form-actions{margin-top:13px}.snapshot-wrap{overflow:auto;border:1px solid var(--ui-line);border-radius:12px}.snapshot-table{width:100%;min-width:570px;border-collapse:collapse}.snapshot-table th,.snapshot-table td{padding:10px 12px;border-bottom:1px solid var(--ui-line);font-size:.7rem;text-align:right;white-space:nowrap}.snapshot-table th:first-child,.snapshot-table td:first-child{text-align:left}.snapshot-table th{color:var(--ui-muted);font-size:.62rem;text-transform:uppercase;letter-spacing:.05em}.snapshot-table tr:last-child td{border-bottom:0}.snapshot-source{display:block;margin-top:3px;color:var(--ui-muted);font-size:.6rem}.account-panel{padding:14px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-3)}.account-panel strong,.account-panel span{display:block}.account-panel strong{font-size:.86rem}.account-panel span{margin-top:5px;color:var(--ui-muted);font-size:.72rem;line-height:1.45}.account-panel .linked{color:var(--ui-success)}.account-panel .disabled{color:var(--ui-danger)}.account-actions{display:grid;gap:8px;margin-top:12px}.account-actions.membership-note{display:block;margin-top:12px}.account-actions .manage-button{width:100%}.history-list{display:grid;gap:8px}.history-row{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px solid var(--ui-line)}.history-row:last-child{border-bottom:0}.history-row strong{font-size:.78rem}.history-row span{color:var(--ui-muted);font-size:.68rem;text-align:right}.profile-empty{color:var(--ui-muted);font-size:.76rem}.membership-actions{display:grid;gap:10px}.membership-note{margin:0;color:var(--ui-muted);font-size:.72rem;line-height:1.5}.notes-list{display:grid;gap:10px;margin-top:16px}.note-item{padding:13px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-3)}.note-item textarea,.note-new textarea{width:100%;min-height:88px;resize:vertical;padding:10px 11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-2);color:var(--ui-text);font:inherit;font-size:.78rem;line-height:1.5}.note-meta{margin:7px 0 0;color:var(--ui-muted);font-size:.65rem}.note-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:9px}.note-new{margin-top:16px}.note-new .manage-button{margin-top:9px}@media(max-width:1100px){.profile-layout{grid-template-columns:1fr}.profile-layout .date-field{grid-column:1/-1}}@media(max-width:700px){.performance-fields{grid-template-columns:1fr}}@media(max-width:600px){.profile-heading{align-items:flex-start}.performance-grid{grid-template-columns:1fr}.history-row{display:block}.history-row span{margin-top:5px;text-align:left}.note-actions{display:grid;grid-template-columns:1fr}}
</style>`;

const loadoutCss=`<style>
.performance-grid{grid-template-columns:repeat(auto-fit,minmax(135px,1fr))}.performance-totals{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.loadout-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}.loadout-card{padding:14px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-2)}.loadout-card h4{margin:0 0 11px;color:var(--ui-secondary);font-size:.76rem}.loadout-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.overlord-card{margin-top:10px}.overlord-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.performance-editor select{width:100%;min-width:0;padding:11px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-2);color:var(--ui-text)}@media(max-width:760px){.loadout-grid{grid-template-columns:1fr}.performance-totals,.overlord-fields{grid-template-columns:1fr}}@media(max-width:430px){.loadout-fields{grid-template-columns:1fr}}
</style>`;

const tabsCss=`<style>
.profile-tabs{min-width:0}.profile-tab-list{display:flex;align-items:flex-end;gap:5px;margin-bottom:18px;border-bottom:1px solid var(--ui-line-strong);overflow-x:auto;scrollbar-width:thin}.profile-tab{position:relative;flex:0 0 auto;min-height:48px;padding:12px 17px;border:1px solid transparent;border-bottom:0;border-radius:11px 11px 0 0;background:transparent;color:var(--ui-navigation);font-size:.78rem;font-weight:900;cursor:pointer;transition:color .15s ease,background .15s ease,border-color .15s ease}.profile-tab:hover{color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 7%,transparent)}.profile-tab.active{border-color:var(--ui-line-strong);background:var(--ui-surface-2);color:var(--ui-accent)}.profile-tab.active::after{content:"";position:absolute;left:-1px;right:-1px;bottom:-2px;height:3px;border-radius:3px 3px 0 0;background:var(--ui-hover)}.profile-tab:focus-visible{outline:2px solid var(--ui-hover);outline-offset:-3px}.profile-tab-panel[hidden]{display:none}.profile-tab-panel{animation:profile-tab-in .16s ease}.profile-tab-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:14px;align-items:start}.profile-tab-stack{display:grid;gap:14px}@keyframes profile-tab-in{from{opacity:.45;transform:translateY(3px)}to{opacity:1;transform:none}}@media(max-width:850px){.profile-tab-grid{grid-template-columns:1fr}}@media(max-width:600px){.profile-tab-list{margin-inline:-2px}.profile-tab{min-height:44px;padding:11px 13px;font-size:.72rem}}
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
  const body=`${managementCss}${notice}<section class="manage-card"><h2>Player identity</h2><p>Create the permanent player record first. Discord access can be matched to it later without relying on the player’s current name.</p><form method="post" action="/ui-v2/players/new"><div class="field-grid"><label class="field full"><span>Player name</span><input name="display_name" maxlength="80" autocomplete="off" required></label><label class="field"><span>Rank</span><select name="rank" required>${(ranks.results??[]).map(rankOption).join("")}</select></label><label class="field"><span>Base level</span><input name="base_level" type="number" inputmode="numeric" min="1" max="${maxBase}" placeholder="Not set"><small>Current platform maximum: ${maxBase}</small></label><label class="field"><span>Joined</span><input name="joined_at" type="date"></label><label class="field"><span>Birthday</span><input name="birthday" inputmode="numeric" maxlength="5" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])"><small>Optional · day and month only</small></label><label class="field full"><span>Initial Total Strength</span><input name="total_strength" inputmode="decimal" placeholder="Optional · e.g. 120M"><small>This can be entered now, then updated manually or through the weekly roster upload.</small></label></div><div class="form-actions"><a class="manage-button secondary" href="/ui-v2/players">Cancel</a><button class="manage-button" type="submit">Add player</button></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Add Player",description:"Add a new active member to the alliance roster.",body,activePath:"/ui-v2/players",back:{href:"/ui-v2/players",label:"Players"}}));
}

async function createPlayer(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const copy=request.clone(),value=await readPlayerProfileForm(request,env),form=await copy.formData(),strength=parsePerformancePower(form.get("total_strength"));
  if(!value.valid||!validIsoDate(value.joined)||!strength.valid)return redirect(request,"/ui-v2/players/new?error=invalid");
  if(value.rank===5&&!context.user.canManageProtectedRank)return new Response("Protected R5 rank requires explicit permission",{status:403});
  try{
    const inserted=await env.DB.prepare("INSERT INTO players (display_name,rank,base_level,player_power,is_active,joined_at,left_at,birthday_month,birthday_day) VALUES (?,?,?,?,1,?,NULL,?,?)").bind(value.name,value.rank,value.base,strength.value,value.joined,value.birthdayMonth,value.birthdayDay).run();
    const id=Number(inserted.meta.last_row_id);
    const statements:D1PreparedStatement[]=[
      env.DB.prepare("INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note) VALUES (?,NULL,?,?,?)").bind(id,value.rank,context.user.accountId,"Player created"),
      auditStatement(env,context,"player.created","player",String(id),null,{display_name:value.name,rank:value.rank,base_level:value.base,total_strength:strength.value,joined_at:value.joined,birthday_month:value.birthdayMonth,birthday_day:value.birthdayDay})
    ];
    if(strength.value!==null)statements.push(env.DB.prepare("INSERT INTO player_roster_snapshots (player_id,total_strength,recorded_by_account_id,source) VALUES (?,?,?,'manual')").bind(id,strength.value,context.user.accountId));
    await env.DB.batch(statements);
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
  const body=`${managementCss}${notice}<div class="access-summary"><div><strong>${rows.length}</strong><span>${rows.length===1?"account is":"accounts are"} waiting for approval</span></div><span>${available.length} unlinked active ${available.length===1?"player":"players"} available</span></div><div class="access-list">${cards||'<div class="empty-access">No Discord accounts are waiting for access.</div>'}</div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Waiting Access",description:"Match each Discord sign-in to the correct active player before approving entry.",body,activePath:"/ui-v2/players",back:{href:"/ui-v2/players",label:"Players"}}));
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
  return `${Number((value/(unit[0] as number)).toFixed(2))}${unit[1]}`;
}

function parsePerformancePower(value:FormDataEntryValue|null){
  const text=String(value??"").trim();
  if(!text)return{valid:true,value:null};
  const match=text.replaceAll(",","").replace(/\s+/g,"").match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/i);
  if(!match)return{valid:false,value:null};
  const multiplier=!match[2]?1:match[2].toUpperCase()==="K"?1e3:match[2].toUpperCase()==="M"?1e6:1e9;
  const power=Math.round(Number(match[1])*multiplier);
  return{valid:Number.isSafeInteger(power)&&power>=0,value:power};
}

function parseOptionalLevel(value:FormDataEntryValue|null,max:number){
  const text=String(value??"").trim();
  if(!text)return{valid:true,value:null};
  const level=Number(text);
  return{valid:Number.isInteger(level)&&level>=1&&level<=max,value:level};
}

function validIsoDate(value:string|null){
  if(!value)return true;
  const match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return false;
  const date=new Date(Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3])));
  return date.getUTCFullYear()===Number(match[1])&&date.getUTCMonth()===Number(match[2])-1&&date.getUTCDate()===Number(match[3]);
}

async function playerPage(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManagePlayers)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Player Profile",description:"You do not have permission to view player management.",body:"",activePath:"/ui-v2/players"}),403);
  const [player,ranks,maxBase,maxOverlord,linked,history,performance,squadLoadouts,tacticalDrone,overlord,snapshots]=await Promise.all([
    loadStoredPlayer(env,playerId),
    env.DB.prepare("SELECT rank_level,display_name,colour FROM alliance_ranks ORDER BY rank_level").all<RankRow>(),
    getPlayerMaxBaseLevel(env),
    getPlayerMaxOverlordLevel(env),
    env.DB.prepare("SELECT a.id,a.display_name,a.is_active,a.is_owner,a.approval_status,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.player_id=? LIMIT 1").bind(playerId).first<LinkedAccount>(),
    env.DB.prepare("SELECT old_rank,new_rank,changed_at,note FROM player_rank_history WHERE player_id=? ORDER BY changed_at DESC LIMIT 12").bind(playerId).all<RankHistory>(),
    env.DB.prepare("SELECT player_power total_strength,total_hero_power FROM players WHERE id=?").bind(playerId).first<PlayerPerformance>(),
    env.DB.prepare("SELECT squad_number,power FROM player_squads WHERE player_id=? ORDER BY squad_number").bind(playerId).all<SquadLoadout>(),
    env.DB.prepare("SELECT level FROM player_companions WHERE player_id=? AND companion_type='tactical_drone' LIMIT 1").bind(playerId).first<TacticalDrone>(),
    env.DB.prepare("SELECT level,assigned_squad FROM player_companions WHERE player_id=? AND companion_type='overlord' LIMIT 1").bind(playerId).first<OverlordLoadout>(),
    env.DB.prepare("SELECT total_strength,squad_1_power,squad_2_power,squad_3_power,squad_4_power,total_hero_power,recorded_at,source FROM player_roster_snapshots WHERE player_id=? ORDER BY recorded_at DESC,id DESC LIMIT 8").bind(playerId).all<RosterSnapshot>()
  ]);
  if(!player)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Player not found",description:"That player record no longer exists.",body:managementCss,activePath:"/ui-v2/players",back:{href:"/ui-v2/players",label:"Players"}}),404);
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
  const current=performance??{total_strength:null,total_hero_power:null},squadRows=squadLoadouts.results??[],squads=Array.from({length:4},(_,index)=>squadRows.find(row=>row.squad_number===index+1)??{squad_number:index+1,power:null}),droneLevel=tacticalDrone?.level??null,currentOverlord=overlord??{level:null,assigned_squad:null},snapshotRows=snapshots.results??[];
  const stat=(label:string,value:number|null)=>`<div class="performance-stat"><span>${esc(label)}</span><strong>${esc(compactPower(value))}</strong></div>`;
  const levelStat=(label:string,value:number|null)=>`<div class="performance-stat"><span>${esc(label)}</span><strong>${value===null?"—":`Level ${value}`}</strong><small>${value===null?"Not set":"Shared across all squads"}</small></div>`;
  const snapshotMarkup=snapshotRows.map(row=>`<tr><td>${esc(historyTime(row.recorded_at))}<span class="snapshot-source">${row.source==="manual"?"Manual update":"Roster upload"}</span></td><td>${esc(compactPower(row.total_strength))}</td><td>${esc(compactPower(row.squad_1_power))}</td><td>${esc(compactPower(row.squad_2_power))}</td><td>${esc(compactPower(row.squad_3_power))}</td><td>${esc(compactPower(row.squad_4_power))}</td><td>${esc(compactPower(row.total_hero_power))}</td></tr>`).join("");
  const squadEditors=squads.map(squad=>`<section class="loadout-card"><h4>Squad ${squad.squad_number}</h4><label class="field"><span>Squad power</span><input name="squad_${squad.squad_number}_power" inputmode="decimal" value="${squad.power===null?"":compactPower(squad.power)}" placeholder="Not set"></label></section>`).join("");
  const squadOptions=Array.from({length:4},(_,index)=>`<option value="${index+1}"${currentOverlord.assigned_squad===index+1?" selected":""}>Squad ${index+1}</option>`).join("");
  const performanceEditor=context.user.canEditPlayers?`<form class="performance-editor" method="post" action="/ui-v2/players/${player.id}/performance"><h3>Update performance and squad setup</h3><p>Add figures as they become available. Enter a full value such as 56520000 or a short value such as 56.52M; saved values are always shown in short form. Blank fields clear that item.</p><div class="performance-totals"><label class="field"><span>Total Strength</span><input name="total_strength" inputmode="decimal" value="${current.total_strength===null?"":compactPower(current.total_strength)}" placeholder="e.g. 56.52M"></label><label class="field"><span>Total Hero Power</span><input name="total_hero_power" inputmode="decimal" value="${current.total_hero_power===null?"":compactPower(current.total_hero_power)}" placeholder="Add later"></label></div><div class="loadout-grid">${squadEditors}</div><section class="loadout-card overlord-card"><h4>Tactical Drone</h4><label class="field"><span>Tactical Drone level</span><input name="tactical_drone_level" type="number" inputmode="numeric" min="1" max="999" value="${droneLevel??""}" placeholder="Not set"><small>Shared across all four squads.</small></label></section><section class="loadout-card overlord-card"><h4>Overlord</h4><div class="overlord-fields"><label class="field"><span>Overlord level</span><input name="overlord_level" type="number" inputmode="numeric" min="1" max="${maxOverlord}" value="${currentOverlord.level??""}" placeholder="Not set"><small>Current platform maximum: ${maxOverlord}</small></label><label class="field"><span>Used with</span><select name="overlord_squad"><option value="">Not assigned</option>${squadOptions}</select></label></div></section><div class="form-actions"><button class="manage-button" type="submit">Save performance</button></div></form>`:"";
  const overlordSummary=`<div class="performance-stat"><span>Overlord</span><strong>${currentOverlord.level?`Level ${currentOverlord.level}`:"—"}</strong><small>${currentOverlord.assigned_squad?`Used with Squad ${currentOverlord.assigned_squad}`:"Squad not assigned"}</small></div>`;
  const visibleSquads=squads.filter(squad=>squad.squad_number===1||squad.power!==null);
  const performanceCard=`<section class="manage-card"><h2>Player Stats</h2><p>Each squad retains its own power. Squad 1 is always shown; Squads 2–4 appear here once a power has been entered. The Tactical Drone is shared across all squads, while the Overlord can be assigned to a specific squad.</p><div class="performance-grid">${stat("Total Strength",current.total_strength)}${visibleSquads.map(squad=>stat(`Squad ${squad.squad_number} Power`,squad.power)).join("")}${stat("Total Hero Power",current.total_hero_power)}${levelStat("Tactical Drone",droneLevel)}${overlordSummary}</div>${performanceEditor}${snapshotMarkup?`<div class="snapshot-wrap"><table class="snapshot-table"><thead><tr><th>Performance update</th><th>Total Strength</th><th>Squad 1</th><th>Squad 2</th><th>Squad 3</th><th>Squad 4</th><th>Hero Power</th></tr></thead><tbody>${snapshotMarkup}</tbody></table></div>`:'<div class="profile-empty">No performance history has been recorded yet.</div>'}</section>`;
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
  const notesTab=notesCard?`<button class="profile-tab" type="button" role="tab" aria-selected="false" aria-controls="leadership-notes" data-profile-tab="leadership-notes" tabindex="-1">Leadership Notes</button>`:"";
  const notesPanel=notesCard?`<section class="profile-tab-panel" id="leadership-notes" role="tabpanel" data-profile-panel hidden>${notesCard}</section>`:"";
  const tabsScript=`<script>(()=>{const tabs=[...document.querySelectorAll('[data-profile-tab]')],panels=[...document.querySelectorAll('[data-profile-panel]')];if(!tabs.length)return;const available=new Set(tabs.map(tab=>tab.dataset.profileTab));const activate=(id,focus=false)=>{const selected=available.has(id)?id:'player-details';tabs.forEach(tab=>{const active=tab.dataset.profileTab===selected;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;if(active&&focus)tab.focus()});panels.forEach(panel=>panel.hidden=panel.id!==selected)};tabs.forEach((tab,index)=>{tab.addEventListener('click',()=>{const id=tab.dataset.profileTab;history.replaceState(null,'','#'+id);activate(id)});tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:event.key==='ArrowRight'?(index+1)%tabs.length:(index-1+tabs.length)%tabs.length;const id=tabs[next].dataset.profileTab;history.replaceState(null,'','#'+id);activate(id,true)})});window.addEventListener('hashchange',()=>activate(location.hash.slice(1)));activate(location.hash.slice(1))})();</script>`;
  const body=`${managementCss}${profileCss}${loadoutCss}${tabsCss}${notice}<div class="profile-tabs"><div class="profile-tab-list" role="tablist" aria-label="Player profile sections"><button class="profile-tab active" type="button" role="tab" aria-selected="true" aria-controls="player-details" data-profile-tab="player-details">Player Details</button><button class="profile-tab" type="button" role="tab" aria-selected="false" aria-controls="player-stats" data-profile-tab="player-stats" tabindex="-1">Player Stats</button><button class="profile-tab" type="button" role="tab" aria-selected="false" aria-controls="discord-account" data-profile-tab="discord-account" tabindex="-1">Discord &amp; Account</button><button class="profile-tab" type="button" role="tab" aria-selected="false" aria-controls="rank-history" data-profile-tab="rank-history" tabindex="-1">Rank History</button>${notesTab}</div><section class="profile-tab-panel" id="player-details" role="tabpanel" data-profile-panel><div class="profile-tab-grid"><div>${details}</div>${membership?`<aside>${membership}</aside>`:""}</div></section><section class="profile-tab-panel" id="player-stats" role="tabpanel" data-profile-panel hidden>${performanceCard}</section><section class="profile-tab-panel" id="discord-account" role="tabpanel" data-profile-panel hidden>${account}</section><section class="profile-tab-panel" id="rank-history" role="tabpanel" data-profile-panel hidden>${historyCard}</section>${notesPanel}</div>${tabsScript}`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:`Player #${player.id}`,title:player.display_name,description:"Manage the player record, membership and linked account in one place.",body,activePath:"/ui-v2/players",back:{href:"/ui-v2/players",label:"Players"}}));
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
  const [form,maxOverlord]=await Promise.all([request.formData(),getPlayerMaxOverlordLevel(env)]),strength=parsePerformancePower(form.get("total_strength")),heroes=parsePerformancePower(form.get("total_hero_power"));
  const squads=Array.from({length:4},(_,index)=>{const number=index+1;return{number,power:parsePerformancePower(form.get(`squad_${number}_power`))}}),droneLevel=parseOptionalLevel(form.get("tactical_drone_level"),999);
  const overlordLevel=parseOptionalLevel(form.get("overlord_level"),maxOverlord),overlordSquadRaw=String(form.get("overlord_squad")??"").trim(),overlordSquad=overlordSquadRaw?Number(overlordSquadRaw):null;
  if(!strength.valid||!heroes.valid||!droneLevel.valid||!overlordLevel.valid||overlordSquad!==null&&(!Number.isInteger(overlordSquad)||overlordSquad<1||overlordSquad>4)||squads.some(squad=>!squad.power.valid))return redirect(request,`/ui-v2/players/${playerId}?error=performance#player-stats`);
  const [player,old,oldSquads,oldDrone,oldOverlord]=await Promise.all([
    loadStoredPlayer(env,playerId),
    env.DB.prepare("SELECT player_power total_strength,total_hero_power FROM players WHERE id=?").bind(playerId).first<PlayerPerformance>(),
    env.DB.prepare("SELECT squad_number,power FROM player_squads WHERE player_id=? ORDER BY squad_number").bind(playerId).all<SquadLoadout>(),
    env.DB.prepare("SELECT level FROM player_companions WHERE player_id=? AND companion_type='tactical_drone' LIMIT 1").bind(playerId).first<TacticalDrone>(),
    env.DB.prepare("SELECT level,assigned_squad FROM player_companions WHERE player_id=? AND companion_type='overlord' LIMIT 1").bind(playerId).first<OverlordLoadout>()
  ]);
  if(!player||!old)return new Response("Player not found",{status:404});
  const next={total_strength:strength.value,total_hero_power:heroes.value,squads:squads.map(squad=>({squad_number:squad.number,power:squad.power.value})),tactical_drone:{level:droneLevel.value},overlord:{level:overlordLevel.value,assigned_squad:overlordSquad}};
  const statements:D1PreparedStatement[]=[env.DB.prepare("UPDATE players SET player_power=?,total_hero_power=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(strength.value,heroes.value,playerId)];
  for(const squad of squads){
    statements.push(squad.power.value===null?env.DB.prepare("DELETE FROM player_squads WHERE player_id=? AND squad_number=?").bind(playerId,squad.number):env.DB.prepare("INSERT INTO player_squads (player_id,squad_number,power) VALUES (?,?,?) ON CONFLICT(player_id,squad_number) DO UPDATE SET power=excluded.power,updated_at=CURRENT_TIMESTAMP").bind(playerId,squad.number,squad.power.value));
  }
  statements.push(droneLevel.value===null?env.DB.prepare("DELETE FROM player_companions WHERE player_id=? AND companion_type='tactical_drone'").bind(playerId):env.DB.prepare("INSERT INTO player_companions (player_id,companion_type,level,power,assigned_squad) VALUES (?,'tactical_drone',?,NULL,NULL) ON CONFLICT(player_id,companion_type) DO UPDATE SET level=excluded.level,power=NULL,assigned_squad=NULL,updated_at=CURRENT_TIMESTAMP").bind(playerId,droneLevel.value));
  statements.push(overlordLevel.value===null&&overlordSquad===null?env.DB.prepare("DELETE FROM player_companions WHERE player_id=? AND companion_type='overlord'").bind(playerId):env.DB.prepare("INSERT INTO player_companions (player_id,companion_type,level,power,assigned_squad) VALUES (?,'overlord',?,NULL,?) ON CONFLICT(player_id,companion_type) DO UPDATE SET level=excluded.level,power=NULL,assigned_squad=excluded.assigned_squad,updated_at=CURRENT_TIMESTAMP").bind(playerId,overlordLevel.value,overlordSquad));
  statements.push(env.DB.prepare("INSERT INTO player_roster_snapshots (player_id,total_strength,squad_1_power,squad_2_power,squad_3_power,squad_4_power,total_hero_power,recorded_by_account_id,source) VALUES (?,?,?,?,?,?,?,?,'manual')").bind(playerId,strength.value,squads[0].power.value,squads[1].power.value,squads[2].power.value,squads[3].power.value,heroes.value,context.user.accountId));
  statements.push(auditStatement(env,context,"player.performance_updated","player",String(playerId),{...old,squads:oldSquads.results??[],tactical_drone:oldDrone??null,overlord:oldOverlord??null},next,{update_source:"manual"}));
  await env.DB.batch(statements);
  return redirect(request,`/ui-v2/players/${playerId}?saved=performance#player-stats`);
}

async function changeMembership(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,action:"deactivate"|"reactivate"){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const actor=await playerActor(request,env);
  if(!actor)return redirect(request,"/login");
  const result=action==="deactivate"?await deactivatePlayerMembership(request,env,actor,playerId):await reactivatePlayerMembership(request,env,actor,playerId);
  return result??redirect(request,`/ui-v2/players/${playerId}?saved=${action}d#player-details`);
}

async function disconnectAccount(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const actor=await playerActor(request,env);
  if(!actor)return redirect(request,"/login");
  const result=await disconnectPlayerLogin(request,env,actor,playerId);
  return result??redirect(request,`/ui-v2/players/${playerId}?saved=disconnected#discord-account`);
}

async function changeLoginAccess(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,enable:boolean){
  if(!context.user.canManageAccounts||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const actor=await playerActor(request,env);
  if(!actor)return redirect(request,"/login");
  const result=await setPlayerLoginAccess(request,env,actor,playerId,enable);
  return result??redirect(request,`/ui-v2/players/${playerId}?saved=login-${enable?"enabled":"disabled"}#discord-account`);
}

async function createNote(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManagePrivateNotes||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  if(!await loadStoredPlayer(env,playerId))return new Response("Player not found",{status:404});
  const form=await request.formData(),note=String(form.get("note")||"").trim();
  if(!note||note.length>2000)return redirect(request,`/ui-v2/players/${playerId}?error=note#leadership-notes`);
  const inserted=await env.DB.prepare("INSERT INTO player_private_notes (player_id,note,created_by_account_id,updated_by_account_id) VALUES (?,?,?,?)").bind(playerId,note,context.user.accountId,context.user.accountId).run();
  const noteId=String(inserted.meta.last_row_id);
  await auditStatement(env,context,"player.note_created","player_note",noteId,null,{player_id:playerId,note_length:note.length});
  return redirect(request,`/ui-v2/players/${playerId}?saved=note-created#leadership-notes`);
}

async function updateNote(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,noteId:number){
  if(!context.user.canManagePrivateNotes||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const old=await env.DB.prepare("SELECT id,note FROM player_private_notes WHERE id=? AND player_id=?").bind(noteId,playerId).first<{id:number;note:string}>();
  if(!old)return new Response("Note not found",{status:404});
  const form=await request.formData(),note=String(form.get("note")||"").trim();
  if(!note||note.length>2000)return redirect(request,`/ui-v2/players/${playerId}?error=note#leadership-notes`);
  await env.DB.batch([
    env.DB.prepare("UPDATE player_private_notes SET note=?,updated_by_account_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND player_id=?").bind(note,context.user.accountId,noteId,playerId),
    auditStatement(env,context,"player.note_updated","player_note",String(noteId),{player_id:playerId,note_length:old.note.length},{player_id:playerId,note_length:note.length})
  ]);
  return redirect(request,`/ui-v2/players/${playerId}?saved=note-updated#leadership-notes`);
}

async function deleteNote(request:Request,env:UiV2Env,context:UiV2Context,playerId:number,noteId:number){
  if(!context.user.canManagePrivateNotes||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const old=await env.DB.prepare("SELECT id,note FROM player_private_notes WHERE id=? AND player_id=?").bind(noteId,playerId).first<{id:number;note:string}>();
  if(!old)return new Response("Note not found",{status:404});
  await env.DB.batch([
    auditStatement(env,context,"player.note_deleted","player_note",String(noteId),{player_id:playerId,note_length:old.note.length},null),
    env.DB.prepare("DELETE FROM player_private_notes WHERE id=? AND player_id=?").bind(noteId,playerId)
  ]);
  return redirect(request,`/ui-v2/players/${playerId}?saved=note-deleted#leadership-notes`);
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
