import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type GuildRow={guild_id:string;guild_name:string;guild_icon:string|null;connected_at:string;verified_at:string};
type SettingRow={key:string;value:string};
type DiscordGuild={id:string;name:string;icon?:string|null};

const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const audit=(env:UiV2Env,context:UiV2Context,action:string,entityType:string,entityId:string,oldValues:unknown,newValues:unknown)=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,entityType,entityId,"ui-v2-settings",oldValues===null?null:JSON.stringify(oldValues),newValues===null?null:JSON.stringify(newValues));
const settings=(rows:D1Result<SettingRow>)=>Object.fromEntries((rows.results??[]).map(row=>[row.key,row.value]));
const validTimezone=(value:string)=>{try{new Intl.DateTimeFormat("en-GB",{timeZone:value}).format();return true}catch{return false}};
const timezones=["Europe/London","UTC","Europe/Paris","Europe/Berlin","America/New_York","America/Chicago","America/Denver","America/Los_Angeles","Australia/Sydney"];

const css=`<style>
.settings-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.settings-card{position:relative;display:block;min-height:150px;padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2);color:inherit;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.settings-card:hover{border-color:var(--ui-hover);box-shadow:0 0 20px color-mix(in srgb,var(--ui-hover) 11%,transparent);transform:translateY(-2px)}.settings-card span{color:var(--ui-accent);font-size:.66rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.settings-card h2{margin:11px 0 7px;font-size:1.05rem}.settings-card p{margin:0;color:var(--ui-muted);font-size:.8rem;line-height:1.55}.settings-card b{position:absolute;right:18px;bottom:16px;color:var(--ui-navigation)}.settings-panel{padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.settings-form{display:grid;gap:15px}.settings-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}.settings-field{min-width:0}.settings-field.full{grid-column:1/-1}.settings-field label{display:block;margin-bottom:7px;color:var(--ui-text);font-size:.76rem;font-weight:900}.settings-input{width:100%;min-width:0;padding:12px 13px;border:1px solid var(--ui-line-strong);border-radius:10px;background:var(--ui-surface-3);color:var(--ui-text)}.settings-hint{margin:6px 0 0;color:var(--ui-muted);font-size:.68rem;line-height:1.45}.settings-button{display:inline-flex;align-items:center;justify-content:center;width:max-content;min-height:40px;padding:10px 15px;border:1px solid transparent;border-radius:10px;background:var(--ui-button);color:var(--ui-button-text);font-size:.78rem;font-weight:900;text-decoration:none;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.settings-button:hover{border-color:var(--ui-hover);box-shadow:0 0 18px color-mix(in srgb,var(--ui-hover) 14%,transparent);transform:translateY(-1px)}.settings-button.secondary{border-color:var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.settings-button.danger{border-color:color-mix(in srgb,var(--ui-danger) 48%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 10%,var(--ui-surface-3));color:var(--ui-danger)}.settings-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:4px}.settings-notice{margin-bottom:16px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.76rem;font-weight:800}.settings-notice.error{border-color:color-mix(in srgb,var(--ui-danger) 45%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger)}.discord-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:17px}.discord-status div{padding:14px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-3)}.discord-status span,.discord-status strong{display:block}.discord-status span{color:var(--ui-muted);font-size:.62rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.discord-status strong{margin-top:6px;font-size:.8rem;overflow-wrap:anywhere}.danger-panel{margin-top:17px;padding:16px;border:1px solid color-mix(in srgb,var(--ui-danger) 45%,var(--ui-line));border-radius:12px;background:color-mix(in srgb,var(--ui-danger) 7%,var(--ui-surface-3))}.danger-panel h2{margin:0 0 6px;font-size:.95rem}.danger-panel p{margin:0;color:var(--ui-muted);font-size:.74rem}.return-settings{margin-bottom:17px}@media(max-width:700px){.settings-grid,.settings-fields,.discord-status{grid-template-columns:1fr}.settings-field.full{grid-column:auto}.settings-button{width:100%}}
</style>`;

const notice=(url:URL)=>url.searchParams.get("saved")?'<div class="settings-notice">Settings saved.</div>':url.searchParams.get("error")?`<div class="settings-notice error">${esc(url.searchParams.get("error"))}</div>`:"";
const forbidden=(context:UiV2Context,title:string)=>uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title,description:"You do not have permission to manage this section.",body:"",activePath:"/ui-v2/settings",back:{href:"/ui-v2/leadership",label:"Leadership Console"}}),403);

async function home(env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageSettings)return forbidden(context,"Alliance Settings");
  const [guild,settingRows]=await Promise.all([env.DB.prepare("SELECT guild_name FROM discord_guild_connection WHERE id=1").first<{guild_name:string}>(),env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('alliance_timezone','player_max_base_level','player_max_overlord_level','player_vs_daily_target')").all<SettingRow>()]);
  const values=settings(settingRows),cards=[
    context.user.canManageDetails?`<a class="settings-card" href="/ui-v2/settings/details"><span>Alliance</span><h2>Alliance Details</h2><p>${esc(context.alliance.name)} · ${context.alliance.tag?`[${esc(context.alliance.tag)}] · `:""}${context.alliance.serverNumber?`Server #${context.alliance.serverNumber}`:"Server not set"} · ${esc(values.alliance_timezone||"Europe/London")}</p><b>→</b></a>`:"",
    context.user.canManageBranding?'<a class="settings-card" href="/ui-v2/branding"><span>Appearance</span><h2>Branding</h2><p>Theme colours, shared wording, logos and platform identity.</p><b>→</b></a>':"",
    context.user.canManageDiscord?`<a class="settings-card" href="/ui-v2/settings/discord"><span>Connection</span><h2>Discord</h2><p>${guild?`Connected to ${esc(guild.guild_name)}.`:"Discord is not connected."}</p><b>→</b></a>`:"",
    context.user.canManageRanks?'<a class="settings-card" href="/ui-v2/ranks"><span>Players</span><h2>Ranks</h2><p>Manage R1–R5 names, colours and future rank artwork.</p><b>→</b></a>':"",
    context.user.canManagePlayerSettings?`<a class="settings-card" href="/ui-v2/settings/players"><span>Player Profiles</span><h2>Player Settings</h2><p>Base, Overlord and daily VS contribution limits.</p><b>→</b></a>`:""
  ].join("");
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Configuration",title:"Alliance Settings",description:"Everything that defines how this alliance looks, connects and labels itself lives here.",body:`${css}<div class="settings-grid">${cards}</div>`,activePath:"/ui-v2/settings",back:{href:"/ui-v2/leadership",label:"Leadership Console"}}));
}

async function detailsPage(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDetails)return forbidden(context,"Alliance Details");
  const row=await env.DB.prepare("SELECT value FROM settings WHERE key='alliance_timezone'").first<{value:string}>(),timezone=row?.value||"Europe/London";
  const options=timezones.map(value=>`<option value="${esc(value)}"${value===timezone?" selected":""}>${esc(value)}</option>`).join("");
  const body=`${css}${notice(new URL(request.url))}<section class="settings-panel"><form class="settings-form" method="post" action="/ui-v2/settings/details"><div class="settings-fields"><div class="settings-field full"><label>Alliance name</label><input class="settings-input" name="name" maxlength="80" required value="${esc(context.alliance.name)}"></div><div class="settings-field"><label>Alliance Tag</label><input class="settings-input" name="tag" maxlength="12" required value="${esc(context.alliance.tag||"")}" placeholder="DuCK"><p class="settings-hint">Enter DuCK, not [DuCK]. Capitalisation is preserved.</p></div><div class="settings-field"><label>Server Number</label><input class="settings-input" name="server_number" type="number" min="1" max="99999" required value="${context.alliance.serverNumber??""}" placeholder="940"><p class="settings-hint">Enter 940, not #940.</p></div><div class="settings-field full"><label>Alliance timezone</label><select class="settings-input" name="timezone" required>${options}</select></div></div><div class="settings-actions"><button class="settings-button" type="submit">Save alliance details</button></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title:"Alliance Details",description:"Enter these exactly as they appear in Last War. The platform adds brackets and the server number symbol when displaying them.",body,activePath:"/ui-v2/settings/details",back:{href:"/ui-v2/settings",label:"Alliance Settings"}}));
}

async function saveDetails(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDetails||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),name=String(form.get("name")??"").trim(),tag=String(form.get("tag")??"").trim(),serverRaw=String(form.get("server_number")??"").trim(),timezone=String(form.get("timezone")??"").trim(),serverNumber=Number(serverRaw);
  if(!name||name.length>80||!tag||tag.length>12||!/^[0-9]+$/.test(serverRaw)||!Number.isInteger(serverNumber)||serverNumber<1||serverNumber>99999||!validTimezone(timezone))return redirect(request,"/ui-v2/settings/details?error=Please%20check%20the%20alliance%20details.");
  const oldTimezone=await env.DB.prepare("SELECT value FROM settings WHERE key='alliance_timezone'").first<{value:string}>(),old={name:context.alliance.name,tag:context.alliance.tag,serverNumber:context.alliance.serverNumber,timezone:oldTimezone?.value||"Europe/London"},next={name,tag,serverNumber,timezone};
  await env.DB.batch([env.DB.prepare("UPDATE alliance SET name=?,tag=?,server_number=?,updated_at=CURRENT_TIMESTAMP WHERE id=1").bind(name,tag,serverNumber),env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('alliance_timezone',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(timezone),audit(env,context,"alliance.settings.updated","alliance","1",old,next)]);
  return redirect(request,"/ui-v2/settings/details?saved=1");
}

async function playerSettingsPage(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManagePlayerSettings)return forbidden(context,"Player Settings");
  const result=await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('player_max_base_level','player_max_overlord_level','player_vs_daily_target')").all<SettingRow>(),values=settings(result),base=Number(values.player_max_base_level||35),overlord=Number(values.player_max_overlord_level||6),vsTarget=Number(values.player_vs_daily_target||7200000);
  const body=`${css}${notice(new URL(request.url))}<section class="settings-panel"><form class="settings-form" method="post" action="/ui-v2/settings/players"><div class="settings-fields"><div class="settings-field"><label>Maximum base level</label><input class="settings-input" name="max_base_level" type="number" min="1" max="999" required value="${base}"><p class="settings-hint">Change this once if the game raises the base cap.</p></div><div class="settings-field"><label>Maximum Overlord level</label><input class="settings-input" name="max_overlord_level" type="number" min="1" max="999" required value="${overlord}"><p class="settings-hint">Player profiles use this as their Overlord limit.</p></div><div class="settings-field"><label>Daily VS player target</label><input class="settings-input" name="vs_daily_target" type="number" min="1" max="999999999999" step="1" required value="${vsTarget}"><p class="settings-hint">Used to count how many players reach the daily contribution target. Currently ${(vsTarget/1000000).toFixed(1).replace(/\.0$/,"")}M.</p></div></div><div class="settings-actions"><button class="settings-button" type="submit">Save player settings</button></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title:"Player Settings",description:"Alliance-wide limits used when managing player profiles.",body,activePath:"/ui-v2/settings/players",back:{href:"/ui-v2/settings",label:"Alliance Settings"}}));
}

async function savePlayerSettings(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManagePlayerSettings||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),base=Number(form.get("max_base_level")),overlord=Number(form.get("max_overlord_level")),vsTarget=Number(form.get("vs_daily_target"));
  if(!Number.isInteger(base)||base<1||base>999||!Number.isInteger(overlord)||overlord<1||overlord>999||!Number.isSafeInteger(vsTarget)||vsTarget<1||vsTarget>999999999999)return redirect(request,"/ui-v2/settings/players?error=Please%20enter%20valid%20player%20limits.");
  const old=settings(await env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('player_max_base_level','player_max_overlord_level','player_vs_daily_target')").all<SettingRow>()),next={player_max_base_level:base,player_max_overlord_level:overlord,player_vs_daily_target:vsTarget};
  await env.DB.batch([env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('player_max_base_level',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(String(base)),env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('player_max_overlord_level',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(String(overlord)),env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('player_vs_daily_target',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(String(vsTarget)),audit(env,context,"settings.players.updated","settings","player_limits",old,next)]);
  return redirect(request,"/ui-v2/settings/players?saved=1");
}

const botInstallUrl=(env:UiV2Env)=>{if(!env.DISCORD_CLIENT_ID)return null;const url=new URL("https://discord.com/oauth2/authorize");url.searchParams.set("client_id",env.DISCORD_CLIENT_ID);url.searchParams.set("scope","bot applications.commands");url.searchParams.set("permissions","268520448");return url.toString()};
const guild=async(env:UiV2Env)=>env.DB.prepare("SELECT guild_id,guild_name,guild_icon,connected_at,verified_at FROM discord_guild_connection WHERE id=1").first<GuildRow>();

async function discordPage(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDiscord)return forbidden(context,"Discord");
  const current=await guild(env),url=new URL(request.url),install=botInstallUrl(env),changing=url.searchParams.get("action")==="change",disconnecting=url.searchParams.get("action")==="disconnect";
  let message=notice(url);
  if(url.searchParams.get("connected"))message='<div class="settings-notice">Discord server connected and verified.</div>';
  if(url.searchParams.get("disconnected"))message='<div class="settings-notice">Discord server disconnected.</div>';
  const status=current?`<div class="discord-status"><div><span>Connection</span><strong>Connected</strong></div><div><span>Server</span><strong>${esc(current.guild_name)}</strong></div><div><span>Verified</span><strong>${esc(current.verified_at)}</strong></div></div>`:`<div class="discord-status"><div><span>Connection</span><strong>Not connected</strong></div><div><span>Server</span><strong>No server configured</strong></div><div><span>Features</span><strong>Waiting for connection</strong></div></div>`;
  const connect=`${install?`<a class="settings-button" target="_blank" rel="noopener" href="${esc(install)}">${current?"1. Add bot to new server":"1. Connect Discord server"}</a>`:'<span class="settings-notice error">Discord Client ID is not configured.</span>'}<form method="post" action="/ui-v2/settings/discord/verify"><button class="settings-button secondary" type="submit">${current?"2. Verify and switch server":"2. Verify Discord connection"}</button></form>`;
  let actions=current?`<div class="settings-actions"><a class="settings-button" href="/ui-v2/settings/discord-setup">Set up server and bot</a><a class="settings-button secondary" href="/ui-v2/settings/discord-rank-sync">Preview and sync rank roles</a><a class="settings-button secondary" href="/ui-v2/settings/discord-notifications">Notification settings</a><a class="settings-button secondary" href="/ui-v2/settings/discord-shield-reminders">Shield reminder schedule</a><a class="settings-button secondary" href="/ui-v2/settings/discord?action=change">Change server</a><a class="settings-button danger" href="/ui-v2/settings/discord?action=disconnect">Disconnect server</a></div>`:`<div class="settings-actions">${connect}</div>`;
  if(changing)actions=`<div class="settings-notice">The current server stays connected until the new one is successfully verified.</div><div class="settings-actions">${connect}<a class="settings-button secondary" href="/ui-v2/settings/discord">Cancel</a></div>`;
  if(disconnecting&&current)actions=`<div class="danger-panel"><h2>Disconnect ${esc(current.guild_name)}?</h2><p>Discord features will stop until another server is connected.</p><div class="settings-actions"><a class="settings-button secondary" href="/ui-v2/settings/discord">Cancel</a><form method="post" action="/ui-v2/settings/discord/disconnect"><button class="settings-button danger" type="submit">Disconnect server</button></form></div></div>`;
  const body=`${css}${message}<section class="settings-panel">${status}${actions}</section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title:current?"Discord Connected":"Connect Discord",description:"Connect the alliance Discord server used for sign-in and platform notifications.",body,activePath:"/ui-v2/settings/discord",back:{href:"/ui-v2/settings",label:"Alliance Settings"}}));
}

async function verifyDiscord(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDiscord||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  if(!env.DISCORD_BOT_TOKEN)return redirect(request,"/ui-v2/settings/discord?error=Discord%20bot%20token%20is%20not%20configured.");
  try{
    const response=await fetch("https://discord.com/api/v10/users/@me/guilds",{headers:{authorization:`Bot ${env.DISCORD_BOT_TOKEN}`}});
    if(!response.ok)throw new Error(`Discord guilds ${response.status}`);
    const guilds=await response.json<DiscordGuild[]>(),current=await guild(env),candidates=current?guilds.filter(item=>item.id!==current.guild_id):guilds;
    if(!candidates.length)return redirect(request,`/ui-v2/settings/discord?error=${encodeURIComponent(current&&guilds.some(item=>item.id===current.guild_id)?"The bot is still only in the current server. Add it to the new server first.":"The bot is not visible in a Discord server yet.")}`);
    if(candidates.length>1)return redirect(request,`/ui-v2/settings/discord?error=${encodeURIComponent(`The bot can see ${candidates.length} possible servers. Keep it only in the server you want to connect.`)}`);
    const next=candidates[0],action=current?"discord.guild.changed":"discord.guild.connected";
    await env.DB.batch([env.DB.prepare("INSERT INTO discord_guild_connection (id,guild_id,guild_name,guild_icon,connected_by_account_id) VALUES (1,?,?,?,?) ON CONFLICT(id) DO UPDATE SET guild_id=excluded.guild_id,guild_name=excluded.guild_name,guild_icon=excluded.guild_icon,connected_by_account_id=excluded.connected_by_account_id,verified_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP").bind(next.id,next.name,next.icon??null,context.user.accountId),env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('setup_complete','true',CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value='true',updated_at=CURRENT_TIMESTAMP"),audit(env,context,action,"discord_guild",next.id,current?{guildId:current.guild_id,guildName:current.guild_name}:null,{guildId:next.id,guildName:next.name})]);
    return redirect(request,current?"/ui-v2/settings/discord?connected=1":"/ui-v2/settings/discord-setup?connected=1");
  }catch(error){console.error("Discord verification failed",error);return redirect(request,"/ui-v2/settings/discord?error=Discord%20connection%20could%20not%20be%20verified.")}
}

async function disconnectDiscord(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDiscord||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const current=await guild(env);if(!current)return redirect(request,"/ui-v2/settings/discord");
  await env.DB.batch([env.DB.prepare("DELETE FROM discord_guild_connection WHERE id=1"),audit(env,context,"discord.guild.disconnected","discord_guild",current.guild_id,{guildId:current.guild_id,guildName:current.guild_name},{connected:false})]);
  return redirect(request,"/ui-v2/settings/discord?disconnected=1");
}

export async function handleUiV2Settings(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(path==="/ui-v2/settings"&&request.method==="GET")return home(env,context);
  if(path==="/ui-v2/settings/details")return request.method==="GET"?detailsPage(request,env,context):request.method==="POST"?saveDetails(request,env,context):new Response("Method not allowed",{status:405});
  if(path==="/ui-v2/settings/players")return request.method==="GET"?playerSettingsPage(request,env,context):request.method==="POST"?savePlayerSettings(request,env,context):new Response("Method not allowed",{status:405});
  if(path==="/ui-v2/settings/discord"&&request.method==="GET")return discordPage(request,env,context);
  if(path==="/ui-v2/settings/discord/verify"&&request.method==="POST")return verifyDiscord(request,env,context);
  if(path==="/ui-v2/settings/discord/disconnect"&&request.method==="POST")return disconnectDiscord(request,env,context);
  return null;
}
