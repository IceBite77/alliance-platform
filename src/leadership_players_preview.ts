import players from "./leadership_players";
import {playerActor,playerRedirect} from "./player_access";
import {deactivatePlayerMembership,reactivatePlayerMembership,disconnectPlayerLogin} from "./player_membership";

interface Env { DB:D1Database; APP_URL:string }

const PREVIEW="/leadership/players-preview";
const LIVE="/leadership/players";

const rewriteRequest=(request:Request)=>{
  const url=new URL(request.url);
  url.pathname=url.pathname.replace(PREVIEW,LIVE);
  return new Request(url.toString(),request);
};

const rewriteResponse=async(response:Response)=>{
  const location=response.headers.get("location");
  if(location){
    const url=new URL(location);
    if(url.pathname.startsWith(LIVE)){
      url.pathname=url.pathname.replace(LIVE,PREVIEW);
      const headers=new Headers(response.headers);headers.set("location",url.toString());
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    return response;
  }
  if(!response.headers.get("content-type")?.includes("text/html"))return response;
  const body=(await response.text()).replaceAll(LIVE,PREVIEW);
  return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
};

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;
  const actor=await playerActor(request,env);if(!actor)return playerRedirect("/login",request);
  const deactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/deactivate$/);
  if(request.method==="POST"&&deactivate){
    const result=await deactivatePlayerMembership(request,env,actor,Number(deactivate[1]));
    if(result)return result;
    return playerRedirect(`${PREVIEW}?show=inactive`,request);
  }
  const reactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/reactivate$/);
  if(request.method==="POST"&&reactivate){
    const result=await reactivatePlayerMembership(request,env,actor,Number(reactivate[1]));
    if(result)return result;
    return playerRedirect(`${PREVIEW}/${Number(reactivate[1])}?saved=1`,request);
  }
  const disconnect=path.match(/^\/leadership\/players-preview\/(\d+)\/disconnect-discord$/);
  if(request.method==="POST"&&disconnect){
    const result=await disconnectPlayerLogin(request,env,actor,Number(disconnect[1]));
    if(result)return result;
    return playerRedirect(`${PREVIEW}/${Number(disconnect[1])}?discord=disconnected`,request);
  }
  return rewriteResponse(await (players as any).fetch(rewriteRequest(request),env));
}} satisfies ExportedHandler<Env>;
