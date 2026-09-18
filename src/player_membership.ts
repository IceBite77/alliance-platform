import {playerPermitted,playerSameOrigin,type PlayerActor} from "./player_access";
import {auditPlayer,loadStoredPlayer} from "./player_store";

export interface PlayerMembershipEnv { DB:D1Database; APP_URL:string }
type LinkedAccount={id:number;display_name:string;is_active:number;is_owner:number;provider_username:string|null};

const linkedAccount=async(env:PlayerMembershipEnv,playerId:number)=>env.DB.prepare(`SELECT a.id,a.display_name,a.is_active,a.is_owner,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.player_id=? LIMIT 1`).bind(playerId).first<LinkedAccount>();

const removeLogin=async(env:PlayerMembershipEnv,actor:PlayerActor,playerId:number,linked:LinkedAccount,reason:string)=>{
  const discord=linked.provider_username||linked.display_name;
  const groups=(await env.DB.prepare("SELECT group_id FROM account_groups WHERE account_id=?").bind(linked.id).all<{group_id:number}>()).results?.map(x=>x.group_id)??[];
  const revoked=await env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE account_id=? AND revoked_at IS NULL").bind(linked.id).run();
  await env.DB.prepare("DELETE FROM account_groups WHERE account_id=?").bind(linked.id).run();
  await env.DB.prepare(`INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,subject_player_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),actor.id,actor.display_name,"account.discord_disconnected","account",String(linked.id),playerId,"web",JSON.stringify({player_id:playerId,discord,group_ids:groups}),JSON.stringify({discord:null,account_removed:true,group_ids:[]}),JSON.stringify({reason,sessions_revoked:Number(revoked.meta?.changes??0),groups_removed:groups.length,player_preserved:true,login_account_removed:true})).run();
  await env.DB.prepare("DELETE FROM accounts WHERE id=? AND is_owner=0").bind(linked.id).run();
};

const membershipAllowed=async(request:Request,env:PlayerMembershipEnv,actor:PlayerActor)=>playerSameOrigin(request,env)&&await playerPermitted(env,actor,"players.manage_membership");

export const disconnectPlayerLogin=async(request:Request,env:PlayerMembershipEnv,actor:PlayerActor,playerId:number)=>{if(!await membershipAllowed(request,env,actor))return new Response("Forbidden",{status:403});const player=await loadStoredPlayer(env,playerId);if(!player)return new Response("Player not found",{status:404});const linked=await linkedAccount(env,playerId);if(!linked)return new Response("No linked account",{status:400});if(linked.is_owner)return new Response("The Owner login cannot be disconnected here. Transfer ownership first.",{status:400});await removeLogin(env,actor,playerId,linked,"manual_disconnect");return null;};

export const setPlayerLoginAccess=async(request:Request,env:PlayerMembershipEnv,actor:PlayerActor,playerId:number,enable:boolean)=>{
  if(!playerSameOrigin(request,env)||!await playerPermitted(env,actor,"accounts.manage"))return new Response("Forbidden",{status:403});
  const player=await loadStoredPlayer(env,playerId);if(!player)return new Response("Player not found",{status:404});
  const linked=await linkedAccount(env,playerId);if(!linked)return new Response("No linked account",{status:400});
  if(linked.is_owner)return new Response("The Owner login cannot be disabled here.",{status:400});
  if(Boolean(linked.is_active)===enable)return null;
  let sessionsRevoked=0;
  await env.DB.prepare("UPDATE accounts SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND is_owner=0").bind(enable?1:0,linked.id).run();
  if(!enable){
    const revoked=await env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE account_id=? AND revoked_at IS NULL").bind(linked.id).run();
    sessionsRevoked=Number(revoked.meta?.changes??0);
  }
  await env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,subject_player_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),actor.id,actor.display_name,enable?"account.login_enabled":"account.login_disabled","account",String(linked.id),playerId,"ui-v2-players",JSON.stringify({is_active:linked.is_active}),JSON.stringify({is_active:enable?1:0}),JSON.stringify({sessions_revoked:sessionsRevoked})).run();
  return null;
};

export const deactivatePlayerMembership=async(request:Request,env:PlayerMembershipEnv,actor:PlayerActor,playerId:number)=>{if(!await membershipAllowed(request,env,actor))return new Response("Forbidden",{status:403});const player=await loadStoredPlayer(env,playerId);if(!player)return new Response("Player not found",{status:404});const linked=await linkedAccount(env,playerId);if(linked?.is_owner)return new Response("The Owner cannot be moved to Former Players while their Owner account is linked. Transfer ownership first.",{status:400});if(linked)await removeLogin(env,actor,playerId,linked,"player_moved_to_former_members");await env.DB.prepare("UPDATE players SET is_active=0,left_at=COALESCE(left_at,date('now')),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(playerId).run();await auditPlayer(env,actor,"player.deactivated",playerId,{is_active:0},{is_active:player.is_active,left_at:player.left_at},{discord_login_removed:!!linked,access_groups_cleared:!!linked});return null;};

export const reactivatePlayerMembership=async(request:Request,env:PlayerMembershipEnv,actor:PlayerActor,playerId:number)=>{if(!await membershipAllowed(request,env,actor))return new Response("Forbidden",{status:403});const player=await loadStoredPlayer(env,playerId);if(!player)return new Response("Player not found",{status:404});await env.DB.prepare("UPDATE players SET is_active=1,left_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(playerId).run();await auditPlayer(env,actor,"player.reactivated",playerId,{is_active:1,left_at:null},{is_active:player.is_active,left_at:player.left_at},{login_requires_fresh_approval:true,access_groups_restored:false});return null;};
