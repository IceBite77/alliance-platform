import {encryptManagedSecret,isManagedSecretKey} from "../managed_secrets";
import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type SecretRow={secret_key:string;configured_at:string;updated_at:string};
type ActivationRow={installation_id:string;status:string;activated_at:string|null;last_verified_at:string|null};

const css=`<style>
.key-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.key-card{padding:19px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.key-card h2{margin:0;font-size:1.02rem}.key-card p{margin:8px 0 0;color:var(--ui-muted);font-size:.76rem;line-height:1.55}.key-status{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:15px 0;padding:11px 12px;border:1px solid var(--ui-line);border-radius:10px;background:var(--ui-surface-3);font-size:.72rem}.key-status strong{color:var(--ui-success)}.key-status strong.bad{color:var(--ui-warning)}.key-form label{display:block;margin:12px 0 7px;font-size:.74rem;font-weight:900}.key-input{width:100%;padding:12px 13px;border:1px solid var(--ui-line-strong);border-radius:10px;background:var(--ui-surface-3);color:var(--ui-text)}.key-button{margin-top:11px;padding:10px 14px;border:0;border-radius:10px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:900;cursor:pointer}.key-notice{margin-bottom:15px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.76rem;font-weight:800}.key-notice.error{border-color:color-mix(in srgb,var(--ui-danger) 45%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger)}.key-warning{margin-top:15px;padding:13px;border:1px solid color-mix(in srgb,var(--ui-warning) 40%,var(--ui-line));border-radius:11px;color:var(--ui-warning);font-size:.72rem;line-height:1.5}@media(max-width:720px){.key-grid{grid-template-columns:1fr}.key-button{width:100%}}
</style>`;

const redirect=(request:Request,query:string)=>Response.redirect(new URL(`/ui-v2/settings/integrations${query}`,request.url),303);
const audit=(env:UiV2Env,context:UiV2Context,action:string,id:string,newValues:unknown)=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,"integration",id,"ui-v2-integrations",JSON.stringify(newValues));
const message=(url:URL)=>url.searchParams.get("saved")?`<div class="key-notice">${esc(url.searchParams.get("saved"))}</div>`:url.searchParams.get("error")?`<div class="key-notice error">${esc(url.searchParams.get("error"))}</div>`:"";

function status(name:string,managed:Set<string>,envValue:unknown){
  const present=managed.has(name)||Boolean(envValue),source=managed.has(name)?"Leadership Console":present?"Cloudflare installation":"Not configured";
  return `<div class="key-status"><span>Status</span><strong class="${present?"":"bad"}">${present?`Configured · ${source}`:"Not configured"}</strong></div>`;
}

async function page(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.isOwner)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Administration",title:"Integrations & Keys",description:"Only the installation owner can manage protected credentials.",body:"",activePath:"/ui-v2/settings",back:{href:"/ui-v2/settings",label:"Alliance Settings"}}),403);
  const [secretRows,activation]=await Promise.all([
    env.DB.prepare("SELECT secret_key,configured_at,updated_at FROM managed_secrets ORDER BY secret_key").all<SecretRow>(),
    env.DB.prepare("SELECT installation_id,status,activated_at,last_verified_at FROM installation_activation WHERE id=1").first<ActivationRow>()
  ]),managed=new Set((secretRows.results??[]).map(row=>row.secret_key));
  const body=`${css}${message(new URL(request.url))}<div class="key-grid">
  <section class="key-card"><h2>ICE Licensing</h2><p>Replace the installation key issued by ICE Licensing. It is verified remotely and is never retained by this platform.</p><div class="key-status"><span>${esc(activation?.installation_id||"Installation unavailable")}</span><strong class="${activation?.status==="active"?"":"bad"}">${esc(activation?.status||"unknown")}</strong></div><form class="key-form" method="post" action="/ui-v2/settings/integrations/license"><label>New ICE installation key</label><input class="key-input" type="password" name="value" placeholder="ICE-XXXX-XXXX-XXXX" autocomplete="new-password" required><button class="key-button" type="submit">Verify and replace licence</button></form></section>
  <section class="key-card"><h2>OpenAI</h2><p>Used only for screenshot reading. A replacement is tested with OpenAI before it is encrypted and saved.</p>${status("OPENAI_API_KEY",managed,env.OPENAI_API_KEY)}<form class="key-form" method="post" action="/ui-v2/settings/integrations/secret"><input type="hidden" name="key" value="OPENAI_API_KEY"><label>New OpenAI API key</label><input class="key-input" type="password" name="value" autocomplete="new-password" required><button class="key-button" type="submit">Test and replace key</button></form></section>
  <section class="key-card"><h2>Discord bot</h2><p>The bot token is tested against Discord before being saved. Existing connected-server details are not changed.</p>${status("DISCORD_BOT_TOKEN",managed,env.DISCORD_BOT_TOKEN)}<form class="key-form" method="post" action="/ui-v2/settings/integrations/secret"><input type="hidden" name="key" value="DISCORD_BOT_TOKEN"><label>New Discord bot token</label><input class="key-input" type="password" name="value" autocomplete="new-password" required><button class="key-button" type="submit">Test and replace token</button></form></section>
  <section class="key-card"><h2>Discord application</h2><p>Replace the application Client ID or OAuth client secret used for Discord sign-in.</p>${status("DISCORD_CLIENT_SECRET",managed,(env as any).DISCORD_CLIENT_SECRET)}<form class="key-form" method="post" action="/ui-v2/settings/integrations/secret"><input type="hidden" name="key" value="DISCORD_CLIENT_ID"><label>New Client ID</label><input class="key-input" name="value" inputmode="numeric" autocomplete="off" required><button class="key-button" type="submit">Replace Client ID</button></form><form class="key-form" method="post" action="/ui-v2/settings/integrations/secret"><input type="hidden" name="key" value="DISCORD_CLIENT_SECRET"><label>New client secret</label><input class="key-input" type="password" name="value" autocomplete="new-password" required><button class="key-button" type="submit">Replace client secret</button></form></section>
  <section class="key-card"><h2>Emergency setup key</h2><p>Rotate the private bootstrap/recovery key. It does not alter the current owner or sign anyone out.</p>${status("SETUP_KEY",managed,(env as any).SETUP_KEY)}<form class="key-form" method="post" action="/ui-v2/settings/integrations/secret"><input type="hidden" name="key" value="SETUP_KEY"><label>New setup key</label><input class="key-input" type="password" name="value" minlength="24" autocomplete="new-password" required><button class="key-button" type="submit">Rotate setup key</button></form></section>
  </div><div class="key-warning">Keys are never shown after saving. Audit entries record who changed a credential and when, but never contain the credential itself.</div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Administration",title:"Integrations & Keys",description:"Manage installation licensing and protected service credentials from one owner-only area.",body,activePath:"/ui-v2/settings",back:{href:"/ui-v2/settings",label:"Alliance Settings"}}));
}

async function saveSecret(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.isOwner||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),key=String(form.get("key")||""),value=String(form.get("value")||"").trim();
  if(!isManagedSecretKey(key)||!value||value.length>500)return redirect(request,"?error=That credential is not valid.");
  if(key==="SETUP_KEY"&&value.length<24)return redirect(request,"?error=The setup key must be at least 24 characters.");
  if(key==="DISCORD_CLIENT_ID"&&!/^\d{15,25}$/.test(value))return redirect(request,"?error=That Discord Client ID is not valid.");
  if(key==="OPENAI_API_KEY"){
    const response=await fetch("https://api.openai.com/v1/models",{headers:{authorization:`Bearer ${value}`}});
    if(!response.ok)return redirect(request,"?error=OpenAI rejected that API key.");
  }
  if(key==="DISCORD_BOT_TOKEN"){
    const response=await fetch("https://discord.com/api/v10/users/@me",{headers:{authorization:`Bot ${value}`}});
    if(!response.ok)return redirect(request,"?error=Discord rejected that bot token.");
  }
  const encrypted=await encryptManagedSecret(env,value);
  await env.DB.batch([
    env.DB.prepare("INSERT INTO managed_secrets (secret_key,ciphertext,iv,configured_by_account_id,configured_at,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT(secret_key) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,configured_by_account_id=excluded.configured_by_account_id,updated_at=CURRENT_TIMESTAMP").bind(key,encrypted.ciphertext,encrypted.iv,context.user.accountId),
    audit(env,context,"integration.secret.replaced",key,{key,configured:true,tested:key==="OPENAI_API_KEY"||key==="DISCORD_BOT_TOKEN"})
  ]);
  return redirect(request,`?saved=${encodeURIComponent(`${key.replaceAll("_"," ")} updated.`)}`);
}

async function replaceLicence(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.isOwner||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),key=String(form.get("value")||"").trim().toUpperCase();
  if(!/^ICE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key))return redirect(request,"?error=That does not look like a valid ICE installation key.");
  const activation=await env.DB.prepare("SELECT installation_id FROM installation_activation WHERE id=1").first<{installation_id:string}>(),base=String(env.LICENSING_URL||"").replace(/\/$/,"");
  if(!activation||!base)return redirect(request,"?error=ICE Licensing is not configured for this installation.");
  try{
    const response=await fetch(`${base}/api/v1/activate`,{method:"POST",headers:{"content-type":"application/json","accept":"application/json"},body:JSON.stringify({installation_key:key,installation_id:activation.installation_id,platform_version:String(env.PLATFORM_VERSION||"development"),replace_existing:true})}),data:any=await response.json().catch(()=>null);
    if(!response.ok||data?.status!=="active")return redirect(request,`?error=${encodeURIComponent(data?.error==="key_already_in_use"?"That ICE key is assigned to another installation.":"ICE Licensing rejected that installation key.")}`);
    const checked=String(data.checked_at||new Date().toISOString());
    await env.DB.batch([env.DB.prepare("UPDATE installation_activation SET status='active',activated_at=COALESCE(activated_at,?),last_verified_at=?,activation_service=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(checked,checked,base),audit(env,context,"installation.licence.replaced",activation.installation_id,{installationId:activation.installation_id,status:"active",keyStored:false})]);
    return redirect(request,"?saved=ICE licence verified and replaced.");
  }catch(error){console.error("ICE licence replacement failed",error);return redirect(request,"?error=ICE Licensing could not be reached.")}
}

export async function handleUiV2IntegrationsKeys(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith("/ui-v2/settings/integrations"))return null;
  if(path==="/ui-v2/settings/integrations"&&request.method==="GET")return page(request,env,context);
  if(path==="/ui-v2/settings/integrations/secret"&&request.method==="POST")return saveSecret(request,env,context);
  if(path==="/ui-v2/settings/integrations/license"&&request.method==="POST")return replaceLicence(request,env,context);
  return new Response("Not found",{status:404});
}
