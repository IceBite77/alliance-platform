import app from "./polish";

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
const audit=async(e:Env,a:{id:number;display_name:string},action:string,rank:number|string,values:unknown)=>e.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,a.display_name,action,"alliance_rank",String(rank),"settings",JSON.stringify(values)).run();
const validRank=(v:string)=>/^[1-5]$/.test(v);
const rankKey=(rank:number)=>`ranks/r${rank}`;
const sameOrigin=(r:Request,e:Env)=>{const site=r.headers.get("sec-fetch-site");if(site==="same-origin"||site==="none")return true;const origin=r.headers.get("origin");if(!origin)return true;return new Set([new URL(r.url).origin,new URL(e.APP_URL).origin]).has(origin)};

const saveRankDisplay=async(r:Request,e:Env)=>{
  const a=await owner(r,e);if(!a)return Response.redirect(new URL("/login",r.url),302);
  if(!sameOrigin(r,e))return new Response("Forbidden",{status:403});
  const f=await r.formData(),show=f.get("show_rank_names")==="1"?"1":"0";
  await e.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('show_rank_names',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(show).run();
  await audit(e,a,"alliance.rank.display.updated","display",{show_rank_names:show==="1"});
  return Response.redirect(new URL("/settings/ranks?display=saved",r.url),302);
};

const uploadRankArtwork=async(r:Request,e:Env)=>{
  const a=await owner(r,e);if(!a)return Response.redirect(new URL("/login",r.url),302);
  const f=await r.formData(),rs=String(f.get("rank")??""),file=f.get("asset");
  if(!validRank(rs)||!(file instanceof File)||file.size===0||file.size>5*1024*1024||!["image/png","image/jpeg","image/webp"].includes(file.type))return Response.redirect(new URL("/settings/ranks?art=error",r.url),302);
  const rank=Number(rs),old=await e.DB.prepare("SELECT image_path FROM alliance_ranks WHERE rank_level=?").bind(rank).first<{image_path:string|null}>();
  if(!old)return Response.redirect(new URL("/settings/ranks?art=error",r.url),302);
  const key=rankKey(rank);
  await e.ASSETS.put(key,file.stream(),{httpMetadata:{contentType:file.type,cacheControl:"public, max-age=300"},customMetadata:{originalName:file.name.slice(0,180)}});
  await e.DB.prepare("UPDATE alliance_ranks SET image_path=?,updated_at=CURRENT_TIMESTAMP WHERE rank_level=?").bind(key,rank).run();
  if(old.image_path&&old.image_path!==key)await e.ASSETS.delete(old.image_path);
  await audit(e,a,"alliance.rank.artwork.updated",rank,{rank,key,contentType:file.type,size:file.size,replacedKey:old.image_path});
  return Response.redirect(new URL(`/settings/ranks?art=saved&rank=${rank}`,r.url),302);
};

const removeRankArtwork=async(r:Request,e:Env)=>{
  const a=await owner(r,e);if(!a)return Response.redirect(new URL("/login",r.url),302);
  const f=await r.formData(),rs=String(f.get("rank")??"");
  if(!validRank(rs))return Response.redirect(new URL("/settings/ranks?art=error",r.url),302);
  const rank=Number(rs),old=await e.DB.prepare("SELECT image_path FROM alliance_ranks WHERE rank_level=?").bind(rank).first<{image_path:string|null}>();
  if(!old)return Response.redirect(new URL("/settings/ranks?art=error",r.url),302);
  if(old.image_path)await e.ASSETS.delete(old.image_path);
  await e.DB.prepare("UPDATE alliance_ranks SET image_path=NULL,updated_at=CURRENT_TIMESTAMP WHERE rank_level=?").bind(rank).run();
  await audit(e,a,"alliance.rank.artwork.removed",rank,{rank,deletedKey:old.image_path});
  return Response.redirect(new URL(`/settings/ranks?art=removed&rank=${rank}`,r.url),302);
};

const decorateRanks=async(res:Response,e:Env,u:URL)=>{
  const ct=res.headers.get("content-type")||"";if(!ct.includes("text/html"))return res;
  let body=await res.text();
  const rows=await e.DB.prepare("SELECT rank_level,image_path FROM alliance_ranks ORDER BY rank_level DESC").all<{rank_level:number;image_path:string|null}>();
  const paths=new Map((rows.results??[]).map(x=>[x.rank_level,x.image_path]));
  const display=await e.DB.prepare("SELECT value FROM settings WHERE key='show_rank_names'").first<{value:string}>();
  const showRankNames=display?.value!=="0";
  body=body.replace(/<div class="rankrow"><div class="rankcode">R([1-5])<\/div>([\s\S]*?)<div class="artwork">(?:Artwork configured|No artwork yet)<\/div><\/div>/g,(_m,rankText,middle)=>{
    const rank=Number(rankText),path=paths.get(rank),preview=path?`<img src="/assets/${encodeURIComponent(path)}" alt="R${rank} artwork">`:`<span>No artwork yet</span>`;
    return `<div class="rankrow"><div class="rankcode">R${rank}</div>${middle}<div class="rankartbox"><div class="artwork rankartpreview">${preview}</div><input class="rankfile" id="rankfile-${rank}" type="file" accept="image/png,image/jpeg,image/webp"><button class="rankupload" type="button" data-rank="${rank}">${path?"Replace artwork":"Upload artwork"}</button>${path?`<button class="rankremove" type="button" data-rank="${rank}">Remove</button>`:""}<div class="rankhint">PNG, JPG or WebP · max 5 MB</div><div class="uploadmessage" id="rankmessage-${rank}" role="status" aria-live="polite"></div></div></div>`;
  });
  const displayCard=`<div class="card rankdisplay"><h2>Player rank display</h2><p>Choose whether player names show the custom rank title as well as the R number.</p><form method="post" action="/settings/ranks/display"><label class="ranktoggle"><input type="checkbox" name="show_rank_names" value="1"${showRankNames?" checked":""}><span><strong>Show rank names with players</strong><small>${showRankNames?"Example: IceBite · R4 · Elder Drake":"Example: IceBite · R4"}</small></span></label><button type="submit">Save display setting</button></form></div>`;
  body=body.replace('<form method="post" action="/settings/ranks">',`${u.searchParams.get("display")==="saved"?'<div class="notice success">Rank display setting saved.</div>':""}${displayCard}<form method="post" action="/settings/ranks">`);
  const art=u.searchParams.get("art"),rank=u.searchParams.get("rank");
  if(art){const msg=art==="saved"?`R${rank||""} artwork saved.`:art==="removed"?`R${rank||""} artwork removed and deleted from storage.`:"That rank artwork could not be uploaded.";body=body.replace("<form method=\"post\" action=\"/settings/ranks\">",`<div class="notice ${art==="error"?"":"success"}">${msg}</div><form method="post" action="/settings/ranks">`)}
  const css=`<style>.rankdisplay{margin:18px 0}.rankdisplay p{margin-bottom:10px}.ranktoggle{display:flex;align-items:flex-start;gap:11px;padding:12px 13px;border:1px solid #34445f;border-radius:11px;background:#0b1322;cursor:pointer}.ranktoggle input{width:auto;margin:3px 0 0;accent-color:var(--ap-accent,#5865f2)}.ranktoggle span{display:block}.ranktoggle strong,.ranktoggle small{display:block}.ranktoggle small{margin-top:3px;color:#8292ae}.rankdisplay button{width:auto}.rankartbox{display:flex;flex-direction:column;gap:8px}.rankartpreview{height:96px;overflow:hidden;background:#0b1322}.rankartpreview img{max-width:100%;max-height:100%;object-fit:contain}.rankfile{font-size:.78rem;padding:8px}.rankupload,.rankremove{margin:0;padding:9px 10px;font-size:.82rem}.rankremove{background:#24191c!important;color:#ffd5dc;border:1px solid #5b3038}.rankhint{color:#8292ae;font-size:.72rem;text-align:center}.uploadmessage{display:none;padding:9px 10px;border-radius:9px;background:#24191c;border:1px solid #5b3038;color:#ffd5dc;font-size:.78rem;line-height:1.35}.uploadmessage.show{display:block}.uploadmessage strong{display:block;color:#fff;margin-bottom:2px}@media(max-width:650px){.rankartbox{grid-column:1/-1}}</style>`;
  const js=`<script>(()=>{const show=(rank,title,text)=>{const m=document.getElementById('rankmessage-'+rank);if(!m)return;m.innerHTML='<strong>'+title+'</strong>'+text;m.classList.add('show')};const clear=rank=>{const m=document.getElementById('rankmessage-'+rank);if(m){m.textContent='';m.classList.remove('show')}};document.querySelectorAll('.rankfile').forEach(input=>input.addEventListener('change',()=>{const rank=input.id.replace('rankfile-','');clear(rank);const file=input.files&&input.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type))show(rank,'Unsupported image','Choose a PNG, JPG or WebP image.');else if(file.size>5*1024*1024)show(rank,'Image is too large','Choose an image smaller than 5 MB.')}));document.querySelectorAll('.rankupload').forEach(btn=>btn.addEventListener('click',async()=>{const rank=btn.dataset.rank,input=document.getElementById('rankfile-'+rank),file=input&&input.files&&input.files[0];clear(rank);if(!file){show(rank,'No image selected','Choose an image before uploading.');return}if(!['image/png','image/jpeg','image/webp'].includes(file.type)){show(rank,'Unsupported image','Choose a PNG, JPG or WebP image.');return}if(file.size>5*1024*1024){show(rank,'Image is too large','Choose an image smaller than 5 MB.');return}const fd=new FormData();fd.append('rank',rank);fd.append('asset',file);btn.disabled=true;btn.textContent='Uploading…';try{const res=await fetch('/settings/ranks/artwork',{method:'POST',body:fd});location.href=res.url||'/settings/ranks'}catch(_){btn.disabled=false;btn.textContent='Upload artwork';show(rank,'Upload failed','The image could not be uploaded. Please try again.')}}));document.querySelectorAll('.rankremove').forEach(btn=>btn.addEventListener('click',async()=>{const rank=btn.dataset.rank;if(!confirm('Remove this rank artwork?'))return;const fd=new FormData();fd.append('rank',rank);btn.disabled=true;btn.textContent='Removing…';const res=await fetch('/settings/ranks/artwork/remove',{method:'POST',body:fd});location.href=res.url||'/settings/ranks'}))})();</script>`;
  body=body.replace("</head>",`${css}</head>`).replace("</body>",`${js}</body>`);
  const h=new Headers(res.headers);h.delete("content-length");return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
};

export default {async fetch(request:Request,env:Env):Promise<Response>{const u=new URL(request.url);if(request.method==="POST"&&u.pathname==="/settings/ranks/display")return saveRankDisplay(request,env);if(request.method==="POST"&&u.pathname==="/settings/ranks/artwork")return uploadRankArtwork(request,env);if(request.method==="POST"&&u.pathname==="/settings/ranks/artwork/remove")return removeRankArtwork(request,env);const res=await app.fetch(request,env as any);return u.pathname==="/settings/ranks"?decorateRanks(res,env,u):res}} satisfies ExportedHandler<Env>;
