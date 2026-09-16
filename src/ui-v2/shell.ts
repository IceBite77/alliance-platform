import type {UiV2Context} from "./context";

export type UiV2Page={
  title:string;
  eyebrow?:string;
  description?:string;
  body:string;
};

export const esc=(value:unknown)=>String(value??"")
  .replaceAll("&","&amp;")
  .replaceAll("<","&lt;")
  .replaceAll(">","&gt;")
  .replaceAll('"',"&quot;")
  .replaceAll("'","&#039;");

const assetUrl=(key:string)=>`/assets/${encodeURIComponent(key)}`;

function allianceIdentity(context:UiV2Context){
  const tag=context.alliance.tag?`[${esc(context.alliance.tag)}]`:"Alliance";
  const server=context.alliance.serverNumber?`Server #${context.alliance.serverNumber}`:"Server not set";
  return `<span class="alliance-tag">${tag}</span><span class="identity-dot"> · </span><span class="server-number">${server}</span>`;
}

function rankIdentity(context:UiV2Context){
  if(!context.user.rank)return context.user.isOwner?"Owner":"Member";
  return `R${context.user.rank}${context.user.rankName?` · ${esc(context.user.rankName)}`:""}`;
}

function logo(context:UiV2Context){
  if(context.branding.mainLogo)return `<img src="${assetUrl(context.branding.mainLogo)}" alt="${esc(context.alliance.name)} crest">`;
  return `<span>${esc(context.alliance.tag?`[${context.alliance.tag}]`:"AMP")}</span>`;
}

function navigation(context:UiV2Context){
  return context.navigation.map(item=>`<a href="${esc(item.href)}">${esc(item.label)}</a>`).join("");
}

const styles=`
:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--ui-bg:#090e18;--ui-surface:#151d2e;--ui-surface-2:#0e1626;--ui-surface-3:#111b2e;--ui-line:#2b3850;--ui-line-strong:#3a4b68;--ui-text:#eef3ff;--ui-muted:#90a0bb;--ui-soft:#b8c4d9;--ui-accent:#63b9e8;--ui-secondary:#aebddd;--ui-rank-highlight:#d7a83e;--ui-alliance-tag:#63b9e8;--ui-server-number:#63b9e8;--ui-navigation:#aebddd;--ui-footer:#aebddd;--ui-button:#3a8fc3;--ui-button-text:#fff;--ui-hover:#63b9e8;--ui-success:#51d88a;--ui-warning:#f5c451;--ui-danger:#ed8796;--ui-site-name:#63b9e8;--ui-login-heading:#eef3ff;--ui-footer-wording:#aebddd;--ui-radius:20px;--ui-shadow:0 24px 70px rgba(0,0,0,.35)}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,var(--ui-bg) 100%);color:var(--ui-text);padding:24px}
button,input,select,textarea{font:inherit}
a{color:inherit}
.app-shell{width:min(94vw,1180px);margin:28px auto;background:var(--ui-surface);border:1px solid var(--ui-line);border-radius:var(--ui-radius);box-shadow:var(--ui-shadow);overflow:hidden}
.app-header{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:32px;min-height:168px;padding:26px 30px 24px;border-bottom:1px solid var(--ui-line)}
.alliance-brand{display:flex;align-items:center;gap:24px;min-width:0}
.alliance-mark{width:112px;height:112px;flex:0 0 112px;display:flex;align-items:center;justify-content:center;color:var(--ui-accent);font-size:.82rem;font-weight:900;text-align:center;overflow:hidden}
.alliance-mark img{display:block;width:100%;height:100%;object-fit:contain}
.alliance-copy{min-width:0}
.alliance-copy strong{display:block;font-size:2rem;line-height:1.08;font-weight:900;letter-spacing:-.025em;overflow-wrap:anywhere}
.alliance-copy>span{display:block;margin-top:10px;font-size:1rem;line-height:1.25;font-weight:800}.alliance-copy .alliance-tag{color:var(--ui-alliance-tag)}.alliance-copy .identity-dot{color:var(--ui-secondary)}.alliance-copy .server-number{color:var(--ui-server-number)}
.user-panel{display:flex;flex-direction:column;align-items:flex-end;gap:18px;min-width:310px;text-align:right}
.user-line{display:flex;align-items:baseline;justify-content:flex-end;gap:5px;white-space:nowrap}
.user-line .welcome{font-size:1.22rem;line-height:1.15;font-weight:900}
.user-line .rank{color:var(--ui-rank-highlight);font-size:1rem;line-height:1.2;font-weight:900;letter-spacing:.01em}
.header-actions{display:flex;align-items:center;gap:10px}
.console-link,.menu-button{display:inline-flex;align-items:center;justify-content:center;min-height:39px;padding:9px 16px;border:1px solid var(--ui-line-strong);border-radius:10px;background:var(--ui-surface-3);color:var(--ui-navigation);font-size:.82rem;font-weight:850;text-decoration:none;transition:border-color .15s ease,background .15s ease,transform .15s ease}
.console-link:hover{border-color:var(--ui-hover);box-shadow:0 0 0 1px color-mix(in srgb,var(--ui-hover) 22%,transparent),0 0 20px color-mix(in srgb,var(--ui-hover) 12%,transparent);background:#17243a;transform:translateY(-1px);color:var(--ui-text)}
.menu-button{display:none;width:42px;padding:9px;cursor:pointer}
.menu-button:hover{border-color:var(--ui-hover);color:var(--ui-hover)}
.menu-button svg{width:20px;height:20px;stroke:currentColor}
.mobile-menu{display:none;padding:9px 18px 18px;border-bottom:1px solid var(--ui-line);background:#10192a}
.mobile-menu a{display:block;padding:12px;border-radius:9px;color:var(--ui-navigation);font-size:.94rem;font-weight:780;text-decoration:none}
.mobile-menu a:hover{background:#18243a;color:var(--ui-hover)}
.app-content{padding:34px 30px 38px}
.page-heading{max-width:780px;margin-bottom:26px}
.eyebrow{margin:0 0 8px;color:var(--ui-accent);font-size:.76rem;font-weight:900;letter-spacing:.095em;text-transform:uppercase}
h1{margin:0;font-size:clamp(1.75rem,3vw,2.25rem);line-height:1.1;letter-spacing:-.025em}
.page-description{margin:10px 0 0;color:var(--ui-soft);font-size:1rem;line-height:1.6}
.content-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.ui-card{min-height:160px;padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}
.ui-card.interactive{display:block;color:inherit;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.ui-card.interactive:hover{border-color:var(--ui-hover);box-shadow:0 0 0 1px color-mix(in srgb,var(--ui-hover) 22%,transparent),0 12px 32px rgba(0,0,0,.22),0 0 22px color-mix(in srgb,var(--ui-hover) 12%,transparent);transform:translateY(-2px)}
.ui-card .card-label{color:var(--ui-accent);font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
.ui-card h2{margin:9px 0 7px;font-size:1.08rem}
.ui-card p{margin:0;color:var(--ui-muted);font-size:.9rem;line-height:1.55}
.app-footer{display:flex;justify-content:space-between;gap:20px;padding:18px 30px;border-top:1px solid var(--ui-line);color:var(--ui-footer);font-size:.8rem}
.app-footer strong{color:var(--ui-footer)}
@media(max-width:850px){
  .app-header{gap:20px}.alliance-mark{width:88px;height:88px;flex-basis:88px}.alliance-copy strong{font-size:1.55rem}.user-panel{min-width:245px}.user-line{white-space:normal;flex-wrap:wrap}.content-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media(max-width:650px){
  body{padding:12px}.app-shell{width:100%;margin:8px auto;border-radius:16px}.app-header{grid-template-columns:minmax(0,1fr) auto;min-height:auto;padding:18px;gap:12px}.alliance-brand{gap:13px}.alliance-mark{width:70px;height:70px;flex-basis:70px}.alliance-copy strong{font-size:1.2rem}.alliance-copy span{margin-top:5px;font-size:.78rem}.user-panel{min-width:0}.user-line,.console-link{display:none}.menu-button{display:inline-flex}.mobile-menu.open{display:block}.app-content{padding:25px 18px 30px}.content-grid{grid-template-columns:1fr}.app-footer{display:block;padding:17px 18px}.app-footer span{display:block;margin-top:5px}
}
`;

const script=`<script>(()=>{const button=document.querySelector('[data-menu-button]');const menu=document.querySelector('[data-mobile-menu]');if(!button||!menu)return;button.addEventListener('click',()=>{const open=menu.classList.toggle('open');button.setAttribute('aria-expanded',String(open));});})();</script>`;

export function renderUiV2Shell(context:UiV2Context,page:UiV2Page){
  const favicon=context.branding.favicon?`<link rel="icon" href="${assetUrl(context.branding.favicon)}">`:"";
  const footer=context.branding.footerText||`${context.alliance.name} · ${context.alliance.tag?`[${context.alliance.tag}] · `:""}${context.alliance.serverNumber?`Server #${context.alliance.serverNumber}`:""}`;
  const p=context.branding.palette;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(context.alliance.name)} · ${esc(page.title)}</title>${favicon}<style>${styles}</style><style>:root{--ui-bg:${p.pageBackground};--ui-surface:${p.panelBackground};--ui-surface-2:${p.cardBackground};--ui-line:${p.border};--ui-accent:${p.primary};--ui-secondary:${p.secondary};--ui-text:${p.mainText};--ui-muted:${p.mutedText};--ui-soft:${p.mutedText};--ui-rank-highlight:${p.rank};--ui-alliance-tag:${p.allianceTag};--ui-server-number:${p.serverNumber};--ui-navigation:${p.navigationText};--ui-footer:${p.footer};--ui-button:${p.button};--ui-button-text:${p.buttonText};--ui-hover:${p.hover};--ui-success:${p.success};--ui-warning:${p.warning};--ui-danger:${p.danger};--ui-site-name:${p.siteName};--ui-login-heading:${p.loginHeading};--ui-footer-wording:${p.footerWording}}</style></head><body><div class="app-shell"><header class="app-header"><div class="alliance-brand"><div class="alliance-mark">${logo(context)}</div><div class="alliance-copy"><strong>${esc(context.alliance.name)}</strong><span>${allianceIdentity(context)}</span></div></div><div class="user-panel"><div class="user-line"><span class="welcome">Welcome ${esc(context.user.displayName)}</span><span class="rank">· ${rankIdentity(context)}</span></div><div class="header-actions"><a class="console-link" href="/leadership">Leadership Console</a><button class="menu-button" type="button" aria-label="Open navigation" aria-expanded="false" data-menu-button><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" stroke-width="2" stroke-linecap="round"/></svg></button></div></div></header><nav class="mobile-menu" aria-label="Leadership navigation" data-mobile-menu>${navigation(context)}<a href="/auth/logout">Sign out</a></nav><main class="app-content"><div class="page-heading">${page.eyebrow?`<p class="eyebrow">${esc(page.eyebrow)}</p>`:""}<h1>${esc(page.title)}</h1>${page.description?`<p class="page-description">${esc(page.description)}</p>`:""}</div>${page.body}</main><footer class="app-footer"><strong style="color:var(--ui-site-name)">${esc(context.branding.platformName)}</strong><span style="color:var(--ui-footer-wording)">${esc(footer)}</span></footer></div>${script}</body></html>`;
}

export function uiV2Html(html:string,status=200){
  return new Response(html,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"same-origin","content-security-policy":"default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}});
}
