import app from "./worker";

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

const SESSION_COOKIE="ap_session";
const cookie=(r:Request,n:string)=>{for(const p of(r.headers.get("cookie")??"").split(";")){const [x,...z]=p.trim().split("=");if(x===n)return z.join("=")}return null};
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
const hash=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const owner=async(r:Request,e:Env)=>{const t=cookie(r,SESSION_COOKIE);if(!t)return null;return await e.DB.prepare(`SELECT a.id,a.display_name FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 AND a.approval_status='active' AND a.is_owner=1 LIMIT 1`).bind(await hash(t)).first<{id:number;display_name:string}>()};
const audit=async(e:Env,a:{id:number;display_name:string},action:string,values:unknown)=>e.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,a.display_name,action,"branding","icons","settings",JSON.stringify(values)).run();
const iconKeys=["branding/icons/master.png","branding/icons/favicon-16.png","branding/icons/favicon-32.png","branding/icons/favicon-48.png","branding/icons/apple-touch-icon.png","branding/icons/android-chrome-192.png","branding/icons/android-chrome-512.png"];

const saveIcons=async(r:Request,e:Env)=>{
  const a=await owner(r,e);if(!a)return Response.redirect(new URL("/login",r.url),302);
  const f=await r.formData();
  const slots:[[string,string,number],...[string,string,number][]]=[["master","branding/icons/master.png",512],["i16","branding/icons/favicon-16.png",16],["i32","branding/icons/favicon-32.png",32],["i48","branding/icons/favicon-48.png",48],["apple","branding/icons/apple-touch-icon.png",180],["pwa192","branding/icons/android-chrome-192.png",192],["pwa512","branding/icons/android-chrome-512.png",512]];
  for(const [field,key] of slots){const file=f.get(field);if(!(file instanceof File)||file.size===0||file.type!=="image/png")return Response.redirect(new URL("/settings/alliance/branding?error=file",r.url),302);await e.ASSETS.put(key,file.stream(),{httpMetadata:{contentType:"image/png",cacheControl:"public, max-age=300"}})}
  await e.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('brand_favicon','branding/icons/favicon-32.png',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").run();
  await audit(e,a,"branding.icons.generated",{source:"single square upload",sizes:[16,32,48,180,192,512]});
  return Response.redirect(new URL("/settings/alliance/branding?saved=icons",r.url),302);
};
const removeIcons=async(r:Request,e:Env)=>{const a=await owner(r,e);if(!a)return Response.redirect(new URL("/login",r.url),302);await Promise.all(iconKeys.map(k=>e.ASSETS.delete(k)));await e.DB.prepare("DELETE FROM settings WHERE key='brand_favicon'").run();await audit(e,a,"branding.icons.removed",{deleted:iconKeys});return Response.redirect(new URL("/settings/alliance/branding?saved=removed-favicon",r.url),302)};

const manifest=async(e:Env)=>{const row=await e.DB.prepare("SELECT value FROM settings WHERE key='platform_name'").first<{value:string}>();const name=row?.value||"The Alliance Management Platform";return new Response(JSON.stringify({name,short_name:name,icons:[{src:"/assets/branding/icons/android-chrome-192.png",sizes:"192x192",type:"image/png"},{src:"/assets/branding/icons/android-chrome-512.png",sizes:"512x512",type:"image/png"}],display:"standalone",background_color:"#0c1220",theme_color:"#0c1220"}),{headers:{"content-type":"application/manifest+json","cache-control":"public, max-age=300"}})};

const iconScript=`<script>(()=>{const input=document.querySelector('input[name="asset"][accept*="image/x-icon"]');if(!input)return;const form=input.closest('form');if(!form)return;form.action='/settings/alliance/branding/icons';input.accept='image/png';const old=form.querySelector('button');if(old)old.textContent='Upload & create icon set';form.addEventListener('submit',async ev=>{ev.preventDefault();const file=input.files&&input.files[0];if(!file)return;const img=await createImageBitmap(file);if(img.width!==img.height){alert('Please choose a square PNG image.');return}const fd=new FormData();const make=async(size)=>{const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d');x.clearRect(0,0,size,size);x.drawImage(img,0,0,size,size);return await new Promise(resolve=>c.toBlob(resolve,'image/png'))};for(const [field,size] of [['master',512],['i16',16],['i32',32],['i48',48],['apple',180],['pwa192',192],['pwa512',512]])fd.append(field,await make(size),field+'.png');if(old){old.disabled=true;old.textContent='Creating icon set…'}const res=await fetch(form.action,{method:'POST',body:fd});location.href=res.url||'/settings/alliance/branding'})})();</script>`;

const polishHtml=async(res:Response,path:string,e:Env)=>{
  const ct=res.headers.get("content-type")||"";if(!ct.includes("text/html"))return res;
  let body=await res.text();
  if(path==="/settings/alliance/branding"){
    body=body.replace(".brandsettings{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:22px}",".brandsettings{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:22px}@media(max-width:900px){.brandsettings{grid-template-columns:repeat(2,minmax(0,1fr))}}");
    body=body.replace("Master square icon for browser and app branding. Automatic generation of the full icon-size set will be added here rather than asking you to upload each size.","Upload one square PNG and the platform automatically creates the browser, Apple and app icon sizes it needs.");
    body=body.replace("Square PNG recommended · Simple artwork stays clearest at tiny sizes.","Square PNG required · 512 × 512 px or larger recommended · Simple artwork stays clearest at tiny sizes.");
    body=body.replace("image/png,image/x-icon,image/vnd.microsoft.icon","image/png,image/x-icon,image/vnd.microsoft.icon");
    body=body.replace(/<form method="post" action="\/settings\/alliance\/branding" onsubmit="return confirm\('Remove this image\?'\);"><input type="hidden" name="slot" value="remove"><input type="hidden" name="asset_slot" value="favicon"><button class="removeasset" type="submit">Remove<\/button><\/form>/,`<form method="post" action="/settings/alliance/branding/icons/remove" onsubmit="return confirm('Remove this icon set?');"><button class="removeasset" type="submit">Remove</button></form>`);
    body=body.replace("</body>",`${iconScript}</body>`);
  }
  if(path==="/")body=body.replace(/<div class="dashuser"><span class="small">Signed in as<\/span><strong>(.*?)<\/strong><\/div>/,`<div class="dashuser"><span class="small">Welcome</span><strong>$1</strong></div>`);
  const iconRow=await e.DB.prepare("SELECT value FROM settings WHERE key='brand_favicon'").first<{value:string}>().catch(()=>null);
  if(iconRow?.value&&body.includes("</head>"))body=body.replace("</head>",`<link rel="icon" type="image/png" sizes="16x16" href="/assets/branding/icons/favicon-16.png"><link rel="icon" type="image/png" sizes="32x32" href="/assets/branding/icons/favicon-32.png"><link rel="icon" type="image/png" sizes="48x48" href="/assets/branding/icons/favicon-48.png"><link rel="apple-touch-icon" sizes="180x180" href="/assets/branding/icons/apple-touch-icon.png"><link rel="manifest" href="/site.webmanifest"></head>`);
  const h=new Headers(res.headers);h.delete("content-length");return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
};

export default {async fetch(request:Request,env:Env):Promise<Response>{const u=new URL(request.url);if(request.method==="POST"&&u.pathname==="/settings/alliance/branding/icons")return saveIcons(request,env);if(request.method==="POST"&&u.pathname==="/settings/alliance/branding/icons/remove")return removeIcons(request,env);if(request.method==="GET"&&u.pathname==="/site.webmanifest")return manifest(env);if(request.method==="GET"&&u.pathname==="/favicon.ico"){const o=await env.ASSETS.get("branding/icons/favicon-32.png");if(o)return new Response(o.body,{headers:{"content-type":"image/png","cache-control":"public, max-age=300"}})}const res=await app.fetch(request,env as any);return polishHtml(res,u.pathname,env)}} satisfies ExportedHandler<Env>;
