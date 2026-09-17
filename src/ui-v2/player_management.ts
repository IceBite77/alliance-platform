import {playerActor,playerSameOrigin} from "../player_access";
import {deactivatePlayerMembership,disconnectPlayerLogin,reactivatePlayerMembership} from "../player_membership";
import {formatPlayerBirthday,getPlayerMaxBaseLevel,readPlayerProfileForm} from "../player_profile_fields";
import {loadStoredPlayer} from "../player_store";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type RankRow={rank_level:number;display_name:string;colour:string};
type PendingAccount={id:number;display_name:string;provider_username:string|null};
type AvailablePlayer={id:number;display_name:string;rank:number;rank_name:string|null;rank_colour:string|null};
type LinkedAccount={id:number;display_name:string;provider_username:string|null;is_active:number;is_owner:number;approval_status:string};
type RankHistory={old_rank:number|null;new_rank:number;changed_at:string;note:string|null};

const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const validId=(value:string)=>/^\d+$/.test(value)&&Number(value)>0;
const auditStatement=(env:UiV2Env,context:UiV2Context,action:string,entityType:string,entityId:string,oldValues:unknown,newValues:unknown,metadata:unknown={})=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,entityType,entityId,"ui-v2-players",JSON.stringify(oldValues),JSON.stringify(newValues),JSON.stringify(metadata));

const managementCss=`<style>
.manage-back{display:inline-flex;margin-bottom:18px;color:var(--ui-navigation);font-size:.78rem;font-weight:850;text-decoration:none}.manage-back:hover{color:var(--ui-hover)}.manage-notice{margin-bottom:17px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.8rem;font-weight:800}.manage-notice.error{border-color:color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger)}.manage-card{padding:21px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.manage-card h2{margin:0 0 6px;font-size:1.05rem}.manage-card>p{margin:0 0 18px;color:var(--ui-muted);font-size:.8rem;line-height:1.5}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:block;min-width:0}.field.full{grid-column:1/-1}.field>span{display:block;margin-bottom:6px;color:var(--ui-secondary);font-size:.74rem;font-weight:850}.field input,.field select{width:100%;min-width:0;max-width:100%;padding:11px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.field input[type=date]{display:block;-webkit-appearance:none;appearance:none;inline-size:100%;max-inline-size:100%}.field input[type=date]::-webkit-date-and-time-value{min-width:0;text-align:left}.field small{display:block;margin-top:6px;color:var(--ui-muted);font-size:.67rem;line-height:1.4}.form-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.manage-button{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:900;text-decoration:none;cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease,box-shadow .15s ease}.manage-button.secondary{border:1px solid var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.manage-button.secondary:hover{border-color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 9%,var(--ui-surface-3));color:var(--ui-hover);box-shadow:0 0 16px color-mix(in srgb,var(--ui-hover) 10%,transparent)}.manage-button.danger{border:1px solid color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 10%,var(--ui-surface-3));color:var(--ui-danger)}.access-summary{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:14px;padding:16px 18px;border:1px solid color-mix(in srgb,var(--ui-warning) 48%,var(--ui-line));border-radius:13px;background:color-mix(in srgb,var(--ui-warning) 8%,var(--ui-surface-2))}.access-summary strong{color:var(--ui-warning);font-size:1.2rem}.access-summary span{color:var(--ui-muted);font-size:.78rem}.access-list{display:grid;gap:10px}.access-card{display:grid;grid-template-columns:minmax(180px,.8fr) minmax(330px,1.5fr) auto;gap:12px;align-items:end;padding:16px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.access-person strong,.access-person span{display:block}.access-person strong{font-size:.92rem}.access-person span{margin-top:4px;color:var(--ui-muted);font-size:.7rem}.access-approve{display:grid;grid-template-columns:minmax(190px,1fr) auto;gap:8px;align-items:end}.access-approve label{margin:0}.empty-access{padding:28px;border:1px dashed var(--ui-line-strong);border-radius:13px;color:var(--ui-muted);text-align:center}@media(max-width:820px){.access-card{grid-template-columns:1fr}.access-approve{grid-template-columns:1fr auto}}@media(max-width:600px){.field-grid{grid-template-columns:1fr}.field.full{grid-column:auto}.form-actions{display:grid;grid-template-columns:1fr}.access-approve{grid-template-columns:1fr}.manage-button{width:100%}}
</style>`;

const profileCss=`<style>
.profile-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(285px,.55fr);gap:14px;align-items:start}.profile-stack{display:grid;gap:14px}.profile-back{margin-bottom:18px}.profile-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:17px}.profile-heading h2{margin:0}.member-badge{padding:6px 9px;border-radius:999px;background:color-mix(in srgb,var(--ui-success) 11%,var(--ui-surface-3));color:var(--ui-success);font-size:.68rem;font-weight:900}.member-badge.former{background:color-mix(in srgb,var(--ui-danger) 11%,var(--ui-surface-3));color:var(--ui-danger)}.account-panel{padding:14px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-3)}.account-panel strong,.account-panel span{display:block}.account-panel strong{font-size:.86rem}.account-panel span{margin-top:5px;color:var(--ui-muted);font-size:.72rem;line-height:1.45}.account-panel .linked{color:var(--ui-success)}.account-panel .disabled{color:var(--ui-danger)}.account-actions{margin-top:12px}.account-actions.membership-note{margin-top:12px}.account-actions .manage-button{width:100%}.history-list{display:grid;gap:8px}.history-row{display:flex;justify-content:space-between;gap:15px;padding:11px 0;border-bottom:1px solid var(--ui-line)}.history-row:last-child{border-bottom:0}.history-row strong{font-size:.78rem}.history-row span{color:var(--ui-muted);font-size:.68rem;text-align:right}.profile-empty{color:var(--ui-muted);font-size:.76rem}.membership-actions{display:grid;gap:10px}.membership-note{margin:0;color:var(--ui-muted);font-size:.72rem;line-height:1.5}@media(max-width:1100px){.profile-layout{grid-template-columns:1fr}.profile-layout .date-field{grid-column:1/-1}}@media(max-width:600px){.profile-heading{align-items:flex-start}.history-row{display:block}.history-row span{margin-top:5px;text-align:left}}
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
  const body=`${managementCss}<a class="manage-back" href="/ui-v2/players">← Players</a>${notice}<section class="manage-card"><h2>Player identity</h2><p>Create the permanent player record first. Discord access can be matched to it later without relying on the player’s current name.</p><form method="post" action="/ui-v2/players/new"><div class="field-grid"><label class="field full"><span>Player name</span><input name="display_name" maxlength="80" autocomplete="off" required></label><label class="field"><span>Rank</span><select name="rank" required>${(ranks.results??[]).map(rankOption).join("")}</select></label><label class="field"><span>Base level</span><input name="base_level" type="number" inputmode="numeric" min="1" max="${maxBase}" placeholder="Not set"><small>Current platform maximum: ${maxBase}</small></label><label class="field"><span>Joined</span><input name="joined_at" type="date"></label><label class="field"><span>Birthday</span><input name="birthday" inputmode="numeric" maxlength="5" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])"><small>Optional · day and month only</small></label></div><div class="form-actions"><a class="manage-button secondary" href="/ui-v2/players">Cancel</a><button class="manage-button" type="submit">Add player</button></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Add Player",description:"Add a new active member to the alliance roster.",body,activePath:"/ui-v2/players"}));
}

async function createPlayer(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const value=await readPlayerProfileForm(request,env);
  if(!value.valid)return redirect(request,"/ui-v2/players/new?error=invalid");
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
  const body=`${managementCss}<a class="manage-back" href="/ui-v2/players">← Players</a>${notice}<div class="access-summary"><div><strong>${rows.length}</strong><span>${rows.length===1?"account is":"accounts are"} waiting for approval</span></div><span>${available.length} unlinked active ${available.length===1?"player":"players"} available</span></div><div class="access-list">${cards||'<div class="empty-access">No Discord accounts are waiting for access.</div>'}</div>`;
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

async function playerPage(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canManagePlayers)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Player Profile",description:"You do not have permission to view player management.",body:"",activePath:"/ui-v2/players"}),403);
  const [player,ranks,maxBase,linked,history]=await Promise.all([
    loadStoredPlayer(env,playerId),
    env.DB.prepare("SELECT rank_level,display_name,colour FROM alliance_ranks ORDER BY rank_level").all<RankRow>(),
    getPlayerMaxBaseLevel(env),
    env.DB.prepare("SELECT a.id,a.display_name,a.is_active,a.is_owner,a.approval_status,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.player_id=? LIMIT 1").bind(playerId).first<LinkedAccount>(),
    env.DB.prepare("SELECT old_rank,new_rank,changed_at,note FROM player_rank_history WHERE player_id=? ORDER BY changed_at DESC LIMIT 12").bind(playerId).all<RankHistory>()
  ]);
  if(!player)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Player not found",description:"That player record no longer exists.",body:`${managementCss}<a class="manage-back" href="/ui-v2/players">← Players</a>`,activePath:"/ui-v2/players"}),404);

  const url=new URL(request.url),saved=url.searchParams.get("saved"),error=url.searchParams.get("error");
  const notice=saved?`<div class="manage-notice">${saved==="deactivated"?"Player moved to Former Players.":saved==="reactivated"?"Player returned to the active roster.":saved==="disconnected"?"Discord access disconnected. The permanent player record and history were kept.":"Player details saved."}</div>`:error?`<div class="manage-notice error">${error==="duplicate"?"An active player already uses that name.":"Check the player details and try again."}</div>`:"";
  const rankRows=ranks.results??[],historyRows=history.results??[];
  const disabled=context.user.canEditPlayers?"":" disabled";
  const formActions=context.user.canEditPlayers?`<div class="form-actions"><a class="manage-button secondary" href="/ui-v2/players">Cancel</a><button class="manage-button" type="submit">Save changes</button></div>`:"";
  const details=`<section class="manage-card"><div class="profile-heading"><h2>Player details</h2><span class="member-badge${player.is_active?"":" former"}">${player.is_active?"Active member":"Former member"}</span></div><form method="post" action="/ui-v2/players/${player.id}/update"><div class="field-grid"><label class="field full"><span>Player name</span><input name="display_name" maxlength="80" autocomplete="off" required value="${esc(player.display_name)}"${disabled}></label><label class="field"><span>Rank</span><select name="rank" required${disabled}>${rankRows.map(rank=>rankOption(rank,player.rank)).join("")}</select></label><label class="field"><span>Base level</span><input name="base_level" type="number" inputmode="numeric" min="1" max="${maxBase}" value="${player.base_level??""}" placeholder="Not set"${disabled}><small>Current platform maximum: ${maxBase}</small></label><label class="field date-field"><span>Joined</span><input name="joined_at" type="date" value="${player.joined_at??""}"${disabled}></label><label class="field date-field"><span>Birthday</span><input name="birthday" inputmode="numeric" maxlength="5" value="${formatPlayerBirthday(player.birthday_day,player.birthday_month)}" placeholder="DD/MM" pattern="(?:0?[1-9]|[12][0-9]|3[01])\/(?:0?[1-9]|1[0-2])"${disabled}><small>Optional · day and month only</small></label></div>${formActions}</form></section>`;
  const accountState=linked?(linked.is_active&&linked.approval_status==="active"?"linked":"disabled"):"";
  const accountText=linked?`${linked.provider_username?`@${linked.provider_username}`:linked.display_name}${linked.is_owner?" · Owner":""}`:"No Discord account is linked to this player.";
  const disconnectAction=linked&&context.user.canManageMembership?(linked.is_owner?`<p class="membership-note account-actions">The Owner’s Discord login is protected and cannot be disconnected here.</p>`:`<form class="account-actions" method="post" action="/ui-v2/players/${player.id}/disconnect" onsubmit="return confirm('Disconnect this Discord login? Their sessions and access groups will be removed, but the player record will be kept.');"><button class="manage-button danger" type="submit">Disconnect Discord</button></form>`):"";
  const account=`<section class="manage-card"><h2>Discord & account</h2><p>The login remains separate from the permanent player record.</p><div class="account-panel"><strong class="${accountState}">${linked?(accountState==="linked"?"Discord linked":"Account disabled"):"Not linked"}</strong><span>${esc(accountText)}</span>${disconnectAction}</div></section>`;
  const historyMarkup=historyRows.map(item=>`<div class="history-row"><strong>${item.old_rank?`R${item.old_rank} → `:""}R${item.new_rank}</strong><span>${esc(historyTime(item.changed_at))}${item.note?` · ${esc(item.note)}`:""}</span></div>`).join("");
  const historyCard=`<section class="manage-card"><h2>Rank history</h2><p>Promotions and rank changes remain attached to this player.</p><div class="history-list">${historyMarkup||'<div class="profile-empty">No rank changes have been recorded yet.</div>'}</div></section>`;
  const membership=context.user.canManageMembership?`<section class="manage-card"><h2>Membership</h2><p>${player.is_active?"Moving a player to Former Players preserves their record and history.":"Return this player to the active roster when they rejoin."}</p><div class="membership-actions">${player.is_active?`<form method="post" action="/ui-v2/players/${player.id}/deactivate" onsubmit="return confirm('Move this player to Former Players? A linked non-owner Discord login will be removed.');"><button class="manage-button danger" type="submit">Move to Former Players</button></form><p class="membership-note">A linked non-owner login is disconnected and must be approved again if the player returns.</p>`:`<form method="post" action="/ui-v2/players/${player.id}/reactivate"><button class="manage-button" type="submit">Return to active roster</button></form><p class="membership-note">Discord access is not restored automatically.</p>`}</div></section>`:"";
  const body=`${managementCss}${profileCss}<a class="manage-button secondary profile-back" href="/ui-v2/players">← Players</a>${notice}<div class="profile-layout"><div class="profile-stack">${details}${historyCard}</div><aside class="profile-stack">${account}${membership}</aside></div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:`Player #${player.id}`,title:player.display_name,description:"Manage the player record, membership and linked account in one place.",body,activePath:"/ui-v2/players"}));
}

async function updatePlayer(request:Request,env:UiV2Env,context:UiV2Context,playerId:number){
  if(!context.user.canEditPlayers||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const old=await loadStoredPlayer(env,playerId);
  if(!old)return new Response("Player not found",{status:404});
  const value=await readPlayerProfileForm(request,env);
  if(!value.valid)return redirect(request,`/ui-v2/players/${playerId}?error=invalid`);
  if(value.rank!==old.rank&&(value.rank===5||old.rank===5)&&!context.user.canManageProtectedRank)return new Response("Protected R5 rank requires explicit permission",{status:403});
  const oldValues={display_name:old.display_name,rank:old.rank,base_level:old.base_level,joined_at:old.joined_at,birthday_month:old.birthday_month,birthday_day:old.birthday_day};
  const newValues={display_name:value.name,rank:value.rank,base_level:value.base,joined_at:value.joined,birthday_month:value.birthdayMonth,birthday_day:value.birthdayDay};
  try{
    const statements=[
      env.DB.prepare("UPDATE players SET display_name=?,rank=?,base_level=?,joined_at=?,birthday_month=?,birthday_day=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(value.name,value.rank,value.base,value.joined,value.birthdayMonth,value.birthdayDay,playerId),
      auditStatement(env,context,"player.updated","player",String(playerId),oldValues,newValues)
    ];
    if(value.rank!==old.rank)statements.splice(1,0,env.DB.prepare("INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note) VALUES (?,?,?,?,?)").bind(playerId,old.rank,value.rank,context.user.accountId,"Rank changed in player profile"));
    await env.DB.batch(statements);
    return redirect(request,`/ui-v2/players/${playerId}?saved=1`);
  }catch{return redirect(request,`/ui-v2/players/${playerId}?error=duplicate`)}
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

export async function handleUiV2PlayerManagement(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(path==="/ui-v2/players/new")return request.method==="GET"?addPage(request,env,context):request.method==="POST"?createPlayer(request,env,context):new Response("Method not allowed",{status:405});
  if(path==="/ui-v2/players/access")return request.method==="GET"?accessPage(request,env,context):new Response("Method not allowed",{status:405});
  const action=path.match(/^\/ui-v2\/players\/access\/(\d+)\/(approve|reject)$/);
  if(request.method==="POST"&&action&&validId(action[1]))return action[2]==="approve"?approveAccount(request,env,context,Number(action[1])):rejectAccount(request,env,context,Number(action[1]));
  const profile=path.match(/^\/ui-v2\/players\/(\d+)(?:\/(update|deactivate|reactivate|disconnect))?$/);
  if(profile&&validId(profile[1])){
    const playerId=Number(profile[1]),profileAction=profile[2];
    if(!profileAction&&request.method==="GET")return playerPage(request,env,context,playerId);
    if(profileAction==="update"&&request.method==="POST")return updatePlayer(request,env,context,playerId);
    if((profileAction==="deactivate"||profileAction==="reactivate")&&request.method==="POST")return changeMembership(request,env,context,playerId,profileAction);
    if(profileAction==="disconnect"&&request.method==="POST")return disconnectAccount(request,env,context,playerId);
    return new Response("Method not allowed",{status:405});
  }
  return null;
}
