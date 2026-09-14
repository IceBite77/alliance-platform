import core from "./index";

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

type AllianceRow = { id:number; name:string; tag:string|null; server_number:number|null };
type SettingRow = { key:string; value:string };
type AccountRow = { id:number; display_name:string; is_owner:number };

const SESSION_COOKIE = "ap_session";
const BRAND_KEYS = ["platform_name","brand_main_logo","brand_admin_logo","brand_login_logo","brand_favicon","login_title","footer_text","theme_preset","theme_accent","theme_icon"];
const PRESETS:Record<string,{name:string;accent:string;icon:string}> = {
  midnight:{name:"Midnight",accent:"#5865f2",icon:"#aebddd"},
  steel:{name:"Steel",accent:"#64748b",icon:"#cbd5e1"},
  forest:{name:"Forest",accent:"#2f855a",icon:"#9ae6b4"},
  crimson:{name:"Crimson",accent:"#b8324b",icon:"#f3a6b4"}
};

const esc = (v:string) => v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const cookie = (r:Request,n:string) => { for(const p of (r.headers.get("cookie")??"").split(";")){ const [x,...z]=p.trim().split("="); if(x===n) return z.join("="); } return null; };
const b64 = (b:Uint8Array) => { let s=""; for(const x of b)s+=String.fromCharCode(x); return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=",""); };
const hash = async(v:string) => b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const getAlliance = async(e:Env) => await e.DB.prepare("SELECT id,name,tag,server_number FROM alliance WHERE id=1").first<AllianceRow>();
const getSettings = async(e:Env) => { const r=await e.DB.prepare(`SELECT key,value FROM settings WHERE key IN (${BRAND_KEYS.map(()=>"?").join(",")})`).bind(...BRAND_KEYS).all<SettingRow>(); return Object.fromEntries((r.results??[]).map(x=>[x.key,x.value])); };
const currentOwner = async(r:Request,e:Env) => { const t=cookie(r,SESSION_COOKIE); if(!t)return null; return (await e.DB.prepare(`SELECT a.id,a.display_name,a.is_owner FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 AND a.approval_status='active' AND a.is_owner=1 LIMIT 1`).bind(await hash(t)).first<AccountRow>())??null; };
const identity = (a:AllianceRow) => `${a.tag?`[${esc(a.tag)}] · `:""}${a.server_number?`Server #${a.server_number}`:"Server not set"}`;
const assetUrl = (key?:string) => key?`/assets/${encodeURIComponent(key)}`:"";
const validHex = (v:string) => /^#[0-9a-fA-F]{6}$/.test(v);
const theme = (s:Record<string,string>) => {
  const preset=PRESETS[s.theme_preset]??PRESETS.midnight;
  return {
    preset:s.theme_preset&&PRESETS[s.theme_preset]?s.theme_preset:"midnight",
    accent:validHex(s.theme_accent||"")?s.theme_accent:preset.accent,
    icon:validHex(s.theme_icon||"")?s.theme_icon:preset.icon
  };
};
const themeCss = (s:Record<string,string>) => {
  const t=theme(s);
  return `:root{--ap-accent:${t.accent};--ap-icon:${t.icon}}.navicon{color:var(--ap-icon)!important}.button,button{background:var(--ap-accent)!important}.crumb a,.sitefooter strong{color:var(--ap-icon)!important}.brandmark:not(.has-image){background:var(--ap-accent)!important}.navcard:hover{border-color:var(--ap-accent)!important}.adminmenu .navcard:hover .navicon,.settingsgrid .navcard:hover .navicon{border-color:var(--ap-accent)!important}`;
};

const shellStyles = `
.brand-image{width:100%;height:100%;object-fit:contain;display:block}.brandmark.has-image{padding:5px;background:#0b1322;overflow:hidden}.brandmark.has-image img{width:100%;height:100%;object-fit:contain}.branding-upload{margin-top:14px}.branding-upload input[type=file]{padding:10px}.brandpreview img{max-width:88%;max-height:105px;object-fit:contain}.loginwrap{max-width:520px;margin:0 auto;text-align:center}.loginlogo{width:112px;height:112px;margin:0 auto 18px;border-radius:24px;background:#0e1626;border:1px solid #2b3850;padding:12px;display:flex;align-items:center;justify-content:center;overflow:hidden}.loginlogo img{max-width:100%;max-height:100%;object-fit:contain}.loginfallback{font-weight:900;font-size:1.1rem}.loginidentity{color:#90a0bb;margin:4px 0 22px}.loginfooter{margin-top:30px;padding-top:18px;border-top:1px solid #2b3850;color:#8292ae;font-size:.82rem}.brandsettings{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:18px}.brandsettings .card{margin-top:0}.uploadstatus{font-size:.82rem;color:#8292ae;margin-top:8px}@media(max-width:650px){.brandsettings{grid-template-columns:1fr}}
`;

const brandedLogin = (a:AllianceRow,s:Record<string,string>,message?:string,status=200) => {
  const platform=s.platform_name?.trim()||"The Alliance Management Platform";
  const title=s.login_title?.trim()||`Welcome to ${a.name}`;
  const logo=s.brand_login_logo||s.brand_main_logo;
  const footer=s.footer_text?.trim()||`${a.name} · ${identity(a)}`;
  const logoHtml=logo?`<img src="${assetUrl(logo)}" alt="${esc(a.name)}">`:`<div class="loginfallback">${esc((a.tag||"AMP").slice(0,5))}</div>`;
  const tc=themeCss(s);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(platform)} · Sign in</title>${s.brand_favicon?`<link rel="icon" href="${assetUrl(s.brand_favicon)}">`:""}<style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,#090e18 100%);color:#eef3ff;padding:24px;display:flex;align-items:center;justify-content:center}main{width:min(94vw,580px);background:#151d2e;border:1px solid #2b3850;border-radius:20px;padding:38px;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{margin:0 0 8px;font-size:1.9rem}p{color:#b8c4d9;line-height:1.55}.step{font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:#8292ae;font-weight:800;margin-bottom:8px}.notice{margin:16px 0;padding:12px 14px;border-radius:10px;background:#24191c;color:#ffd5dc}.button{display:inline-block;width:100%;margin-top:18px;padding:13px 16px;border:0;border-radius:11px;background:#5865f2;color:#fff;text-decoration:none;text-align:center;font-size:1rem;font-weight:800}.loginwrap{max-width:520px;margin:0 auto;text-align:center}.loginlogo{width:112px;height:112px;margin:0 auto 18px;border-radius:24px;background:#0e1626;border:1px solid #2b3850;padding:12px;display:flex;align-items:center;justify-content:center;overflow:hidden}.loginlogo img{max-width:100%;max-height:100%;object-fit:contain}.loginfallback{font-weight:900;font-size:1.1rem}.loginidentity{color:#90a0bb;margin:4px 0 22px}.loginfooter{margin-top:30px;padding-top:18px;border-top:1px solid #2b3850;color:#8292ae;font-size:.82rem}${tc}</style></head><body><main><div class="loginwrap"><div class="loginlogo">${logoHtml}</div><div class="step">${esc(platform)}</div><h1>${esc(title)}</h1><div class="loginidentity">${esc(a.name)} · ${identity(a)}</div><p>Sign in with Discord to continue.</p>${message?`<div class="notice">${esc(message)}</div>`:""}<a class="button" href="/auth/discord">Sign in with Discord</a><div class="loginfooter">${esc(footer)}</div></div></main></body></html>`;
};

const brandingPage = (a:AllianceRow,s:Record<string,string>,message?:string) => {
  const t=theme(s);
  const preview=(key:string,fallback:string)=>s[key]?`<img src="${assetUrl(s[key])}" alt="Branding preview">`:`<div class="brandmark">${esc(fallback)}</div>`;
  const upload=(field:string,label:string,guide:string,current?:string,accept="image/png,image/jpeg,image/webp")=>`<form class="branding-upload" method="post" action="/settings/alliance/branding" enctype="multipart/form-data"><input type="hidden" name="slot" value="${field}"><div class="imageguide"><strong>Image guide</strong><span>${guide}</span><span>Maximum 5 MB · Larger artwork is safely contained and will not change the layout.</span></div><label>${label}</label><input name="asset" type="file" accept="${accept}" required><button>Upload / replace</button>${current?`<div class="uploadstatus">Image stored ✓</div>`:""}</form>`;
  const platform=s.platform_name||"The Alliance Management Platform";
  const loginTitle=s.login_title||`Welcome to ${a.name}`;
  const footer=s.footer_text||`${a.name} · ${identity(a)}`;
  const presetOptions=Object.entries(PRESETS).map(([k,v])=>`<option value="${k}"${t.preset===k?" selected":""}>${v.name}</option>`).join("");
  const presetJson=JSON.stringify(Object.fromEntries(Object.entries(PRESETS).map(([k,v])=>[k,{accent:v.accent,icon:v.icon}])));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Branding · ${esc(a.name)}</title>${s.brand_favicon?`<link rel="icon" href="${assetUrl(s.brand_favicon)}">`:""}<style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--ap-accent:${t.accent};--ap-icon:${t.icon}}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,#090e18 100%);color:#eef3ff;padding:24px}main{width:min(94vw,1120px);margin:28px auto;background:#151d2e;border:1px solid #2b3850;border-radius:20px;padding:30px;box-shadow:0 24px 70px rgba(0,0,0,.35)}h1{margin:0 0 10px;font-size:1.8rem}h2{margin:0 0 8px;font-size:1.1rem}p{color:#b8c4d9;line-height:1.55}.step{font-size:.82rem;text-transform:uppercase;letter-spacing:.08em;color:#8292ae;font-weight:800;margin-bottom:8px}.adminbrand{display:flex;gap:13px;align-items:center;margin-bottom:25px;padding-bottom:18px;border-bottom:1px solid #2b3850}.brandmark{width:48px;height:48px;flex:0 0 48px;border-radius:13px;background:var(--ap-accent);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.72rem;text-align:center;padding:5px;overflow:hidden}.brandmark img,.brand-image{width:100%;height:100%;object-fit:contain}.brandcopy strong{display:block}.brandcopy span{display:block;color:#90a0bb;font-size:.82rem;margin-top:2px}.crumb{margin-left:auto}.crumb a{color:var(--ap-icon);text-decoration:none;font-weight:700}.notice{margin:16px 0;padding:12px 14px;border-radius:10px;background:#14251d;color:#baf4cf}.brandsettings{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}.card{padding:18px;border-radius:14px;background:#0e1626;border:1px solid #2b3850}.brandpreview{height:140px;border:1px dashed #405274;border-radius:14px;display:flex;align-items:center;justify-content:center;background:#0b1322;margin-top:14px;overflow:hidden}.brandpreview img{max-width:88%;max-height:112px;object-fit:contain}label{display:block;margin:16px 0 8px;font-weight:700}input,select{width:100%;padding:12px;border-radius:10px;border:1px solid #3a4964;background:#0e1626;color:#fff}button{display:inline-block;width:100%;margin-top:12px;padding:12px 14px;border:0;border-radius:11px;background:var(--ap-accent);color:#fff;font-weight:800;cursor:pointer}.branding-upload{margin-top:14px}.branding-upload input[type=file]{padding:10px}.uploadstatus{font-size:.82rem;color:#8292ae;margin-top:8px}.imageguide{margin:14px 0;padding:11px 12px;border-radius:10px;background:#111b2e;border:1px solid #2b3850;font-size:.8rem;color:#9dabc3;line-height:1.45}.imageguide strong,.imageguide span{display:block}.imageguide strong{color:#dce5f5;margin-bottom:3px}.themegrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}.themepreview{margin-top:18px;padding:18px;border-radius:14px;background:#0b1322;border:1px solid #2b3850;display:flex;align-items:center;gap:14px}.previewicon{width:42px;height:42px;border-radius:11px;border:1px solid #34445f;display:flex;align-items:center;justify-content:center;color:var(--ap-icon);font-size:1.3rem}.previewbutton{margin-left:auto;background:var(--ap-accent);padding:10px 14px;border-radius:9px;font-weight:800}.themeactions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.themeactions button{margin-top:0}.themeactions .reset{background:#253149!important;color:#dce5f5;border:1px solid #3a4964}.sitefooter{display:flex;justify-content:space-between;gap:14px;margin-top:30px;padding-top:18px;border-top:1px solid #2b3850;color:#8292ae;font-size:.82rem}.sitefooter strong{color:var(--ap-icon)}@media(max-width:650px){body{padding:12px}main{padding:20px;margin:8px auto}.brandsettings,.themegrid,.themeactions{grid-template-columns:1fr}.crumb{display:none}.sitefooter{display:block}.sitefooter span{display:block;margin-top:5px}.themepreview{align-items:flex-start;flex-wrap:wrap}.previewbutton{margin-left:0}}</style></head><body><main><div class="adminbrand"><div class="brandmark">${s.brand_admin_logo?`<img class="brand-image" src="${assetUrl(s.brand_admin_logo)}" alt="">`:esc((a.tag||"AMP").slice(0,5))}</div><div class="brandcopy"><strong>${esc(a.name)}</strong><span>${identity(a)}</span></div><div class="crumb"><a href="/settings/alliance">← Alliance Settings</a></div></div><div class="step">Alliance Settings · Branding</div><h1>Branding</h1><p>Make the platform feel like your alliance. Upload good-quality artwork and the platform keeps it neatly within the layout.</p>${message?`<div class="notice">${esc(message)}</div>`:""}<div class="brandsettings"><div class="card"><h2>Main logo / crest</h2><p>Primary alliance identity for dashboards and general branding.</p><div class="brandpreview">${preview("brand_main_logo",(a.tag||"AMP").slice(0,5))}</div>${upload("main","Choose main logo","Square PNG or WebP works best · Around 1000 × 1000 px is ideal.",s.brand_main_logo)}</div><div class="card"><h2>Compact admin logo</h2><p>Used in admin headers at a fixed, compact size similar to the House of Quack admin layout.</p><div class="brandpreview">${preview("brand_admin_logo",(a.tag||"AMP").slice(0,5))}</div>${upload("admin","Choose compact logo","Square or near-square PNG/WebP works best · Transparent background recommended.",s.brand_admin_logo)}</div><div class="card"><h2>Login logo</h2><p>Artwork shown before a member signs in. Falls back to the main logo.</p><div class="brandpreview">${preview("brand_login_logo",(a.tag||"AMP").slice(0,5))}</div>${upload("login","Choose login logo","Square or near-square PNG/WebP works best · High-resolution artwork is fine.",s.brand_login_logo)}</div><div class="card"><h2>Browser icon</h2><p>Small square icon shown in browser tabs. A single source keeps setup simple.</p><div class="brandpreview">${preview("brand_favicon",(a.tag||"AMP").slice(0,5))}</div>${upload("favicon","Choose browser icon","Square PNG recommended · Simple artwork stays clearest at tiny sizes.",s.brand_favicon,"image/png,image/x-icon,image/vnd.microsoft.icon")}</div></div><form id="theme-form" method="post" action="/settings/alliance/branding" class="card" style="margin-top:16px"><input type="hidden" name="slot" value="theme"><h2>Colours & theme</h2><p>Choose a safe starting theme, then tweak the two identity colours if you want. The sample updates immediately; press Save theme to apply it across the platform.</p><div class="themegrid"><div><label>Theme preset</label><select id="theme-preset" name="theme_preset">${presetOptions}</select></div><div><label>Accent colour</label><input id="theme-accent" name="theme_accent" type="color" value="${esc(t.accent)}"></div><div><label>Icon colour</label><input id="theme-icon" name="theme_icon" type="color" value="${esc(t.icon)}"></div></div><div class="themepreview" id="theme-preview"><div class="previewicon">◆</div><div><strong>Live theme sample</strong><div style="color:#90a0bb;font-size:.84rem;margin-top:3px">Icons, buttons and highlights stay consistent.</div></div><div class="previewbutton">Example button</div></div><div class="themeactions"><button type="submit" name="theme_action" value="save">Save theme</button><button type="submit" name="theme_action" value="reset" class="reset">Reset to default</button></div></form><form method="post" action="/settings/alliance/branding" class="card" style="margin-top:16px"><input type="hidden" name="slot" value="text"><h2>Site wording</h2><label>Platform / site name</label><input name="platform_name" maxlength="80" value="${esc(platform)}"><label>Login heading</label><input name="login_title" maxlength="100" value="${esc(loginTitle)}"><label>Footer wording</label><input name="footer_text" maxlength="140" value="${esc(footer)}"><button>Save wording</button></form><div class="sitefooter"><strong>${esc(a.name)}</strong><span>${esc(footer)}</span></div></main><script>(()=>{const presets=${presetJson};const preset=document.getElementById('theme-preset');const accent=document.getElementById('theme-accent');const icon=document.getElementById('theme-icon');const apply=()=>{document.documentElement.style.setProperty('--ap-accent',accent.value);document.documentElement.style.setProperty('--ap-icon',icon.value);};preset.addEventListener('change',()=>{const p=presets[preset.value];if(p){accent.value=p.accent;icon.value=p.icon;apply();}});accent.addEventListener('input',apply);icon.addEventListener('input',apply);})();</script></body></html>`;
};

const saveSettings = async(e:Env,vals:{key:string;value:string}[]) => e.DB.batch(vals.map(x=>e.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(x.key,x.value)));
const audit = async(e:Env,a:AccountRow,action:string,id:string,values:unknown) => e.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,a.display_name,action,"branding",id,"settings",JSON.stringify(values)).run();

const uploadBranding = async(r:Request,e:Env,a:AccountRow) => {
  const f=await r.formData(),slot=String(f.get("slot")??"");
  if(slot==="text"){
    const vals=[
      {key:"platform_name",value:String(f.get("platform_name")??"").trim().slice(0,80)},
      {key:"login_title",value:String(f.get("login_title")??"").trim().slice(0,100)},
      {key:"footer_text",value:String(f.get("footer_text")??"").trim().slice(0,140)}
    ];
    await saveSettings(e,vals);
    await audit(e,a,"branding.wording.updated","wording",Object.fromEntries(vals.map(x=>[x.key,x.value])));
    return Response.redirect(new URL("/settings/alliance/branding?saved=wording",r.url),302);
  }
  if(slot==="theme"){
    const action=String(f.get("theme_action")??"save");
    if(action==="reset"){
      const d=PRESETS.midnight;
      const vals=[{key:"theme_preset",value:"midnight"},{key:"theme_accent",value:d.accent},{key:"theme_icon",value:d.icon}];
      await saveSettings(e,vals);
      await audit(e,a,"branding.theme.reset","theme",Object.fromEntries(vals.map(x=>[x.key,x.value])));
      return Response.redirect(new URL("/settings/alliance/branding?saved=reset",r.url),302);
    }
    const preset=String(f.get("theme_preset")??"midnight"),accent=String(f.get("theme_accent")??""),icon=String(f.get("theme_icon")??"");
    if(!PRESETS[preset]||!validHex(accent)||!validHex(icon)) return Response.redirect(new URL("/settings/alliance/branding?error=theme",r.url),302);
    const vals=[{key:"theme_preset",value:preset},{key:"theme_accent",value:accent},{key:"theme_icon",value:icon}];
    await saveSettings(e,vals);
    await audit(e,a,"branding.theme.updated","theme",Object.fromEntries(vals.map(x=>[x.key,x.value])));
    return Response.redirect(new URL("/settings/alliance/branding?saved=theme",r.url),302);
  }
  const map:Record<string,{setting:string;key:string;types:string[]}>={
    main:{setting:"brand_main_logo",key:"branding/main-logo",types:["image/png","image/jpeg","image/webp"]},
    admin:{setting:"brand_admin_logo",key:"branding/admin-logo",types:["image/png","image/jpeg","image/webp"]},
    login:{setting:"brand_login_logo",key:"branding/login-logo",types:["image/png","image/jpeg","image/webp"]},
    favicon:{setting:"brand_favicon",key:"branding/favicon",types:["image/png","image/x-icon","image/vnd.microsoft.icon"]}
  };
  const cfg=map[slot],file=f.get("asset");
  if(!cfg||!(file instanceof File)||file.size===0||file.size>5*1024*1024||!cfg.types.includes(file.type)) return Response.redirect(new URL("/settings/alliance/branding?error=file",r.url),302);
  await e.ASSETS.put(cfg.key,file.stream(),{httpMetadata:{contentType:file.type,cacheControl:"public, max-age=300"},customMetadata:{originalName:file.name.slice(0,180)}});
  await saveSettings(e,[{key:cfg.setting,value:cfg.key}]);
  await audit(e,a,"branding.asset.updated",slot,{slot,key:cfg.key,contentType:file.type,size:file.size});
  return Response.redirect(new URL(`/settings/alliance/branding?saved=${encodeURIComponent(slot)}`,r.url),302);
};

const serveAsset = async(key:string,e:Env) => {
  const obj=await e.ASSETS.get(key); if(!obj)return new Response("Not found",{status:404});
  const h=new Headers(); obj.writeHttpMetadata(h); h.set("etag",obj.httpEtag); h.set("cache-control",h.get("cache-control")||"public, max-age=300"); h.set("x-content-type-options","nosniff");
  return new Response(obj.body,{headers:h});
};

const decorate = async(res:Response,e:Env) => {
  const ct=res.headers.get("content-type")||""; if(!ct.includes("text/html"))return res;
  let body=await res.text();
  let al:AllianceRow|null=null; try{al=await getAlliance(e);}catch{}
  if(!al)return new Response(body,{status:res.status,statusText:res.statusText,headers:res.headers});
  const s=await getSettings(e),logo=s.brand_admin_logo||s.brand_main_logo,css=shellStyles+themeCss(s);
  if(logo)body=body.replace(/<div class="brandmark">[^<]*<\/div>/g,`<div class="brandmark has-image"><img src="${assetUrl(logo)}" alt=""></div>`);
  body=body.replace("</head>",`${s.brand_favicon?`<link rel="icon" href="${assetUrl(s.brand_favicon)}">`:""}<style>${css}</style></head>`);
  if(s.footer_text)body=body.replace(/<div class="sitefooter"><strong>.*?<\/strong><span>.*?<\/span><\/div>/g,`<div class="sitefooter"><strong>${esc(al.name)}</strong><span>${esc(s.footer_text)}</span></div>`);
  const h=new Headers(res.headers); h.delete("content-length");
  return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
};

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const u=new URL(request.url);
    if(request.method==="GET"&&u.pathname.startsWith("/assets/")) return serveAsset(decodeURIComponent(u.pathname.slice(8)),env);
    if(request.method==="GET"&&u.pathname==="/login"&&!cookie(request,SESSION_COOKIE)){
      const al=await getAlliance(env);
      if(al){ const s=await getSettings(env); return new Response(brandedLogin(al,s),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}}); }
    }
    if(u.pathname==="/settings/alliance/branding"){
      const owner=await currentOwner(request,env); if(!owner)return Response.redirect(new URL("/login",request.url),302);
      const al=await getAlliance(env); if(!al)return Response.redirect(new URL("/setup/alliance",request.url),302);
      if(request.method==="POST") return uploadBranding(request,env,owner);
      if(request.method==="GET"){
        const s=await getSettings(env),saved=u.searchParams.get("saved"),error=u.searchParams.get("error");
        const message=error?(error==="theme"?"That theme could not be saved. Please choose valid colours.":"That image could not be uploaded. Use PNG, JPG or WebP (browser icon: PNG/ICO), maximum 5 MB."):saved?(saved==="reset"?"Theme reset to the default Midnight colours.":"Branding saved successfully."):undefined;
        return new Response(brandingPage(al,s,message),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});
      }
    }
    const response=await core.fetch(request,env as any);
    return decorate(response,env);
  }
} satisfies ExportedHandler<Env>;
