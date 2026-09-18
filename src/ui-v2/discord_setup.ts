import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type Guild={guild_id:string;guild_name:string};
type DiscordChannel={id:string;name:string;type:number};
type DiscordRole={id:string;name:string};
type DiscordUser={id:string;username:string;global_name?:string|null;avatar?:string|null};

const API="https://discord.com/api/v10";
const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const audit=(env:UiV2Env,context:UiV2Context,action:string,values:unknown)=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,"discord_setup","settings","ui-v2-discord",JSON.stringify(values));

async function discord<T>(env:UiV2Env,path:string,init:RequestInit={}){
  if(!env.DISCORD_BOT_TOKEN)throw new Error("Discord bot token is not configured");
  const headers=new Headers(init.headers);headers.set("authorization",`Bot ${env.DISCORD_BOT_TOKEN}`);if(init.body)headers.set("content-type","application/json");
  const response=await fetch(`${API}${path}`,{...init,headers});
  if(!response.ok)throw new Error(`Discord ${path} ${response.status}`);
  return response.status===204?null as T:response.json<T>();
}

const css=`<style>
.dsu-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}.dsu-card{padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.dsu-card h2{margin:0 0 7px;font-size:1rem}.dsu-card p{margin:0 0 13px;color:var(--ui-muted);font-size:.76rem;line-height:1.55}.dsu-list{display:grid;gap:7px;margin:13px 0}.dsu-list div{padding:10px;border:1px solid var(--ui-line);border-radius:9px;background:var(--ui-surface-3);font-size:.72rem}.dsu-button{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border:1px solid transparent;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-weight:900;text-decoration:none;cursor:pointer}.dsu-button.secondary{border-color:var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.dsu-actions{display:flex;flex-wrap:wrap;gap:9px}.dsu-field{display:block;margin-bottom:13px}.dsu-field span{display:block;margin-bottom:6px;font-size:.72rem;font-weight:900}.dsu-field input{width:100%;padding:11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.dsu-field small{display:block;margin-top:6px;color:var(--ui-muted);font-size:.66rem;line-height:1.45}.dsu-note{margin-bottom:14px;padding:12px;border:1px solid var(--ui-line);border-radius:10px;color:var(--ui-secondary)}.dsu-wide{grid-column:1/-1}@media(max-width:700px){.dsu-grid{grid-template-columns:1fr}.dsu-wide{grid-column:auto}.dsu-button{width:100%}}
</style>`;

async function page(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDiscord)return new Response("Forbidden",{status:403});
  const guild=await env.DB.prepare("SELECT guild_id,guild_name FROM discord_guild_connection WHERE id=1").first<Guild>();
  if(!guild)return redirect(request,"/ui-v2/settings/discord?error=Connect%20a%20Discord%20server%20first.");
  let bot:DiscordUser|null=null;try{bot=await discord<DiscordUser>(env,"/users/@me")}catch{}
  const url=new URL(request.url),result=url.searchParams.get("result"),error=url.searchParams.get("error"),note=url.searchParams.has("connected")?'<div class="dsu-note">Discord is connected. Choose how this server should be configured.</div>':result==="created"?'<div class="dsu-note">Discord structure created and notification channels connected.</div>':result==="identity"?'<div class="dsu-note">Bot name and server image updated.</div>':error?`<div class="dsu-note">${esc(error)}</div>`:"";
  const body=`${css}${note}<div class="dsu-grid"><section class="dsu-card"><h2>Build recommended structure</h2><p>Best for a new or empty Discord server. The platform will create only the items it needs.</p><div class="dsu-list"><div><strong>Alliance Platform</strong> · category</div><div><strong>#alliance-updates</strong> · public platform posts</div><div><strong>#leadership</strong> · private leadership posts</div><div><strong>Alliance Leadership</strong> · role with access to the private channel</div></div><form method="post" action="/ui-v2/settings/discord-setup/create"><button class="dsu-button" type="submit">Create recommended structure</button></form></section><section class="dsu-card"><h2>Use existing channels</h2><p>Best when the Discord server is already organised. Nothing will be created or renamed.</p><p>Choose an existing public updates channel and an existing private Leadership channel from the server.</p><div class="dsu-actions"><a class="dsu-button secondary" href="/ui-v2/settings/discord-notifications">Choose existing channels</a></div></section><section class="dsu-card dsu-wide"><h2>Bot appearance in ${esc(guild.guild_name)}</h2><p>This changes how the bot appears in this server only. It does not alter the Discord application used by other installations.</p><form method="post" action="/ui-v2/settings/discord-setup/identity" enctype="multipart/form-data"><label class="dsu-field"><span>Bot name</span><input name="bot_name" maxlength="32" required value="${esc(bot?.global_name||bot?.username||"Alliance Platform")}"><small>Between 2 and 32 characters.</small></label><label class="dsu-field"><span>Server bot image</span><input name="bot_image" type="file" accept="image/png,image/jpeg,image/webp,image/gif"><small>PNG, JPEG, WebP or GIF; maximum 256 KB. Leave blank to keep the current image.</small></label><button class="dsu-button" type="submit">Save bot appearance</button></form></section></div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Discord",title:"Server Setup",description:"Create the recommended Discord structure or connect channels already in use.",body,activePath:"/ui-v2/settings/discord",back:{href:"/ui-v2/settings/discord",label:"Discord Settings"}}));
}

async function createStructure(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDiscord||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const guild=await env.DB.prepare("SELECT guild_id,guild_name FROM discord_guild_connection WHERE id=1").first<Guild>();if(!guild)return redirect(request,"/ui-v2/settings/discord");
  const existing=await discord<DiscordChannel[]>(env,`/guilds/${guild.guild_id}/channels`);
  if(existing.some(channel=>channel.name==="alliance-updates"||channel.name==="leadership"))return redirect(request,"/ui-v2/settings/discord-setup?error="+encodeURIComponent("A recommended channel name already exists. Use the existing-channel option to avoid duplicates."));
  const created:string[]=[];let createdRole:string|null=null;
  try{
    const roles=await discord<DiscordRole[]>(env,`/guilds/${guild.guild_id}/roles`),existingRole=roles.find(item=>item.name==="Alliance Leadership"),role=existingRole||await discord<DiscordRole>(env,`/guilds/${guild.guild_id}/roles`,{method:"POST",body:JSON.stringify({name:"Alliance Leadership",permissions:"0",mentionable:false})});if(!existingRole)createdRole=role.id;
    const bot=await discord<DiscordUser>(env,"/users/@me"),category=await discord<DiscordChannel>(env,`/guilds/${guild.guild_id}/channels`,{method:"POST",body:JSON.stringify({name:"Alliance Platform",type:4})});created.push(category.id);
    const updates=await discord<DiscordChannel>(env,`/guilds/${guild.guild_id}/channels`,{method:"POST",body:JSON.stringify({name:"alliance-updates",type:0,parent_id:category.id,topic:"Alliance announcements and updates from The Alliance Management Platform"})});created.push(updates.id);
    const leadership=await discord<DiscordChannel>(env,`/guilds/${guild.guild_id}/channels`,{method:"POST",body:JSON.stringify({name:"leadership",type:0,parent_id:category.id,topic:"Private alliance leadership updates",permission_overwrites:[{id:guild.guild_id,type:0,deny:"1024",allow:"0"},{id:role.id,type:0,deny:"0",allow:"84992"},{id:bot.id,type:1,deny:"0",allow:"84992"}]})});created.push(leadership.id);
    await env.DB.batch([env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('discord_alliance_channel_id',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(updates.id),env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('discord_leadership_channel_id',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(leadership.id),env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('discord_leadership_role_id',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(role.id),audit(env,context,"discord.structure.created",{guildId:guild.guild_id,category:category.id,updates:updates.id,leadership:leadership.id,leadershipRole:role.id})]);
    return redirect(request,"/ui-v2/settings/discord-setup?result=created");
  }catch(error){console.error("Discord structure creation failed",error);for(const id of created.reverse())try{await discord(env,`/channels/${id}`,{method:"DELETE"})}catch{}if(createdRole)try{await discord(env,`/guilds/${guild.guild_id}/roles/${createdRole}`,{method:"DELETE"})}catch{}return redirect(request,"/ui-v2/settings/discord-setup?error="+encodeURIComponent("The structure could not be created. Check that the bot can manage channels and roles."))}
}

const imageData=async(file:File)=>{const allowed=new Set(["image/png","image/jpeg","image/webp","image/gif"]);if(!allowed.has(file.type)||file.size>262144)throw new Error("invalid image");const bytes=new Uint8Array(await file.arrayBuffer());let binary="";for(let offset=0;offset<bytes.length;offset+=8192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));return `data:${file.type};base64,${btoa(binary)}`};

async function saveIdentity(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageDiscord||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const guild=await env.DB.prepare("SELECT guild_id FROM discord_guild_connection WHERE id=1").first<Guild>();if(!guild)return redirect(request,"/ui-v2/settings/discord");
  const form=await request.formData(),name=String(form.get("bot_name")||"").trim(),file=form.get("bot_image");if(name.length<2||name.length>32)return redirect(request,"/ui-v2/settings/discord-setup?error="+encodeURIComponent("Enter a bot name between 2 and 32 characters."));
  try{const payload:Record<string,string>={nick:name};if(file instanceof File&&file.size)payload.avatar=await imageData(file);await discord(env,`/guilds/${guild.guild_id}/members/@me`,{method:"PATCH",body:JSON.stringify(payload)});await env.DB.batch([env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES('discord_bot_display_name',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(name),audit(env,context,"discord.bot_identity.updated",{name,imageUpdated:Boolean(file instanceof File&&file.size)})]);return redirect(request,"/ui-v2/settings/discord-setup?result=identity")}catch(error){console.error("Discord bot identity update failed",error);return redirect(request,"/ui-v2/settings/discord-setup?error="+encodeURIComponent("The bot appearance could not be updated. Check the image and bot permissions."))}
}

export async function handleUiV2DiscordSetup(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;if(path==="/ui-v2/settings/discord-setup")return request.method==="GET"?page(request,env,context):new Response("Method not allowed",{status:405});if(path==="/ui-v2/settings/discord-setup/create")return request.method==="POST"?createStructure(request,env,context):new Response("Method not allowed",{status:405});if(path==="/ui-v2/settings/discord-setup/identity")return request.method==="POST"?saveIdentity(request,env,context):new Response("Method not allowed",{status:405});return null;
}
