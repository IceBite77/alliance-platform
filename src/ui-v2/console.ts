import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type CountRow={total:number};
type GuildRow={guild_name:string};

const icon=(name:"players"|"security"|"settings"|"vs"|"storm"|"away"|"intel"|"train"|"backup")=>{
  const paths={
    players:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    security:'<path d="M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4z"/><path d="M9 12l2 2 4-4"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l-2.83 2.83A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1.4 1.6h-3.2A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.91.31l-2.83-2.83A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 13.6v-3.2A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l2.83-2.83A1.7 1.7 0 0 0 9 4.6 1.7 1.7 0 0 0 10.4 3h3.2A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.91-.31l2.83 2.83A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.6 1.4v3.2a1.7 1.7 0 0 0-1.6 1.4z"/>',
    vs:'<path d="M6 3l12 18M18 3L6 21"/><path d="M4 5l2-2 3 3-2 2M20 5l-2-2-3 3 2 2"/>',
    storm:'<path d="M3 15h13a4 4 0 1 0-4-4M3 9h8a3 3 0 1 0-3-3M3 19h8a2 2 0 1 1-2 2"/>',
    away:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M9 16l2 2 4-4"/>',
    intel:'<path d="M4 19v-7M10 19V5M16 19v-4M22 19H2M4 9l6-4 6 6 5-5"/>',
    train:'<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 21l3-3M16 21l-3-3M5 12h14M8 7h8"/>',
    backup:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14a2 2 0 0 0 2-2v-2M3 17v2a2 2 0 0 0 2 2"/>'
  };
  return `<span class="console-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg></span>`;
};

const consoleCss=`<style>
.status-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:30px}.status-item{padding:15px 17px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.status-item span,.status-item strong{display:block}.status-item span{color:var(--ui-muted);font-size:.72rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase}.status-item strong{margin-top:7px;font-size:1rem}.status-online{display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;background:var(--ui-success);box-shadow:0 0 12px color-mix(in srgb,var(--ui-success) 60%,transparent)}.console-section{margin-top:30px;scroll-margin-top:20px}.section-head{margin-bottom:13px}.section-head h2{margin:0;font-size:1.2rem}.section-head p{margin:5px 0 0;color:var(--ui-muted);font-size:.87rem}.console-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.console-card{position:relative;min-height:232px;padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2);overflow:hidden}.console-card-link{display:block;color:inherit;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.console-card-link:hover{border-color:var(--ui-hover);box-shadow:0 0 0 1px color-mix(in srgb,var(--ui-hover) 22%,transparent),0 12px 32px rgba(0,0,0,.22),0 0 22px color-mix(in srgb,var(--ui-hover) 12%,transparent);transform:translateY(-2px)}.console-icon{display:grid;width:43px;height:43px;place-items:center;border:1px solid var(--ui-line-strong);border-radius:11px;background:var(--ui-surface-3);color:var(--ui-accent)}.console-icon svg{width:23px;height:23px}.card-kicker{display:block;margin-top:16px;color:var(--ui-accent);font-size:.68rem;font-weight:900;letter-spacing:.085em;text-transform:uppercase}.console-card h3{margin:6px 0 7px;font-size:1.15rem}.console-card p{margin:0;color:var(--ui-muted);font-size:.86rem;line-height:1.55}.card-arrow{position:absolute;right:18px;top:18px;color:var(--ui-navigation);font-size:1.2rem}.action-badge{display:inline-flex;margin-top:14px;padding:6px 9px;border:1px solid color-mix(in srgb,var(--ui-warning) 55%,var(--ui-line));border-radius:999px;background:color-mix(in srgb,var(--ui-warning) 12%,transparent);color:var(--ui-warning);font-size:.67rem;font-weight:900}.card-actions{display:grid;gap:7px;margin-top:15px}.card-actions a{display:flex;align-items:center;justify-content:space-between;padding:9px 11px;border:1px solid var(--ui-line);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-navigation);font-size:.76rem;font-weight:850;text-decoration:none}.card-actions a:hover{border-color:var(--ui-hover);color:var(--ui-hover)}.coming-card{opacity:.72}.coming-badge{display:inline-flex;margin-top:15px;padding:6px 9px;border:1px solid var(--ui-line-strong);border-radius:999px;color:var(--ui-secondary);font-size:.65rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}@media(max-width:900px){.status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.console-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.status-grid,.console-grid{grid-template-columns:1fr}.console-card{min-height:auto}.coming-card{min-height:190px}}
</style>`;

function managementCards(context:UiV2Context,pending:number){
  const cards:string[]=[];
  if(context.user.canManagePlayers)cards.push(`<a class="console-card console-card-link" href="/leadership/players">${icon("players")}<span class="card-arrow">→</span><span class="card-kicker">Members</span><h3>Players</h3><p>Roster, profiles, membership, birthdays, rank history and leadership notes.</p>${pending?`<span class="action-badge">${pending} ${pending===1?"account":"accounts"} waiting</span>`:""}</a>`);
  if(context.user.canManageSecurity||context.user.canViewAudit)cards.push(`<article class="console-card" id="security">${icon("security")}<span class="card-kicker">Security</span><h3>Security &amp; Access</h3><p>Manage platform access and review the record of meaningful changes.</p><div class="card-actions">${context.user.canManageSecurity?`<a href="/leadership/security"><span>Access &amp; Permissions</span><span>→</span></a>`:""}${context.user.canViewAudit?`<a href="/leadership/audit"><span>Audit Log</span><span>→</span></a>`:""}</div></article>`);
  if(context.user.canManageSettings)cards.push(`<article class="console-card" id="settings">${icon("settings")}<span class="card-kicker">Configuration</span><h3>Settings</h3><p>Alliance details, branding, Discord connection, ranks and player options.</p><div class="card-actions"><a href="/leadership/settings"><span>All Settings</span><span>→</span></a>${context.user.canManageBranding?`<a href="/ui-v2/branding"><span>Branding</span><span>→</span></a>`:""}</div></article>`);
  return cards.join("");
}

const comingCards=()=>[
  ["vs","Competition","VS","Battle Centre, performance history and daily contribution tools."],
  ["storm","Operations","Desert Storm","Selection, participation and performance history."],
  ["away","Members","Away","Track member availability and support fair leadership decisions."],
  ["intel","Analysis","Intelligence","Leadership watch, trends and alliance performance insights."],
  ["train","Alliance","Train","Alliance Train activity and supporting operational tools."],
  ["backup","Data","Backup & Export","Portable exports and recovery tools for the alliance owner."]
].map(([name,kicker,title,description])=>`<article class="console-card coming-card">${icon(name as Parameters<typeof icon>[0])}<span class="card-kicker">${kicker}</span><h3>${title}</h3><p>${description}</p><span class="coming-badge">Coming later</span></article>`).join("");

export async function renderUiV2Console(env:UiV2Env,context:UiV2Context){
  const [activePlayers,formerPlayers,pendingAccounts,guild]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) total FROM players WHERE is_active=1").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) total FROM players WHERE is_active=0").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) total FROM accounts WHERE approval_status='pending'").first<CountRow>(),
    env.DB.prepare("SELECT guild_name FROM discord_guild_connection WHERE id=1 LIMIT 1").first<GuildRow>().catch(()=>null)
  ]);
  const pending=Number(pendingAccounts?.total??0);
  const management=managementCards(context,pending);
  const body=`${consoleCss}<div class="status-grid"><div class="status-item"><span>Platform</span><strong><i class="status-online"></i>Online</strong></div><div class="status-item"><span>Discord</span><strong>${esc(guild?.guild_name||"Not connected")}</strong></div><div class="status-item"><span>Active players</span><strong>${Number(activePlayers?.total??0)}</strong></div><div class="status-item"><span>Former players</span><strong>${Number(formerPlayers?.total??0)}</strong></div></div>${management?`<section class="console-section"><div class="section-head"><h2>Management</h2><p>Your day-to-day alliance administration.</p></div><div class="console-grid">${management}</div></section>`:""}<section class="console-section"><div class="section-head"><h2>Alliance Operations</h2><p>These modules will move into the new UI after the core Leadership tools.</p></div><div class="console-grid">${comingCards()}</div></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Leadership",title:"Leadership Console",description:"Manage your alliance, platform access and configuration from one place.",body}));
}
