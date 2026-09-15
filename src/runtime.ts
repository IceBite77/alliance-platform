import app from "./security_access";

interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  APP_URL: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  DISCORD_BOT_TOKEN: string;
  SETUP_KEY: string;
  AUTH_SECRET: string;
}

const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

const polishPending=async(res:Response,env:Env)=>{
  if(!res.headers.get("content-type")?.includes("text/html")) return res;
  let html=await res.text();
  const alliance=await env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1 LIMIT 1").first<{name:string;tag:string|null;server_number:number|null}>().catch(()=>null);
  const name=alliance?.name||"Alliance Platform";
  const identity=`${alliance?.tag?`[${esc(alliance.tag)}] · `:""}${alliance?.server_number?`Server #${alliance.server_number}`:""}`;
  html=html.replace('<div class="duck">🦆</div>','<div class="pendingbrand"><img src="/assets/branding/icons/master.png" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><span class="brandfallback" style="display:none">AMP</span></div>');
  html=html.replace('<a href="/auth/logout">Sign out</a>',`<a class="pendingSignout" href="/auth/logout">Sign out</a><div class="pendingfooter"><strong>${esc(name)}</strong><span>${identity?`${identity} · `:""}The Alliance Management Platform</span></div>`);
  html=html.replace('</head>',`<style>
    .duck{display:none}.pendingbrand{width:76px;height:76px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center}.pendingbrand img{display:block;max-width:76px;max-height:76px;object-fit:contain}.brandfallback{width:70px;height:70px;border-radius:17px;background:linear-gradient(145deg,#5865f2,#3442a7);align-items:center;justify-content:center;font-weight:900}.pendingSignout{display:inline-block;margin-top:4px;padding:12px 22px;border-radius:11px;background:#5865f2;color:#fff!important;font-weight:800;text-decoration:none}.pendingfooter{display:flex;justify-content:space-between;gap:14px;margin-top:28px;padding-top:17px;border-top:1px solid #2b3850;color:#8292ae;font-size:.78rem;text-align:left}.pendingfooter strong{color:#aebddd}.pendingfooter span{text-align:right}@media(max-width:650px){.pendingfooter{display:block;text-align:center}.pendingfooter span{display:block;text-align:center;margin-top:5px}}
  </style></head>`);
  const headers=new Headers(res.headers);headers.delete("content-length");
  return new Response(html,{status:res.status,statusText:res.statusText,headers});
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url=new URL(request.url);
    // The original dashboard card used /security-access. Keep it as a compatibility
    // route, but send it to the real Security & Access controller where approvals live.
    if(url.pathname==="/security-access") return Response.redirect(new URL("/security/access",request.url),302);

    const result = await (app as any).fetch(request, env);
    if (result instanceof Response) {
      if(url.pathname==="/pending") return polishPending(result,env);
      return result;
    }
    if (typeof result === "string") {
      return new Response(result, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store",
          "x-frame-options": "DENY",
          "referrer-policy": "no-referrer"
        }
      });
    }
    throw new TypeError("Worker handler did not return a Response");
  }
} satisfies ExportedHandler<Env>;
