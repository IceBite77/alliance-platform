import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type PlayerRow={
  id:number;
  display_name:string;
  rank:number;
  base_level:number|null;
  is_active:number;
  joined_at:string|null;
  left_at:string|null;
  rank_name:string|null;
  rank_image:string|null;
  rank_colour:string|null;
  account_id:number|null;
  account_status:string|null;
  account_active:number|null;
  discord_username:string|null;
};

type PendingRow={display_name:string;provider_username:string|null;created_at:string};

const assetUrl=(key:string)=>`/assets/${encodeURIComponent(key)}`;

const playersCss=`<style>
.player-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:11px;margin-bottom:22px}.summary-item{padding:14px 16px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-2)}.summary-item span,.summary-item strong{display:block}.summary-item span{color:var(--ui-muted);font-size:.67rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.summary-item strong{margin-top:5px;font-size:1.25rem}.waiting-panel{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:18px;padding:15px 17px;border:1px solid color-mix(in srgb,var(--ui-warning) 50%,var(--ui-line));border-radius:13px;background:color-mix(in srgb,var(--ui-warning) 9%,var(--ui-surface-2))}.waiting-panel strong,.waiting-panel span{display:block}.waiting-panel strong{color:var(--ui-warning)}.waiting-panel span{margin-top:4px;color:var(--ui-muted);font-size:.8rem}.waiting-panel a{flex:0 0 auto;padding:9px 12px;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.75rem;font-weight:850;text-decoration:none}.players-toolbar{display:grid;grid-template-columns:minmax(220px,1fr) auto auto;gap:11px;align-items:center;margin-bottom:17px}.player-search{width:100%;padding:11px 13px;border:1px solid var(--ui-line-strong);border-radius:10px;background:var(--ui-surface-3);color:var(--ui-text)}.player-search::placeholder{color:var(--ui-muted)}.filter-set{display:flex;gap:7px}.filter-button{padding:10px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-navigation);font-size:.75rem;font-weight:850;cursor:pointer}.filter-button:hover,.filter-button.active{border-color:var(--ui-hover);color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 8%,var(--ui-surface-3))}.add-player{padding:11px 13px;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:900;text-decoration:none;white-space:nowrap}.result-line{margin:0 0 10px;color:var(--ui-muted);font-size:.75rem}.player-list{display:grid;gap:9px}.player-row{display:grid;grid-template-columns:52px minmax(0,1fr) auto 24px;gap:13px;align-items:center;padding:12px 14px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2);color:inherit;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.player-row[hidden]{display:none}.player-row:hover{border-color:var(--ui-hover);box-shadow:0 0 18px color-mix(in srgb,var(--ui-hover) 11%,transparent);transform:translateY(-1px)}.rank-mark{width:46px;height:46px;display:grid;place-items:center;border:1px solid var(--ui-line-strong);border-radius:11px;background:var(--ui-surface-3);color:var(--player-rank,#d7a83e);font-size:.75rem;font-weight:900;overflow:hidden}.rank-mark img{display:block;width:100%;height:100%;object-fit:contain}.player-name{font-weight:900}.player-meta{margin-top:4px;color:var(--player-rank,#d7a83e);font-size:.76rem}.player-state{text-align:right}.state-label{font-size:.73rem;font-weight:900}.state-label.active{color:var(--ui-success)}.state-label.former{color:var(--ui-danger)}.login-state{display:block;margin-top:4px;color:var(--ui-muted);font-size:.68rem}.login-state.linked{color:var(--ui-success)}.login-state.disabled{color:var(--ui-danger)}.login-state.pending{color:var(--ui-warning)}.row-arrow{color:var(--ui-navigation);font-size:1.2rem}.empty-state{display:none;padding:28px;border:1px dashed var(--ui-line-strong);border-radius:13px;color:var(--ui-muted);text-align:center}.empty-state.show{display:block}@media(max-width:850px){.player-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.players-toolbar{grid-template-columns:1fr auto}.filter-set{grid-row:2;grid-column:1/-1}.filter-button{flex:1}.add-player{grid-column:2;grid-row:1}}@media(max-width:650px){.waiting-panel{display:block}.waiting-panel a{display:inline-flex;margin-top:12px}.players-toolbar{grid-template-columns:1fr}.add-player{grid-column:1;grid-row:auto;text-align:center}.filter-set{grid-column:1;grid-row:auto}.player-row{grid-template-columns:46px minmax(0,1fr) 18px;padding:11px}.player-state{display:none}.rank-mark{width:42px;height:42px}.player-summary{gap:8px}.summary-item{padding:12px}}
</style>`;

const summaryCss=`<style>
.summary-item{width:100%;color:var(--ui-text);font:inherit;text-align:left;text-decoration:none;cursor:pointer;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.summary-item:hover,.summary-item.active{border-color:var(--ui-hover);box-shadow:0 0 18px color-mix(in srgb,var(--ui-hover) 12%,transparent);transform:translateY(-1px)}.summary-item.waiting.has-waiting{border-color:var(--ui-warning);background:color-mix(in srgb,var(--ui-warning) 9%,var(--ui-surface-2));animation:waiting-pulse 1.7s ease-in-out infinite}.summary-item.waiting.has-waiting span,.summary-item.waiting.has-waiting strong{color:var(--ui-warning)}@keyframes waiting-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--ui-warning) 0%,transparent)}50%{box-shadow:0 0 0 4px color-mix(in srgb,var(--ui-warning) 24%,transparent),0 0 22px color-mix(in srgb,var(--ui-warning) 24%,transparent)}}@media(prefers-reduced-motion:reduce){.summary-item.waiting.has-waiting{animation:none}}
.player-notice{margin-bottom:17px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.8rem;font-weight:800}
</style>`;

function rankLabel(player:PlayerRow){
  const configured=player.rank_name?.trim();
  return `R${player.rank}${configured&&configured.toLowerCase()!==`r${player.rank}`.toLowerCase()?` · ${configured}`:""}`;
}

function playerRows(players:PlayerRow[]){
  return players.map(player=>{
    const rankArt=player.rank_image?`<img src="${assetUrl(player.rank_image)}" alt="">`:`R${player.rank}`;
    const meta=[rankLabel(player),player.base_level?`Base ${player.base_level}`:null,player.discord_username?`Discord: ${player.discord_username}`:null].filter(Boolean).join(" · ");
    const search=`${player.display_name} ${rankLabel(player)} ${player.discord_username||""}`.toLowerCase();
    const linked=Boolean(player.discord_username&&player.account_id&&player.account_status==="active"&&player.account_active===1);
    const disabled=Boolean(player.account_id&&(player.account_active===0||player.account_status==="disabled"||player.account_status==="rejected"));
    const pending=Boolean(player.account_id&&player.account_status==="pending");
    const loginText=linked?"Discord linked":disabled?"Account disabled":pending?"Waiting for access":"No Discord login";
    const loginClass=linked?" linked":disabled?" disabled":pending?" pending":"";
    return `<a class="player-row" href="/players/${player.id}" style="--player-rank:${player.rank_colour||"#d7a83e"}" data-player-row data-state="${player.is_active?"active":"former"}" data-account="${linked?"linked":disabled?"disabled":pending?"pending":"unlinked"}" data-search="${esc(search)}"><div class="rank-mark">${rankArt}</div><div><div class="player-name">${esc(player.display_name)}</div><div class="player-meta">${esc(meta)}</div></div><div class="player-state"><span class="state-label ${player.is_active?"active":"former"}">${player.is_active?"Active member":"Former member"}</span><span class="login-state${loginClass}">${loginText}</span></div><span class="row-arrow">›</span></a>`;
  }).join("");
}

const playersScript=`<script>(()=>{const search=document.querySelector('[data-player-search]'),rows=[...document.querySelectorAll('[data-player-row]')],buttons=[...document.querySelectorAll('[data-player-filter]')],count=document.querySelector('[data-player-count]'),empty=document.querySelector('[data-player-empty]');let filter='active';const update=()=>{const term=(search?.value||'').trim().toLowerCase();let shown=0;rows.forEach(row=>{const matchesFilter=filter==='all'||(filter==='linked'?row.dataset.account==='linked':row.dataset.state===filter);const visible=matchesFilter&&(!term||row.dataset.search.includes(term));row.hidden=!visible;if(visible)shown++});buttons.forEach(item=>{const active=item.dataset.playerFilter===filter;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});if(count)count.textContent=shown+' '+(shown===1?'player':'players');empty?.classList.toggle('show',shown===0)};search?.addEventListener('input',update);buttons.forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.playerFilter;update()}));update();})();</script>`;

export async function renderUiV2Players(env:UiV2Env,context:UiV2Context,url:URL){
  if(!context.user.canManagePlayers)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Management",title:"Players",description:"You do not have permission to manage players.",body:"",activePath:"/ui-v2/players"}),403);
  const [playerResult,pendingResult]=await Promise.all([
    env.DB.prepare(`SELECT p.id,p.display_name,p.rank,p.base_level,p.is_active,p.joined_at,p.left_at,r.display_name rank_name,r.image_path rank_image,r.colour rank_colour,a.id account_id,a.approval_status account_status,a.is_active account_active,i.provider_username discord_username FROM players p LEFT JOIN alliance_ranks r ON r.rank_level=p.rank LEFT JOIN accounts a ON a.player_id=p.id LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' ORDER BY p.is_active DESC,p.display_name COLLATE NOCASE`).all<PlayerRow>(),
    env.DB.prepare(`SELECT a.display_name,i.provider_username,a.created_at FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.approval_status='pending' ORDER BY a.created_at`).all<PendingRow>()
  ]);
  const players=playerResult.results??[],pending=pendingResult.results??[];
  const active=players.filter(player=>player.is_active).length,former=players.length-active,linked=players.filter(player=>player.discord_username&&player.account_id&&player.account_status==="active"&&player.account_active===1).length;
  const waiting=pending.length?`<div class="waiting-panel"><div><strong>${pending.length} ${pending.length===1?"account is":"accounts are"} waiting for access</strong><span>${esc(pending.slice(0,3).map(item=>item.provider_username||item.display_name).join(", "))}${pending.length>3?` and ${pending.length-3} more`:""}</span></div>${context.user.canApproveAccounts?'<a href="/ui-v2/players/access">Review access</a>':""}</div>`:"";
  const waitingCard=context.user.canApproveAccounts?`<a class="summary-item waiting${pending.length?" has-waiting":""}" href="/ui-v2/players/access"><span>Waiting access</span><strong>${pending.length}</strong></a>`:`<div class="summary-item waiting${pending.length?" has-waiting":""}" style="cursor:default"><span>Waiting access</span><strong>${pending.length}</strong></div>`;
  const created=url.searchParams.get("created"),createdNotice=created?`<div class="player-notice">${esc(created)} was added to the active roster.</div>`:"";
  const body=`${playersCss}${summaryCss}${createdNotice}<div class="player-summary"><button class="summary-item active" type="button" aria-pressed="true" data-player-filter="active"><span>Active</span><strong>${active}</strong></button><button class="summary-item" type="button" aria-pressed="false" data-player-filter="former"><span>Former</span><strong>${former}</strong></button><button class="summary-item" type="button" aria-pressed="false" data-player-filter="linked"><span>Discord linked</span><strong>${linked}</strong></button>${waitingCard}</div>${waiting}<div class="players-toolbar"><input class="player-search" type="search" placeholder="Search players, ranks or Discord…" aria-label="Search players" data-player-search><div class="filter-set" aria-label="Player status filter"><button class="filter-button active" type="button" aria-pressed="true" data-player-filter="active">Active</button><button class="filter-button" type="button" aria-pressed="false" data-player-filter="former">Former</button><button class="filter-button" type="button" aria-pressed="false" data-player-filter="all">All</button></div>${context.user.canManageMembership?'<a class="add-player" href="/ui-v2/players/new">+ Add player</a>':""}</div><p class="result-line"><span data-player-count>${active} players</span> shown</p><div class="player-list">${playerRows(players)}</div><div class="empty-state" data-player-empty>No players match this view.</div>${playersScript}`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Management",title:"Players",description:"Manage the alliance roster, membership lifecycle and linked Discord accounts.",body,activePath:"/ui-v2/players"}));
}
