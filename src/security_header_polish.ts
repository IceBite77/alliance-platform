import app from "./security_dashboard";

interface Env { DB:D1Database; }
type Identity={display_name:string;rank:number;rank_name:string|null;show_rank_names:string|null};
const SESSION_COOKIE="ap_session";
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const cookie=(r:Request,n:string)=>{for(const p of(r.headers.get("cookie")??"").split(";")){const [x,...z]=p.trim().split("=");if(x===n)return z.join("=")}return null};
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
const hash=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const identity=async(r:Request,e:Env)=>{const t=cookie(r,SESSION_COOKIE);if(!t)return null;return e.DB.prepare(`SELECT p.display_name,p.rank,ar.display_name AS rank_name,(SELECT value FROM settings WHERE key='show_rank_names' LIMIT 1) AS show_rank_names FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN players p ON p.id=a.player_id LEFT JOIN alliance_ranks ar ON ar.rank_level=p.rank WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 AND a.approval_status='active' LIMIT 1`).bind(await hash(t)).first<Identity>()};

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const response=await (app as any).fetch(request,env,ctx);
    if(!(response instanceof Response)||!response.headers.get("content-type")?.includes("text/html"))return response;
    const url=new URL(request.url);
    if(url.pathname!=="/security/access")return response;

    let html=await response.text();
    const alliance=await env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<{name:string;tag:string|null;server_number:number|null}>();
    const s=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('brand_main_logo','theme_accent','theme_icon')").all<{key:string;value:string}>();
    const who=await identity(request,env).catch(()=>null);
    const settings=Object.fromEntries((s.results??[]).map(x=>[x.key,x.value]));
    const accent=/^#[0-9a-fA-F]{6}$/.test(settings.theme_accent||"")?settings.theme_accent:"#5865f2";
    const icon=/^#[0-9a-fA-F]{6}$/.test(settings.theme_icon||"")?settings.theme_icon:"#aebddd";
    const mark=settings.brand_main_logo?`<img src="/assets/${encodeURIComponent(settings.brand_main_logo)}" alt="">`:`${esc(alliance?.tag?`[${alliance.tag}]`:"[DuCK]")}`;
    const allianceIdentity=`${alliance?.tag?`[${esc(alliance.tag)}] · `:""}${alliance?.server_number?`Server #${alliance.server_number}`:"Server not set"}`;
    const rankTitle=who&&who.show_rank_names!=="0"&&who.rank_name&&who.rank_name!==`R${who.rank}`?` · ${esc(who.rank_name)}`:"";
    const user=who?`<div class="adminidentitynav"><div class="welcome">Welcome ${esc(who.display_name)}</div><div class="signedinidentity">R${who.rank}${rankTitle}</div><div class="crumb"><a href="/leadership">← Leadership Console</a></div></div>`:`<div class="adminidentitynav"><div class="crumb"><a href="/leadership">← Leadership Console</a></div></div>`;

    html=html.replace(/<div class="adminbrand">[\s\S]*?<\/div><section class="hero">/,`<div class="adminbrand"><div class="brandmark">${mark}</div><div class="brandcopy"><strong>${esc(alliance?.name||"Alliance")}</strong><span>${allianceIdentity}</span></div>${user}</div><section class="hero">`);
    html=html.replace("</head>",`<style id="standard-leadership-shell">:root{--accent:${accent};--icon:${icon}}body{padding:24px!important}main{width:min(94vw,1120px)!important;margin:28px auto!important;background:#151d2e!important;border:1px solid #2b3850!important;border-radius:20px!important;padding:30px!important;box-shadow:0 24px 70px rgba(0,0,0,.35)!important}.adminbrand{display:flex!important;align-items:center!important;gap:19px!important;margin-bottom:25px!important;padding:0 0 24px!important;border-bottom:1px solid #2b3850!important}.brandmark{width:94px!important;height:94px!important;flex:0 0 94px!important;border-radius:20px!important;background:var(--accent)!important;display:flex!important;align-items:center!important;justify-content:center!important;font-weight:900!important;padding:0!important;overflow:hidden!important}.brandmark:has(img){background:transparent!important;border-radius:0!important}.brandmark img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}.brandcopy strong,.brandcopy span{display:block!important}.brandcopy strong{font-size:1.42rem!important;line-height:1.2!important}.brandcopy span{color:#90a0bb!important;font-size:1rem!important;margin-top:7px!important;font-weight:650!important}.adminidentitynav{margin-left:auto!important;text-align:right!important;display:flex!important;flex-direction:column!important;align-items:flex-end!important;gap:3px!important}.welcome{font-weight:850!important;color:#eef3ff!important;font-size:.92rem!important}.signedinidentity{color:#90a0bb!important;font-size:.76rem!important;font-weight:700!important;white-space:nowrap!important}.crumb{margin:4px 0 0!important}.crumb a{color:var(--icon)!important;text-decoration:none!important;font-weight:700!important;font-size:.82rem!important}.hero{padding:0!important;margin:0 0 18px!important}.hero .step{font-size:.82rem!important;margin-bottom:8px!important}.hero h1{margin:0 0 8px!important;font-size:1.8rem!important}.hero p{margin:0!important;color:#b8c4d9!important;line-height:1.5!important}.summary{margin:22px 0!important}.card{background:#0e1626!important;border:1px solid #2b3850!important;border-radius:14px!important}.group,.permcat{background:#111b2e!important}@media(max-width:650px){body{padding:12px!important}main{padding:20px!important;margin:8px auto!important}.brandmark{width:74px!important;height:74px!important;flex-basis:74px!important}.brandcopy strong{font-size:1.22rem!important}.brandcopy span{font-size:.88rem!important;margin-top:4px!important}.adminidentitynav{display:none!important}}</style></head>`);
    const headers=new Headers(response.headers);headers.delete("content-length");
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
} satisfies ExportedHandler<Env>;
