import runtime from "./runtime";
import securityDashboard from "./security_dashboard";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

const standardSecurityHeader=async(response:Response,env:Env)=>{
  if(!response.headers.get("content-type")?.includes("text/html")) return response;
  let html=await response.text();
  const alliance=await env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<{name:string;tag:string|null;server_number:number|null}>();
  const rows=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('brand_main_logo','theme_accent','theme_icon')").all<{key:string;value:string}>();
  const settings=Object.fromEntries((rows.results??[]).map(x=>[x.key,x.value]));
  const accent=/^#[0-9a-fA-F]{6}$/.test(settings.theme_accent||"")?settings.theme_accent:"#5865f2";
  const icon=/^#[0-9a-fA-F]{6}$/.test(settings.theme_icon||"")?settings.theme_icon:"#aebddd";
  const mark=settings.brand_main_logo?`<img src="/assets/${encodeURIComponent(settings.brand_main_logo)}" alt="">`:`${esc(alliance?.tag?`[${alliance.tag}]`:"[DuCK]")}`;
  const identity=`${alliance?.tag?`[${esc(alliance.tag)}] · `:""}${alliance?.server_number?`Server #${alliance.server_number}`:"Server not set"}`;
  const header=`<div class="adminbrand standardadminbrand"><div class="brandmark ${settings.brand_main_logo?'has-image':''}">${mark}</div><div class="brandcopy"><strong>${esc(alliance?.name||"Alliance")}</strong><span>${identity}</span></div><div class="crumb"><a href="/leadership">← Leadership Console</a></div></div>`;
  html=html.replace(/<div class="adminbrand">[\s\S]*?<\/div><\/div><section class="hero">/,`${header}<section class="hero">`);
  html=html.replace("</head>",`<style id="security-standard-header">:root{--accent:${accent};--icon:${icon}}.standardadminbrand{gap:13px!important;align-items:center!important;margin-bottom:25px!important;padding:0 0 18px!important;border-bottom:1px solid #2b3850!important}.standardadminbrand .brandmark{width:48px!important;height:48px!important;flex:0 0 48px!important;border-radius:13px!important;background:var(--accent)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-weight:900!important;font-size:.72rem!important;padding:5px!important;overflow:hidden!important}.standardadminbrand .brandmark.has-image{background:transparent!important}.standardadminbrand .brandmark img{width:100%!important;height:100%!important;object-fit:contain!important}.standardadminbrand .brandcopy strong{display:block!important}.standardadminbrand .brandcopy span{display:block!important;color:#90a0bb!important;font-size:.82rem!important;margin-top:2px!important}.standardadminbrand .crumb{margin-left:auto!important}.standardadminbrand .crumb a{color:var(--icon)!important;text-decoration:none!important;font-weight:700!important}</style></head>`);
  const headers=new Headers(response.headers);headers.delete("content-length");
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
};

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const url=new URL(request.url);
    if(request.method==="GET" && url.pathname==="/leadership/security"){
      const rewritten=new URL(request.url);
      rewritten.pathname="/security/access";
      const response=await (securityDashboard as any).fetch(new Request(rewritten.toString(),request),env,ctx);
      return standardSecurityHeader(response,env);
    }
    if(request.method==="GET" && (url.pathname==="/security/access" || url.pathname==="/security-access")){
      return Response.redirect(new URL("/leadership/security",request.url),302);
    }
    return (runtime as any).fetch(request,env,ctx);
  }
} satisfies ExportedHandler<Env>;
