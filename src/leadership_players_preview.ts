import players from "./leadership_players";
import currentUi from "./runtime";
import {playerActor,playerRedirect} from "./player_access";
import {deactivatePlayerMembership,reactivatePlayerMembership,disconnectPlayerLogin} from "./player_membership";

interface Env { DB:D1Database; APP_URL:string }
const PREVIEW="/leadership/players-preview";
const LIVE="/leadership/players";

const rewriteForNew=(request:Request)=>{const url=new URL(request.url);url.pathname=url.pathname.replace(PREVIEW,LIVE);return new Request(url.toString(),request)};
const rewriteForCurrentUi=(request:Request)=>{const url=new URL(request.url);url.pathname=url.pathname.replace(PREVIEW,"/players");return new Request(url.toString(),request)};

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
  const deactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/deactivate$/);
  if(request.method==="POST"&&deactivate){const result=await deactivatePlayerMembership(request,env,actor,Number(deactivate[1]));if(result)return result;return playerRedirect(`${PREVIEW}?show=inactive`,request)}
  const reactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/reactivate$/);
  if(request.method==="POST"&&reactivate){const result=await reactivatePlayerMembership(request,env,actor,Number(reactivate[1]));if(result)return result;return playerRedirect(`${PREVIEW}/${Number(reactivate[1])}?saved=1`,request)}
  const disconnect=path.match(/^\/leadership\/players-preview\/(\d+)\/disconnect-discord$/);
  if(request.method==="POST"&&disconnect){const result=await disconnectPlayerLogin(request,env,actor,Number(disconnect[1]));if(result)return result;return playerRedirect(`${PREVIEW}/${Number(disconnect[1])}?discord=disconnected`,request)}

  // Owner keeps the proven legacy presentation while the clean Players handler is
  // completed. Non-owner leadership accounts must not pass through the old
  // owner-era wrapper chain because it incorrectly treats their valid session as
  // unauthorised and sends them back to Discord login.
  if(request.method==="GET"&&actor.is_owner)return rewriteResponse(await (currentUi as any).fetch(rewriteForCurrentUi(request),env,ctx));
  return rewriteResponse(await (players as any).fetch(rewriteForNew(request),env));
}} satisfies ExportedHandler<Env>;
