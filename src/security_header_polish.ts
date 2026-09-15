import app from "./security_dashboard";

interface Env { DB:D1Database; }

const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const response=await (app as any).fetch(request,env,ctx);
    if(!(response instanceof Response)||!response.headers.get("content-type")?.includes("text/html"))return response;
    const url=new URL(request.url);
    if(url.pathname!=="/security/access")return response;

    let html=await response.text();
    const alliance=await env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<{name:string;tag:string|null;server_number:number|null}>();
    const s=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('brand_main_logo','theme_accent','theme_icon')").all<{key:string;value:string}>();
    const settings=Object.fromEntries((s.results??[]).map(x=>[x.key,x.value]));
    const accent=/^#[0-9a-fA-F]{6}$/.test(settings.theme_accent||"")?settings.theme_accent:"#5865f2";
    const icon=/^#[0-9a-fA-F]{6}$/.test(settings.theme_icon||"")?settings.theme_icon:"#aebddd";
    const mark=settings.brand_main_logo?`<img src="/assets/${encodeURIComponent(settings.brand_main_logo)}" alt="">`:`${esc(alliance?.tag?`[${alliance.tag}]`:"[DuCK]")}`;
    const identity=`${alliance?.tag?`[${esc(alliance.tag)}] · `:""}${alliance?.server_number?`Server #${alliance.server_number}`:"Server not set"}`;

    html=html.replace(/<div class="adminbrand">[\s\S]*?<\/div><section class="hero">/,`<div class="adminbrand"><div class="brandmark">${mark}</div><div class="brandcopy"><strong>${esc(alliance?.name||"Alliance")}</strong><span>${identity}</span></div><div class="crumb"><a href="/leadership">Leadership Console</a></div></div><section class="hero">`);
    html=html.replace("</head>",`<style id="standard-leadership-shell">:root{--accent:${accent};--icon:${icon}}body{padding:24px!important}main{width:min(94vw,1120px)!important;margin:28px auto!important;background:#151d2e!important;border:1px solid #2b3850!important;border-radius:20px!important;padding:30px!important;box-shadow:0 24px 70px rgba(0,0,0,.35)!important}.adminbrand{display:flex!important;gap:13px!important;align-items:center!important;margin-bottom:25px!important;padding:0 0 18px!important;border-bottom:1px solid #2b3850!important}.brandmark{width:48px!important;height:48px!important;flex:0 0 48px!important;border-radius:13px!important;background:var(--accent)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-weight:900!important;font-size:.72rem!important;padding:5px!important;overflow:hidden!important}.brandmark:has(img){background:transparent!important}.brandmark img{width:100%!important;height:100%!important;object-fit:contain!important}.brandcopy strong{display:block!important}.brandcopy span{display:block!important;color:#90a0bb!important;font-size:.82rem!important;margin-top:2px!important}.crumb{margin-left:auto!important}.crumb a{color:var(--icon)!important;text-decoration:none!important;font-weight:700!important}.hero{padding:0!important;margin:0 0 18px!important}.hero .step{font-size:.82rem!important;margin-bottom:8px!important}.hero h1{margin:0 0 8px!important;font-size:1.8rem!important}.hero p{margin:0!important;color:#b8c4d9!important;line-height:1.5!important}.summary{margin:22px 0!important}.card{background:#0e1626!important;border:1px solid #2b3850!important;border-radius:14px!important}.group,.permcat{background:#111b2e!important}@media(max-width:700px){body{padding:12px!important}main{padding:20px!important;margin:8px auto!important}.crumb{display:none!important}}</style></head>`);
    const headers=new Headers(response.headers);headers.delete("content-length");
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
} satisfies ExportedHandler<Env>;
