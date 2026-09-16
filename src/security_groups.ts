import app from "./security_header_polish";
import {playerActor,playerPermitted,playerSameOrigin} from "./player_access";

interface Env { DB:D1Database; APP_URL:string }

const redirect=(request:Request,value:string)=>Response.redirect(new URL(`/leadership/security?${value}`,request.url),303);
const slug=()=>`group-${crypto.randomUUID()}`;

const audit=async(env:Env,actor:{id:number;display_name:string},action:string,groupId:number,oldValues:unknown,newValues:unknown)=>{
  await env.DB.prepare(`INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),actor.id,actor.display_name,action,"permission_group",String(groupId),"web",oldValues===null?null:JSON.stringify(oldValues),newValues===null?null:JSON.stringify(newValues)).run();
};

const canManage=async(env:Env,actor:{id:number;display_name:string;is_owner:number})=>actor.is_owner===1||await playerPermitted(env,actor,"permissions.manage");

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(request.url);
  if(request.method==="POST"&&url.pathname==="/security/access/groups/create"){
    const actor=await playerActor(request,env);if(!actor)return Response.redirect(new URL("/login",request.url),302);
    if(!playerSameOrigin(request,env)||!await canManage(env,actor))return new Response("Forbidden",{status:403});
    const form=await request.formData(),name=String(form.get("name")||"").trim(),description=String(form.get("description")||"").trim();
    if(!name||name.length>80||description.length>240)return redirect(request,"grouperror=invalid");
    try{
      const result=await env.DB.prepare("INSERT INTO permission_groups (public_id,name,description,is_system) VALUES (?,?,?,0)").bind(slug(),name,description||null).run();
      const id=Number(result.meta.last_row_id);await audit(env,actor,"security.group.created",id,null,{name,description:description||null});
      return redirect(request,"saved=group-created");
    }catch{return redirect(request,"grouperror=duplicate")}
  }
  const remove=url.pathname.match(/^\/security\/access\/groups\/(\d+)\/delete$/);
  if(request.method==="POST"&&remove){
    const actor=await playerActor(request,env);if(!actor)return Response.redirect(new URL("/login",request.url),302);
    if(!playerSameOrigin(request,env)||!await canManage(env,actor))return new Response("Forbidden",{status:403});
    const id=Number(remove[1]),group=await env.DB.prepare("SELECT id,name,description,is_system FROM permission_groups WHERE id=? LIMIT 1").bind(id).first<{id:number;name:string;description:string|null;is_system:number}>();
    if(!group)return new Response("Group not found",{status:404});if(group.is_system)return new Response("System groups cannot be deleted",{status:400});
    await audit(env,actor,"security.group.deleted",id,{name:group.name,description:group.description},null);
    await env.DB.prepare("DELETE FROM permission_groups WHERE id=? AND is_system=0").bind(id).run();
    return redirect(request,"saved=group-deleted");
  }
  return (app as any).fetch(request,env,ctx);
}} satisfies ExportedHandler<Env>;
