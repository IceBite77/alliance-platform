import runtime from "./leadership_access";
import securityDashboard from "./security_groups";
import securityGroupPage from "./security_group_page";
import accountLifecycle from "./account_lifecycle";
import playersPreview from "./leadership_players_preview";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

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

    if(request.method==="GET" && (url.pathname==="/players" || url.pathname.startsWith("/players/"))){const target=new URL(request.url);target.pathname=url.pathname.replace(/^\/players/,"/leadership/players")||"/leadership/players";return Response.redirect(target,302);}
    if(request.method==="POST" && url.pathname.startsWith("/players/"))return (accountLifecycle as any).fetch(request,env,ctx);
    return (runtime as any).fetch(request,env,ctx);
  }
} satisfies ExportedHandler<Env>;
