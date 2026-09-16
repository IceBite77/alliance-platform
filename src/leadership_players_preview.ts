import currentUi from "./runtime";
import {playerActor,playerIsAdministrator,playerRedirect} from "./player_access";
import {deactivatePlayerMembership,reactivatePlayerMembership,disconnectPlayerLogin} from "./player_membership";

interface Env { DB:D1Database; APP_URL:string }
const PREVIEW="/leadership/players-preview";
const LIVE="/leadership/players";

const rewriteForCurrentUi=(request:Request)=>{const url=new URL(request.url);url.pathname=url.pathname.replace(PREVIEW,"/players");return new Request(url.toString(),request)};

// The proven Players presentation still contains several old owner-only session
// predicates deep in its decorator chain. Leadership access is now checked once
// here. This compatibility DB view removes only those obsolete owner predicates,
// so Owner and Administrator run through the exact same Players UI while the old
// decorators are retired safely rather than maintaining two different pages.
const leadershipUiEnv=(env:Env)=>{
  const db=new Proxy(env.DB as any,{
    get(target,prop,receiver){
      if(prop==="prepare")return (sql:string)=>target.prepare(String(sql)
        .replaceAll(" AND a.is_owner=1 LIMIT 1"," LIMIT 1")
        .replaceAll(" AND a.is_owner = 1 LIMIT 1"," LIMIT 1")
        .replaceAll(" AND a.is_owner=1",""));
      const value=Reflect.get(target,prop,receiver);return typeof value==="function"?value.bind(target):value;
    }
  });
  return new Proxy(env as any,{get(target,prop,receiver){if(prop==="DB")return db;return Reflect.get(target,prop,receiver)}});
};

const rewriteResponse=async(response:Response)=>{
  const location=response.headers.get("location");
  if(location){const url=new URL(location);if(url.pathname.startsWith(LIVE))url.pathname=url.pathname.replace(LIVE,PREVIEW);else if(url.pathname.startsWith("/players"))url.pathname=url.pathname.replace("/players",PREVIEW);else return response;const headers=new Headers(response.headers);headers.set("location",url.toString());return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}
  if(!response.headers.get("content-type")?.includes("text/html"))return response;
  let body=await response.text();
  body=body.replaceAll(LIVE,PREVIEW).replaceAll('href="/players','href="'+PREVIEW).replaceAll('action="/players','action="'+PREVIEW);
  return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
};

export default {async fetch(request:Request,env:Env,ctx?:ExecutionContext):Promise<Response>{
  const path=new URL(request.url).pathname;
  const actor=await playerActor(request,env);if(!actor)return playerRedirect("/login",request);
  if(!await playerIsAdministrator(env,actor))return new Response("Forbidden",{status:403});

  const deactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/deactivate$/);
  if(request.method==="POST"&&deactivate){const result=await deactivatePlayerMembership(request,env,actor,Number(deactivate[1]));if(result)return result;return playerRedirect(`${PREVIEW}?show=inactive`,request)}
  const reactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/reactivate$/);
  if(request.method==="POST"&&reactivate){const result=await reactivatePlayerMembership(request,env,actor,Number(reactivate[1]));if(result)return result;return playerRedirect(`${PREVIEW}/${Number(reactivate[1])}?saved=1`,request)}
  const disconnect=path.match(/^\/leadership\/players-preview\/(\d+)\/disconnect-discord$/);
  if(request.method==="POST"&&disconnect){const result=await disconnectPlayerLogin(request,env,actor,Number(disconnect[1]));if(result)return result;return playerRedirect(`${PREVIEW}/${Number(disconnect[1])}?discord=disconnected`,request)}

  return rewriteResponse(await (currentUi as any).fetch(rewriteForCurrentUi(request),leadershipUiEnv(env),ctx));
}} satisfies ExportedHandler<Env>;
