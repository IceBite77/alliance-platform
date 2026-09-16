import app from "./player_account_link";
import {playerActor,playerPermitted,playerSameOrigin} from "./player_access";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }
type Actor={id:number;display_name:string;is_owner:number};
type Linked={id:number;display_name:string;is_owner:number;provider_username:string|null};
type Player={id:number;display_name:string;is_active:number;left_at:string|null};
const redirect=(u:string,r:Request)=>Response.redirect(new URL(u,r.url),302);
const linkedAccount=async(e:Env,playerId:number)=>e.DB.prepare(`SELECT a.id,a.display_name,a.is_owner,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.player_id=? LIMIT 1`).bind(playerId).first<Linked>();
const authorised=async(r:Request,e:Env,permission:string)=>{
  const a=await playerActor(r,e) as Actor|null;
  if(!a)return {response:redirect("/login",r),actor:null};
  if(!playerSameOrigin(r,e))return {response:new Response("Forbidden",{status:403}),actor:null};
  if(!await playerPermitted(e,a,permission))return {response:new Response("Forbidden",{status:403}),actor:null};
  return {response:null,actor:a};
};
const removeLogin=async(e:Env,a:Actor,playerId:number,linked:Linked,reason:string)=>{
  if(linked.is_owner)throw new Error("OWNER_ACCOUNT_PROTECTED");
  const discord=linked.provider_username||linked.display_name;
  const groups=(await e.DB.prepare("SELECT group_id FROM account_groups WHERE account_id=?").bind(linked.id).all<{group_id:number}>()).results?.map(x=>x.group_id)??[];
  const revoked=await e.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE account_id=? AND revoked_at IS NULL").bind(linked.id).run();
  await e.DB.prepare("DELETE FROM account_groups WHERE account_id=?").bind(linked.id).run();
  await e.DB.prepare(`INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,subject_player_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),a.id,a.display_name,"account.discord_disconnected","account",String(linked.id),playerId,"web",JSON.stringify({player_id:playerId,discord,group_ids:groups}),JSON.stringify({discord:null,account_removed:true,group_ids:[]}),JSON.stringify({reason,sessions_revoked:Number(revoked.meta?.changes??0),groups_removed:groups.length,player_preserved:true,login_account_removed:true})).run();
  await e.DB.prepare("DELETE FROM accounts WHERE id=? AND is_owner=0").bind(linked.id).run();
};
const disconnect=async(r:Request,e:Env,playerId:number)=>{
  const auth=await authorised(r,e,"accounts.manage");if(auth.response)return auth.response;const a=auth.actor!;
  const p=await e.DB.prepare("SELECT id,display_name FROM players WHERE id=?").bind(playerId).first<{id:number;display_name:string}>();if(!p)return new Response("Player not found",{status:404});
  const linked=await linkedAccount(e,playerId);if(!linked)return new Response("No linked account",{status:400});if(linked.is_owner)return redirect(`/players/${playerId}?disconnecterror=owner`,r);
  await removeLogin(e,a,playerId,linked,"manual_disconnect");
  return redirect(`/leadership/players/${playerId}?discord=disconnected`,r);
};
const deactivatePlayer=async(r:Request,e:Env,playerId:number)=>{
  const auth=await authorised(r,e,"players.manage_membership");if(auth.response)return auth.response;const a=auth.actor!;
  const p=await e.DB.prepare("SELECT id,display_name,is_active,left_at FROM players WHERE id=? LIMIT 1").bind(playerId).first<Player>();
  if(!p)return new Response("Player not found",{status:404});
  const linked=await linkedAccount(e,playerId);
  if(linked?.is_owner)return new Response("The Owner cannot be moved to Former Players while their Owner account is linked. Transfer ownership first.",{status:400});
  if(linked)await removeLogin(e,a,playerId,linked,"player_moved_to_former_members");
  await e.DB.prepare("UPDATE players SET is_active=0,left_at=COALESCE(left_at,date('now')),updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(playerId).run();
  await e.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,subject_player_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,a.display_name,"player.deactivated","player",String(playerId),playerId,"web",JSON.stringify({is_active:p.is_active,left_at:p.left_at}),JSON.stringify({is_active:0}),JSON.stringify({discord_login_removed:!!linked,access_groups_cleared:!!linked})).run();
  return redirect("/leadership/players?show=inactive",r);
};
const formerByUpdate=async(r:Request,e:Env,playerId:number)=>{
  const auth=await authorised(r,e,"players.manage_membership");if(auth.response)return auth.response;const a=auth.actor!;
  const linked=await linkedAccount(e,playerId);
  if(linked?.is_owner)return new Response("The Owner cannot be moved to Former Players while their Owner account is linked. Transfer ownership first.",{status:400});
  const response=await (app as any).fetch(r,e);
  if(response instanceof Response&&response.status>=300&&response.status<400&&linked)await removeLogin(e,a,playerId,linked,"player_moved_to_former_members");
  return response;
};
export default {async fetch(request:Request,env:Env):Promise<Response>{
  const u=new URL(request.url),disconnectMatch=u.pathname.match(/^\/players\/(\d+)\/disconnect-discord$/);
  if(request.method==="POST"&&disconnectMatch)return disconnect(request,env,Number(disconnectMatch[1]));
  const deactivateMatch=u.pathname.match(/^\/players\/(\d+)\/deactivate$/);
  if(request.method==="POST"&&deactivateMatch)return deactivatePlayer(request,env,Number(deactivateMatch[1]));
  const updateMatch=u.pathname.match(/^\/players\/(\d+)\/update$/);
  if(request.method==="POST"&&updateMatch){const f=await request.clone().formData();if(String(f.get("left_at")||"").trim())return formerByUpdate(request,env,Number(updateMatch[1]));}
  return (app as any).fetch(request,env);
}} satisfies ExportedHandler<Env>;
