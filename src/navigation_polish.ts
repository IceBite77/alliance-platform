import app from "./player_save_fix";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

const normalize=(v:unknown)=>v instanceof Response?v:new Response(String(v??""),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const res=normalize(await (app as any).fetch(request,env));
    if(!res.headers.get("content-type")?.includes("text/html")) return res;
    let html=await res.text();
    html=html.replaceAll(">← Dashboard<",">← Leadership Console<");
    html=html.replaceAll(">Back to dashboard<",">Back to Leadership Console<");
    return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});
  }
} satisfies ExportedHandler<Env>;
