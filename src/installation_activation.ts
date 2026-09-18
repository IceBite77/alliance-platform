import app from "./branding_transparency";
import {handleUiV2} from "./ui-v2/handler";
import {themedErrorResponse} from "./ui-v2/error";
import {runShieldReminders} from "./shield_reminder_scheduler";

interface Env {
  DB: D1Database;
  ASSETS: R2Bucket;
  APP_URL: string;
  LICENSING_URL?: string;
  PLATFORM_VERSION?: string;
  SETUP_KEY: string;
  [key: string]: unknown;
}

type ActivationRow={installation_id:string;status:string;activated_at:string|null;last_verified_at:string|null};
const noStore={"cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"};
const esc=(v:unknown)=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const page=(title:string,body:string,status=200)=>new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,#090e18 100%);color:#eef3ff;padding:24px}main{width:min(94vw,720px);margin:8vh auto;background:#151d2e;border:1px solid #2b3850;border-radius:20px;padding:30px;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{margin:0 0 10px;font-size:1.8rem}p{color:#b8c4d9;line-height:1.55}.step{font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:#8292ae;font-weight:800;margin-bottom:8px}.notice{margin:16px 0;padding:12px 14px;border-radius:10px;background:#24191c;color:#ffd5dc}.success{background:#14251d;color:#baf4cf}label{display:block;margin:18px 0 8px;font-weight:700}input{width:100%;padding:13px 14px;border-radius:10px;border:1px solid #3a4964;background:#0e1626;color:#fff;font-size:1rem;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;text-transform:uppercase}button{display:inline-block;width:100%;margin-top:16px;padding:13px 16px;border:0;border-radius:11px;background:#5865f2;color:#fff;font-size:1rem;font-weight:800;cursor:pointer}.small{font-size:.9rem;color:#90a0bb}.ice{font-weight:900;letter-spacing:.04em;color:#d9f3ff}</style></head><body><main>${body}</main></body></html>`,{status,headers:{...noStore,"content-type":"text/html; charset=utf-8"}});

async function activation(e:Env):Promise<ActivationRow|null>{try{return await e.DB.prepare("SELECT installation_id,status,activated_at,last_verified_at FROM installation_activation WHERE id=1").first<ActivationRow>()}catch{return null}}
const licensing=(e:Env)=>String(e.LICENSING_URL||"").replace(/\/$/,"");

function activationPage(id:string,message?:string){return page("Activate Alliance Platform",`<div class="step">Initial Setup · Step 1</div><h1>Activate your installation</h1><p>Enter the <span class="ice">ICE-</span> installation key supplied for this copy of The Alliance Management Platform.</p>${message?`<div class="notice">${esc(message)}</div>`:""}<form method="post" action="/setup/activate"><label>Installation key</label><input name="installation_key" placeholder="ICE-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" required><button>Activate Installation</button></form><p class="small">Installation ID: ${esc(id)}<br>The key is sent only to ICE Licensing for activation and is not stored in this platform.</p>`)}
function ownerPage(){return page("Create Installation Owner",`<div class="step">Initial Setup · Step 2</div><h1>Create the first owner</h1><div class="notice success">Installation activated ✓</div><p>Next, verify the person who will own and control this installation using Discord.</p><form method="post" action="/setup/discord/start"><button>Verify Owner with Discord</button></form><p class="small">The installation key and Owner identity are separate. Your ICE key is not your login credential.</p>`)}

async function activate(r:Request,e:Env,row:ActivationRow){const f=await r.formData(),key=String(f.get("installation_key")??"").trim().toUpperCase();if(!/^ICE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key))return activationPage(row.installation_id,"That doesn't look like a valid ICE installation key.");const base=licensing(e);if(!base)return activationPage(row.installation_id,"ICE Licensing has not been configured for this installation.");try{const res=await fetch(`${base}/api/v1/activate`,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({installation_key:key,installation_id:row.installation_id,platform_version:String(e.PLATFORM_VERSION||"development")})});const data:any=await res.json().catch(()=>null);if(!res.ok||data?.status!=="active"){const message=data?.error==="invalid_installation_key"?"That installation key is not valid.":data?.error==="key_already_in_use"?"That installation key is already assigned to another installation.":data?.status==="revoked"?"That installation key has been revoked.":"ICE Licensing could not activate this installation.";return activationPage(row.installation_id,message)}const checked=String(data.checked_at||new Date().toISOString());await e.DB.prepare("UPDATE installation_activation SET status='active',activated_at=COALESCE(activated_at,?),last_verified_at=?,activation_service=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(checked,checked,base).run();return Response.redirect(new URL("/setup",r.url),303)}catch(err){console.error("ICE activation failed",err);return activationPage(row.installation_id,"ICE Licensing is temporarily unavailable. Please try again.")}}

async function ownerStart(r:Request,e:Env,ctx:ExecutionContext){const f=new FormData();f.set("setup_key",e.SETUP_KEY);const headers=new Headers(r.headers);headers.delete("content-length");headers.set("content-type","application/x-www-form-urlencoded");const body=new URLSearchParams({setup_key:e.SETUP_KEY});return app.fetch(new Request(r.url,{method:"POST",headers,body,redirect:r.redirect}),e as any,ctx)}

export default {async scheduled(controller:ScheduledController,e:Env,ctx:ExecutionContext){ctx.waitUntil(runShieldReminders(e, new Date(controller.scheduledTime)))},async fetch(r:Request,e:Env,ctx:ExecutionContext){const u=new URL(r.url);
  if(r.method==="GET"){
    if(/^\/leadership\/?$/.test(u.pathname))return Response.redirect(new URL("/ui-v2/leadership",r.url),302);
    const legacyGroup=u.pathname.match(/^\/leadership\/security\/groups\/(\d+)\/?$/);
    if(legacyGroup)return Response.redirect(new URL(`/ui-v2/security/groups/${legacyGroup[1]}`,r.url),302);
    if(/^\/leadership\/security\/?$/.test(u.pathname))return Response.redirect(new URL("/ui-v2/security",r.url),302);
    if(/^\/leadership\/audit\/?$/.test(u.pathname))return Response.redirect(new URL("/ui-v2/audit",r.url),302);
    const settingsRedirects:Record<string,string>={
      "/leadership/settings":"/ui-v2/settings",
      "/leadership/settings/details":"/ui-v2/settings/details",
      "/leadership/settings/branding":"/ui-v2/branding",
      "/leadership/settings/discord":"/ui-v2/settings/discord",
      "/leadership/settings/ranks":"/ui-v2/ranks",
      "/leadership/settings/players":"/ui-v2/settings/players",
      "/settings/alliance":"/ui-v2/settings",
      "/settings/alliance/details":"/ui-v2/settings/details",
      "/settings/alliance/branding":"/ui-v2/branding",
      "/settings/discord":"/ui-v2/settings/discord",
      "/settings/discord/change":"/ui-v2/settings/discord?action=change",
      "/settings/discord/disconnect":"/ui-v2/settings/discord?action=disconnect",
      "/settings/ranks":"/ui-v2/ranks",
      "/settings/players":"/ui-v2/settings/players"
    };
    const legacySettings=settingsRedirects[u.pathname.replace(/\/$/,"")||"/"];
    if(legacySettings)return Response.redirect(new URL(legacySettings,r.url),302);
  }
  const row=await activation(e);
  if(row&&row.status!=="active"){
    if(r.method==="GET"&&u.pathname==="/setup")return activationPage(row.installation_id);
    if(r.method==="POST"&&u.pathname==="/setup/activate")return activate(r,e,row);
    if(u.pathname.startsWith("/setup")||u.pathname.startsWith("/auth/discord"))return Response.redirect(new URL("/setup",r.url),302);
    return themedErrorResponse(r,e,await app.fetch(r,e as any,ctx));
  }
  if(row&&r.method==="GET"&&u.pathname==="/setup"){
    // Existing installations with an Owner are allowed through to the normal app redirect.
    const owner=await e.DB.prepare("SELECT id FROM accounts WHERE is_owner=1 LIMIT 1").first();
    return owner?themedErrorResponse(r,e,await app.fetch(r,e as any,ctx)):ownerPage();
  }
  if(row&&r.method==="POST"&&u.pathname==="/setup/discord/start")return ownerStart(r,e,ctx);
  const uiV2=await handleUiV2(r,e);
  if(uiV2)return themedErrorResponse(r,e,uiV2);
  return themedErrorResponse(r,e,await app.fetch(r,e as any,ctx));
}} satisfies ExportedHandler<Env>;
