import app from "./player_birthday_ui";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }
type Identity={display_name:string;rank:number;rank_name:string|null;show_rank_names:string|null};
const SESSION_COOKIE="ap_session";
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const cookie=(r:Request,n:string)=>{for(const p of(r.headers.get("cookie")??"").split(";")){const [x,...z]=p.trim().split("=");if(x===n)return z.join("=")}return null};
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
const hash=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const identity=async(r:Request,e:Env)=>{const t=cookie(r,SESSION_COOKIE);if(!t)return null;return await e.DB.prepare(`SELECT p.display_name,p.rank,ar.display_name AS rank_name,(SELECT value FROM settings WHERE key='show_rank_names' LIMIT 1) AS show_rank_names FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN players p ON p.id=a.player_id LEFT JOIN alliance_ranks ar ON ar.rank_level=p.rank WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 AND a.approval_status='active' LIMIT 1`).bind(await hash(t)).first<Identity>()};
const allianceName=async(e:Env)=>{const row=await e.DB.prepare("SELECT name FROM alliance WHERE id=1 LIMIT 1").first<{name:string}>();return row?.name?.trim()||"Alliance"};
const discordStatus=async(e:Env)=>await e.DB.prepare("SELECT guild_name FROM discord_guild_connection WHERE id=1 LIMIT 1").first<{guild_name:string}>().catch(()=>null);
const normalize=(v:unknown)=>v instanceof Response?v:new Response(String(v??""),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});

const polishDashboard=async(html:string,e:Env)=>{
  const guild=await discordStatus(e);
  html=html.replace(/<div class="statusstrip">[\s\S]*?<\/div><div class="sectiontitle"><h2>Management<\/h2>/,`<div class="statusstrip"><div class="statuscard"><span>Platform</span><strong><i class="statusdot"></i>Online</strong></div><div class="statuscard"><span>Discord Server</span><strong>${guild?`<i class="statusdot"></i>Connected`:`<i class="statusdot" style="background:#d29aa5"></i>Not connected`}</strong>${guild?`<div style="color:#8292ae;font-size:.76rem;margin-top:4px">${esc(guild.guild_name)}</div>`:""}</div></div><div class="sectiontitle"><h2>Management</h2>`);
  html=html.replace(/<a class="navcard" href="\/settings\/alliance">[\s\S]*?<span class="navarrow">→<\/span><\/a>/,"");
  html=html.replace(/<div class="navcard coming">[\s\S]*?<div class="cardkicker">Data<\/div><h2>Backup &amp; Export<\/h2>[\s\S]*?<\/div>/,"");
  html=html.replace(/<div class="dashboardfooter">/,`<div class="sectiontitle"><h2>Settings</h2><p>Platform configuration and data tools</p></div><div class="adminmenu"><a class="navcard" href="/settings/alliance"><div class="cardkicker">Configuration</div><h2>Alliance Settings</h2><p>Alliance details, branding, Discord connection and rank setup.</p><span class="navarrow">→</span></a><div class="navcard coming"><div class="cardkicker">Data</div><h2>Backup &amp; Export</h2><p>Portable exports and recovery tools for the alliance owner.</p><span class="comingbadge">Coming soon</span></div></div><div class="dashboardfooter">`);
  return html;
};

export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const res=normalize(await (app as any).fetch(request,env));
    if(!res.headers.get("content-type")?.includes("text/html")) return res;
    let html=await res.text();
    const path=new URL(request.url).pathname;
    html=html.replaceAll(">← Dashboard<",">← Leadership Console<");
    if(path!=="/") html=html.replaceAll(">Leadership Console<",">← Leadership Console<");
    html=html.replaceAll(">Back to dashboard<",">Back to Leadership Console<");
    const currentTitle=html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
    if(currentTitle){const alliance=await allianceName(env);const page=path==="/"?"Leadership Console":currentTitle;html=html.replace(/<title>.*?<\/title>/i,`<title>${esc(alliance)} · ${page}</title>`)}
    if(path==="/") html=await polishDashboard(html,env);
    const who=await identity(request,env);
    if(who&&path!=="/"&&html.includes('<div class="adminbrand">')&&html.includes('<div class="crumb">')){
      const showNames=who.show_rank_names!=="0";
      const rankTitle=showNames&&who.rank_name&&who.rank_name!==`R${who.rank}`?` · ${esc(who.rank_name)}`:"";
      const signedIn=`<div class="adminidentitynav" style="margin-left:auto;text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:5px"><div class="signedinidentity" style="color:#90a0bb;font-size:.76rem;font-weight:700;white-space:nowrap">${esc(who.display_name)} · R${who.rank}${rankTitle}</div>`;
      html=html.replace('<div class="crumb">',`${signedIn}<div class="crumb" style="margin-left:0">`);
      html=html.replace(/(<div class="crumb" style="margin-left:0">[\s\S]*?<\/div>)/,`$1</div>`);
    }
    const responsive=`<style>@media(max-width:650px){.playerrow .pname{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:4px!important}.playerrow .pname>span{margin-left:0!important;max-width:100%;white-space:normal}.playerrow .meta{margin-top:5px}.actions button,.actions .button{font-size:1rem!important;font-weight:800!important;line-height:1.2!important;min-height:44px!important;display:flex!important;align-items:center!important;justify-content:center!important}.statusstrip{grid-template-columns:1fr!important}}@media(min-width:651px) and (max-width:900px){.fieldgrid:has(input[type=date]){grid-template-columns:1fr!important}}</style>`;
    html=html.replace("</head>",responsive+"</head>");
    const headers=new Headers(res.headers);headers.delete("content-length");
    return new Response(html,{status:res.status,statusText:res.statusText,headers});
  }
} satisfies ExportedHandler<Env>;
