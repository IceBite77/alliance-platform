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
      if(prop==="prepare")return (sql:string)=>target.prepare(
        String(sql)
          .replaceAll(" AND a.is_owner=1 LIMIT 1"," LIMIT 1")
          .replaceAll(" AND a.is_owner = 1 LIMIT 1"," LIMIT 1")
          .replaceAll(" AND a.is_owner=1","")
      );
      const value=Reflect.get(target,prop,receiver);return typeof value==="function"?value.bind(target):value;
    }
  });
  return new Proxy(env as any,{get(target,prop,receiver){if(prop==="DB")return db;return Reflect.get(target,prop,receiver)}});
};

const masterHeaderCss=`<style id="players-leadership-master-header">
/* Players is the visual master for every Leadership page. */
@media(min-width:651px){
  .adminbrand{gap:24px!important;padding:0 0 22px!important;margin-bottom:22px!important;min-height:132px!important;align-items:center!important}
  .adminbrand .brandmark{width:112px!important;height:112px!important;flex:0 0 112px!important;border-radius:0!important;background:transparent!important;padding:0!important}
  .adminbrand .brandmark img{width:100%!important;height:100%!important;object-fit:contain!important}
  .adminbrand .brandcopy strong{font-size:1.72rem!important;line-height:1.12!important;font-weight:900!important}
  .adminbrand .brandcopy span{font-size:1rem!important;margin-top:9px!important;line-height:1.25!important}
  .adminbrand .adminidentitynav{gap:5px!important;min-width:245px!important}
  .adminbrand .signedinidentity{font-size:0!important;line-height:1!important;color:#eef3ff!important;font-weight:900!important}
  .adminbrand .signedinidentity::before{content:'Welcome ' attr(data-player);display:block;font-size:1.22rem!important;line-height:1.15!important;color:#eef3ff!important;font-weight:900!important}
  .adminbrand .signedinidentity::after{content:attr(data-rank);display:block;margin-top:7px;font-size:.78rem!important;line-height:1.2!important;color:#90a0bb!important;font-weight:800!important}
  .adminbrand .crumb{margin-top:11px!important}
  .adminbrand .crumb a{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:9px 13px!important;border:1px solid #34445f!important;border-radius:10px!important;background:#111b2e!important;color:#b9c8e5!important;font-size:.82rem!important;font-weight:850!important;text-decoration:none!important;transition:border-color .15s ease,background .15s ease,transform .15s ease!important}
  .adminbrand .crumb a:hover{border-color:#526b94!important;background:#17243a!important;transform:translateY(-1px)!important;color:#eef3ff!important}
}
</style>`;

const enhanceIdentity=(body:string)=>{
  const match=body.match(/<div class="signedinidentity"([^>]*)>([^<]*)<\/div>/);
  if(!match)return body;
  const text=match[2].trim();
  const parts=text.split(" · ");
  const player=parts.shift()||"";
  const rank=parts.join(" · ")||"";
  const attrs=`${match[1]} data-player="${player.replaceAll('&','&amp;').replaceAll('"','&quot;')}" data-rank="${rank.replaceAll('&','&amp;').replaceAll('"','&quot;')}"`;
  return body.replace(match[0],`<div class="signedinidentity"${attrs}>${match[2]}</div>`);
};

const rewriteResponse=async(response:Response)=>{
  const location=response.headers.get("location");
  if(location){const url=new URL(location);if(url.pathname.startsWith(LIVE))url.pathname=url.pathname.replace(LIVE,PREVIEW);else if(url.pathname.startsWith("/players"))url.pathname=url.pathname.replace("/players",PREVIEW);else return response;const headers=new Headers(response.headers);headers.set("location",url.toString());return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}
  if(!response.headers.get("content-type")?.includes("text/html"))return response;
  let body=await response.text();
  body=body.replaceAll(LIVE,PREVIEW).replaceAll('href="/players','href="'+PREVIEW).replaceAll('action="/players','action="'+PREVIEW);
  body=enhanceIdentity(body);
  body=body.replace("</head>",`${masterHeaderCss}</head>`);
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
