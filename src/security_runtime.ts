import runtime from "./runtime";
import securityDashboard from "./security_header_polish";
import accountLifecycle from "./account_lifecycle";
import playersPreview from "./leadership_players_preview";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url);

    // The validated consolidated Players implementation currently lives behind
    // the preview adapter because that adapter also carries the finished Players
    // presentation (filters, import button, account badges and rank artwork).
    // Route the canonical Leadership URL through it while the old wrappers remain
    // available as a rollback point.
    if(url.pathname==="/leadership/players" || url.pathname.startsWith("/leadership/players/")){
      const previewUrl=new URL(request.url);
      previewUrl.pathname=url.pathname.replace(/^\/leadership\/players/,"/leadership/players-preview") || "/leadership/players-preview";
      const response=await (playersPreview as any).fetch(new Request(previewUrl.toString(),request),env,ctx);
      const location=response.headers.get("location");
      if(location){
        const target=new URL(location);
        if(target.pathname.startsWith("/leadership/players-preview")){
          target.pathname=target.pathname.replace(/^\/leadership\/players-preview/,"/leadership/players") || "/leadership/players";
          const headers=new Headers(response.headers);headers.set("location",target.toString());
          return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
        }
      }
      if(response.headers.get("content-type")?.includes("text/html")){
        const body=(await response.text()).replaceAll("/leadership/players-preview","/leadership/players");
        return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
      }
      return response;
    }

    if(url.pathname==="/leadership/players-preview" || url.pathname.startsWith("/leadership/players-preview/")){
      return (playersPreview as any).fetch(request,env,ctx);
    }

    if(request.method==="GET" && url.pathname==="/leadership/security"){
      const rewritten=new URL(request.url);
      rewritten.pathname="/security/access";
      return (securityDashboard as any).fetch(new Request(rewritten.toString(),request),env,ctx);
    }
    if(request.method==="GET" && (url.pathname==="/security/access" || url.pathname==="/security-access")){
      return Response.redirect(new URL("/leadership/security",request.url),302);
    }

    if(request.method==="GET" && (url.pathname==="/players" || url.pathname.startsWith("/players/"))){
      const target=new URL(request.url);
      target.pathname=url.pathname.replace(/^\/players/,"/leadership/players") || "/leadership/players";
      return Response.redirect(target,302);
    }

    // Keep legacy POST actions during the consolidation window. They remain a
    // compatibility path for any old forms/bookmarks until the old wrappers are
    // removed after the canonical route has been verified in production.
    if(request.method==="POST" && url.pathname.startsWith("/players/")){
      return (accountLifecycle as any).fetch(request,env,ctx);
    }

    return (runtime as any).fetch(request,env,ctx);
  }
} satisfies ExportedHandler<Env>;
