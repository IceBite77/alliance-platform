import runtime from "./runtime";
import leadershipApp from "./security_access";
import {playerActor} from "./player_access";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

const hasLeadershipAccess=async(env:Env,accountId:number,isOwner:number)=>{
  if(isOwner===1)return true;
  const row=await env.DB.prepare(`SELECT 1 AS ok FROM account_groups ag WHERE ag.account_id=? LIMIT 1`).bind(accountId).first<{ok:number}>();
  return !!row;
};

const withHtml=(res:Response,html:string)=>{const headers=new Headers(res.headers);headers.delete("content-length");return new Response(html,{status:res.status,statusText:res.statusText,headers})};

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(request.url),actor=await playerActor(request,env).catch(()=>null);
  const leadership=actor?await hasLeadershipAccess(env,actor.id,actor.is_owner):false;

  if(request.method==="GET"&&url.pathname==="/leadership"){
    if(!actor)return Response.redirect(new URL("/login",request.url),302);
    if(!leadership)return new Response("Forbidden",{status:403});
    const rewritten=new URL(request.url);rewritten.pathname="/";
    return (leadershipApp as any).fetch(new Request(rewritten.toString(),request),env,ctx);
  }

  const response=await (runtime as any).fetch(request,env,ctx);
  if(request.method!=="GET"||url.pathname!=="/"||!leadership||!(response instanceof Response)||response.status!==200||!response.headers.get("content-type")?.includes("text/html"))return response;
  let html=await response.text();
  if(!html.includes('class="leadership"')){
    const card=`<a class="leadership" href="/leadership"><strong>Leadership Console</strong><span>Management, operations and alliance settings →</span></a>`;
    html=html.replace('<div class="footer">',`${card}<div class="footer">`);
  }
  return withHtml(response,html);
}} satisfies ExportedHandler<Env>;
