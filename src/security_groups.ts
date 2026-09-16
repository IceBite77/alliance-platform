import app from "./security_header_polish";
import {playerActor,playerPermitted,playerSameOrigin} from "./player_access";

interface Env { DB:D1Database; APP_URL:string }
const redirect=(request:Request,value:string)=>Response.redirect(new URL(`/leadership/security?${value}`,request.url),303);
const slug=()=>`group-${crypto.randomUUID()}`;
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const audit=async(env:Env,actor:{id:number;display_name:string},action:string,groupId:number,oldValues:unknown,newValues:unknown)=>env.DB.prepare(`INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),actor.id,actor.display_name,action,"permission_group",String(groupId),"web",oldValues===null?null:JSON.stringify(oldValues),newValues===null?null:JSON.stringify(newValues)).run();
const canManage=async(env:Env,actor:{id:number;display_name:string;is_owner:number})=>actor.is_owner===1||await playerPermitted(env,actor,"permissions.manage");

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(request.url);
  if(request.method==="POST"&&url.pathname==="/security/access/groups/create"){
    const actor=await playerActor(request,env);if(!actor)return Response.redirect(new URL("/login",request.url),302);
    if(!playerSameOrigin(request,env)||!await canManage(env,actor))return new Response("Forbidden",{status:403});
    const form=await request.formData(),name=String(form.get("name")||"").trim(),description=String(form.get("description")||"").trim();
    if(!name||name.length>80||description.length>240)return redirect(request,"grouperror=invalid");
    try{const result=await env.DB.prepare("INSERT INTO permission_groups (public_id,name,description,is_system) VALUES (?,?,?,0)").bind(slug(),name,description||null).run();const id=Number(result.meta.last_row_id);await audit(env,actor,"security.group.created",id,null,{name,description:description||null});return Response.redirect(new URL(`/leadership/security/groups/${id}`,request.url),303)}catch{return redirect(request,"grouperror=duplicate")}
  }
  const remove=url.pathname.match(/^\/security\/access\/groups\/(\d+)\/delete$/);
  if(request.method==="POST"&&remove){
    const actor=await playerActor(request,env);if(!actor)return Response.redirect(new URL("/login",request.url),302);
    if(!playerSameOrigin(request,env)||!await canManage(env,actor))return new Response("Forbidden",{status:403});
    const id=Number(remove[1]),group=await env.DB.prepare("SELECT id,name,description,is_system FROM permission_groups WHERE id=? LIMIT 1").bind(id).first<{id:number;name:string;description:string|null;is_system:number}>();
    if(!group)return new Response("Group not found",{status:404});if(group.is_system)return new Response("System groups cannot be deleted",{status:400});
    await audit(env,actor,"security.group.deleted",id,{name:group.name,description:group.description},null);await env.DB.prepare("DELETE FROM permission_groups WHERE id=? AND is_system=0").bind(id).run();return redirect(request,"saved=group-deleted");
  }
  const result=await (app as any).fetch(request,env,ctx);
  if(request.method!=="GET"||url.pathname!=="/security/access"||result.status!==200||!result.headers.get("content-type")?.includes("text/html"))return result;
  const actor=await playerActor(request,env);if(!actor||!await canManage(env,actor))return result;
  const groups=(await env.DB.prepare("SELECT id,name FROM permission_groups ORDER BY CASE public_id WHEN 'group-administrators' THEN 0 WHEN 'group-members' THEN 1 ELSE 2 END,name").all<{id:number;name:string}>()).results??[];
  let body=await result.text();
  for(const group of groups){const heading=`<h3>${esc(group.name)}</h3>`;const linked=`<h3><a href="/leadership/security/groups/${group.id}" style="color:inherit;text-decoration:none">${esc(group.name)}</a></h3>`;body=body.replace(heading,linked)}
  const create=`<details style="margin:0 0 12px;padding:14px 16px;background:#0e1626;border:1px solid #2b3850;border-radius:13px"><summary style="cursor:pointer;font-weight:900">+ Create Access Group</summary><form method="post" action="/security/access/groups/create" style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;margin-top:14px"><input name="name" required maxlength="80" placeholder="Group name" style="min-width:0;border:1px solid #34445f;border-radius:9px;background:#0b1322;color:#eef3ff;padding:10px 11px"><input name="description" maxlength="240" placeholder="Description" style="min-width:0;border:1px solid #34445f;border-radius:9px;background:#0b1322;color:#eef3ff;padding:10px 11px"><button type="submit" style="border:0;border-radius:9px;background:#5865f2;color:white;padding:10px 13px;font-weight:850;cursor:pointer">Create</button></form></details>`;
  body=body.replace('<div class="groups">',`${create}<div class="groups">`);
  const headers=new Headers(result.headers);headers.delete("content-length");return new Response(body,{status:result.status,statusText:result.statusText,headers});
}} satisfies ExportedHandler<Env>;
