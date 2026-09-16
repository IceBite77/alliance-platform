import runtime from "./leadership_access";
import securityDashboard from "./security_groups";
import securityGroupPage from "./security_group_page";
import accountLifecycle from "./account_lifecycle";
import playersPreview from "./leadership_players_preview";
import {playerActor,playerPermitted} from "./player_access";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

const settingsInternal=(path:string)=>{
  if(path==="/leadership/settings")return "/settings/alliance";
  if(path==="/leadership/settings/details")return "/settings/alliance/details";
  if(path==="/leadership/settings/branding")return "/settings/alliance/branding";
  if(path==="/leadership/settings/discord")return "/settings/discord";
  if(path==="/leadership/settings/ranks")return "/settings/ranks";
  if(path==="/leadership/settings/players")return "/settings/players";
  return null;
};
const settingsCanonical=(path:string)=>{
  if(path==="/settings/alliance"||path==="/leadership/settings/alliance")return "/leadership/settings";
  if(path==="/settings/alliance/details"||path==="/leadership/settings/alliance/details")return "/leadership/settings/details";
  if(path==="/settings/alliance/branding"||path==="/leadership/settings/alliance/branding")return "/leadership/settings/branding";
  if(path==="/settings/discord")return "/leadership/settings/discord";
  if(path==="/settings/ranks")return "/leadership/settings/ranks";
  if(path==="/settings/players")return "/leadership/settings/players";
  return null;
};
const rewriteSettingsHtml=(html:string)=>html
  .replaceAll('href="/settings/alliance/details"','href="/leadership/settings/details"')
  .replaceAll('action="/settings/alliance/details"','action="/leadership/settings/details"')
  .replaceAll('href="/settings/alliance/branding"','href="/leadership/settings/branding"')
  .replaceAll('action="/settings/alliance/branding"','action="/leadership/settings/branding"')
  .replaceAll('href="/settings/alliance"','href="/leadership/settings"')
  .replaceAll('action="/settings/alliance"','action="/leadership/settings"')
  .replaceAll('href="/settings/discord"','href="/leadership/settings/discord"')
  .replaceAll('action="/settings/discord"','action="/leadership/settings/discord"')
  .replaceAll('href="/settings/ranks"','href="/leadership/settings/ranks"')
  .replaceAll('action="/settings/ranks"','action="/leadership/settings/ranks"')
  .replaceAll('href="/settings/players"','href="/leadership/settings/players"')
  .replaceAll('action="/settings/players"','action="/leadership/settings/players"');

const leadershipAdminEnv=(env:Env)=>{
  const db=new Proxy(env.DB as any,{get(target,prop,receiver){
    if(prop==="prepare")return (sql:string)=>target.prepare(String(sql)
      .replaceAll(" AND a.is_owner=1 LIMIT 1"," LIMIT 1")
      .replaceAll(" AND a.is_owner = 1 LIMIT 1"," LIMIT 1")
      .replaceAll(" AND a.is_owner=1","");
    const value=Reflect.get(target,prop,receiver);return typeof value==="function"?value.bind(target):value;
  }});
  return new Proxy(env as any,{get(target,prop,receiver){if(prop==="DB")return db;return Reflect.get(target,prop,receiver)}});
};

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url);

    const accountAction=url.pathname.match(/^\/leadership\/players\/(\d+)\/(link-my-account|unlink-my-account|disable-login|enable-login)$/);
    if(request.method==="POST" && accountAction){
      const rewritten=new URL(request.url);rewritten.pathname=`/players/${accountAction[1]}/${accountAction[2]}`;
      const response=await (accountLifecycle as any).fetch(new Request(rewritten.toString(),request),env,ctx);
      const location=response.headers.get("location");
      if(location){const target=new URL(location);if(target.pathname.startsWith("/players")){target.pathname=target.pathname.replace(/^\/players/,"/leadership/players")||"/leadership/players";const headers=new Headers(response.headers);headers.set("location",target.toString());return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}}
      return response;
    }

    if(url.pathname==="/leadership/players" || url.pathname.startsWith("/leadership/players/")){
      const previewUrl=new URL(request.url);previewUrl.pathname=url.pathname.replace(/^\/leadership\/players/,"/leadership/players-preview")||"/leadership/players-preview";
      const response=await (playersPreview as any).fetch(new Request(previewUrl.toString(),request),env,ctx);
      const location=response.headers.get("location");
      if(location){const target=new URL(location);if(target.pathname.startsWith("/leadership/players-preview")){target.pathname=target.pathname.replace(/^\/leadership\/players-preview/,"/leadership/players")||"/leadership/players";const headers=new Headers(response.headers);headers.set("location",target.toString());return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}}
      if(response.headers.get("content-type")?.includes("text/html")){const body=(await response.text()).replaceAll("/leadership/players-preview","/leadership/players");return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});}
      return response;
    }

    if(url.pathname==="/leadership/players-preview" || url.pathname.startsWith("/leadership/players-preview/"))return (playersPreview as any).fetch(request,env,ctx);

    if(/^\/leadership\/security\/groups\/\d+(?:\/members(?:\/\d+\/remove|\/add)|\/permissions\/save)?$/.test(url.pathname))return (securityGroupPage as any).fetch(request,env,ctx);
    if(request.method==="GET" && url.pathname==="/leadership/security"){
      const rewritten=new URL(request.url);rewritten.pathname="/security/access";
      return (securityDashboard as any).fetch(new Request(rewritten.toString(),request),env,ctx);
    }
    if(request.method==="POST" && url.pathname.startsWith("/leadership/security/")){
      const rewritten=new URL(request.url);rewritten.pathname=url.pathname.replace(/^\/leadership\/security/,"/security/access");
      return (securityDashboard as any).fetch(new Request(rewritten.toString(),request),env,ctx);
    }
    if(request.method==="GET" && (url.pathname==="/security/access" || url.pathname==="/security-access"))return Response.redirect(new URL("/leadership/security",request.url),302);

    const legacySettings=settingsCanonical(url.pathname);
    if(request.method==="GET"&&legacySettings&&url.pathname!==legacySettings){const target=new URL(request.url);target.pathname=legacySettings;return Response.redirect(target,302)}

    const internalSettings=settingsInternal(url.pathname);
    if(internalSettings){
      const actor=await playerActor(request,env);if(!actor)return Response.redirect(new URL("/login",request.url),302);
      if(!await playerPermitted(env,actor,"settings.manage"))return new Response("Forbidden",{status:403});
      const rewritten=new URL(request.url);rewritten.pathname=internalSettings;
      const response=await (runtime as any).fetch(new Request(rewritten.toString(),request),leadershipAdminEnv(env),ctx);
      const location=response.headers.get("location");
      if(location){const target=new URL(location),canonical=settingsCanonical(target.pathname);if(canonical){target.pathname=canonical;const headers=new Headers(response.headers);headers.set("location",target.toString());return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}}
      if(response.headers.get("content-type")?.includes("text/html")){const body=rewriteSettingsHtml(await response.text());return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});}
      return response;
    }

    if(request.method==="GET" && (url.pathname==="/players" || url.pathname.startsWith("/players/"))){const target=new URL(request.url);target.pathname=url.pathname.replace(/^\/players/,"/leadership/players")||"/leadership/players";return Response.redirect(target,302);}
    if(request.method==="POST" && url.pathname.startsWith("/players/"))return (accountLifecycle as any).fetch(request,env,ctx);
    return (runtime as any).fetch(request,env,ctx);
  }
} satisfies ExportedHandler<Env>;
