import runtime from "./runtime";
import securityDashboard from "./security_header_polish";
import accountLifecycle from "./account_lifecycle";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url);

    if(request.method==="GET" && url.pathname==="/leadership/security"){
      const rewritten=new URL(request.url);
      rewritten.pathname="/security/access";
      return (securityDashboard as any).fetch(new Request(rewritten.toString(),request),env,ctx);
    }
    if(request.method==="GET" && (url.pathname==="/security/access" || url.pathname==="/security-access")){
      return Response.redirect(new URL("/leadership/security",request.url),302);
    }

    if(url.pathname==="/leadership/players" || url.pathname.startsWith("/leadership/players/")){
      const rewritten=new URL(request.url);
      rewritten.pathname=url.pathname.replace(/^\/leadership\/players/,"/players") || "/players";
      const internalRequest=new Request(rewritten.toString(),request);
      if(request.method==="POST") return (accountLifecycle as any).fetch(internalRequest,env,ctx);
      return (runtime as any).fetch(internalRequest,env,ctx);
    }
    if(request.method==="GET" && (url.pathname==="/players" || url.pathname.startsWith("/players/"))){
      const target=new URL(request.url);
      target.pathname=url.pathname.replace(/^\/players/,"/leadership/players") || "/leadership/players";
      return Response.redirect(target,302);
    }

    if(request.method==="POST" && url.pathname.startsWith("/players/")){
      return (accountLifecycle as any).fetch(request,env,ctx);
    }

    return (runtime as any).fetch(request,env,ctx);
  }
} satisfies ExportedHandler<Env>;
