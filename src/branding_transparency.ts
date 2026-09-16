import app from "./security_runtime";

interface Env { DB:D1Database; }

const DEFAULT_ALERT = "#f59e0b";
const validHex = (v:string) => /^#[0-9a-fA-F]{6}$/.test(v);

const getAlertColour = async (env:Env) => {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key='theme_player_alert' LIMIT 1").first<{value:string}>().catch(()=>null);
  return validHex(row?.value||"") ? row!.value : DEFAULT_ALERT;
};
const getAllianceName = async (env:Env) => {
  const row=await env.DB.prepare("SELECT name FROM alliance WHERE id=1 LIMIT 1").first<{name:string}>().catch(()=>null);
  return row?.name?.trim()||"Alliance";
};

const saveAlertColour = async (env:Env,value:string) => {
  await env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('theme_player_alert',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(value).run();
};

const brandingCss = (alert:string) => `<style id="ap-branding-polish">
:root{--ap-player-alert:${alert}}
.brandmark.has-image{background:transparent!important;background-image:none!important;box-shadow:none!important}
.loginlogo:has(img){background:transparent!important;border-color:transparent!important}
.brandpreview:has(img){background:transparent!important}
.brandvisual.crest:has(img),.pendingbrand.crest:has(img){background:transparent!important;background-image:none!important;border-radius:0!important;box-shadow:none!important}
.brandmark:not(.has-image){font-size:1rem!important;font-weight:900!important;letter-spacing:-.02em!important}
.loginfallback{font-size:1.5rem!important;font-weight:900!important}
.mark:not(.haslogo){font-size:1.3rem!important;font-weight:900!important}
.brandvisual.crest:not(:has(img)){font-size:1.35rem!important}
.pendingbrand.crest:not(:has(img)){font-size:1.3rem!important}
@keyframes apPlayerAttention{0%,100%{border-color:color-mix(in srgb,var(--ap-player-alert) 72%,#111b2e);box-shadow:0 0 0 1px color-mix(in srgb,var(--ap-player-alert) 12%,transparent),0 0 18px color-mix(in srgb,var(--ap-player-alert) 10%,transparent)}50%{border-color:var(--ap-player-alert);box-shadow:0 0 0 3px color-mix(in srgb,var(--ap-player-alert) 20%,transparent),0 0 34px color-mix(in srgb,var(--ap-player-alert) 28%,transparent)}}
.playerattention{border-color:var(--ap-player-alert)!important;background:linear-gradient(135deg,color-mix(in srgb,var(--ap-player-alert) 13%,transparent),rgba(17,27,46,.96))!important;animation:apPlayerAttention 1.8s ease-in-out infinite!important}
.playerattention .navicon{color:var(--ap-player-alert)!important}
.playerattention .attentionbadge{border-color:color-mix(in srgb,var(--ap-player-alert) 58%,transparent)!important;background:color-mix(in srgb,var(--ap-player-alert) 16%,transparent)!important;color:color-mix(in srgb,var(--ap-player-alert) 72%,white)!important}
.playerattention .navarrow{color:color-mix(in srgb,var(--ap-player-alert) 72%,white)!important}
.ap-home-menu{display:none}
@media(max-width:650px){
.ap-home-menu{display:block;position:relative;margin-left:auto;order:4}.ap-home-menu button,.mobilemenubtn{width:42px!important;height:42px!important;margin:0!important;padding:10px!important;border:1px solid #34445f!important;border-radius:11px!important;background:#111b2e!important}.ap-home-menu button span,.mobilemenubtn span{display:block!important;height:2px!important;background:#eef3ff!important;margin:4px 0!important;border-radius:2px!important}.ap-home-menu-panel,.mobileleadershipmenu{background:#111b2e!important;border:1px solid #34445f!important;border-radius:13px!important;box-shadow:0 18px 45px rgba(0,0,0,.45)!important}.ap-home-menu-panel{display:none;position:absolute;right:0;top:50px;width:230px;z-index:50;padding:10px}.ap-home-menu-panel.open{display:block}.ap-home-menu-panel a{display:block;padding:11px 12px;border-radius:8px;color:#eef3ff;text-decoration:none;font-weight:750}.ap-home-menu-panel a:hover{background:#1a2740}.ap-home-menu-panel .signout{margin-top:6px;padding-top:12px;border-top:1px solid #2b3850;color:#aebddd}
.footer{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:18px!important}.footer>a{margin-top:0!important;white-space:nowrap!important}
.dashboardhero{position:relative!important}.dashboardhero>.ap-home-menu{position:absolute!important;right:0!important;top:0!important}
}
@media(prefers-reduced-motion:reduce){.playerattention{animation:none!important}}
</style>`;

const polishBrandingPage = (html:string,alert:string) => {
  html = html.replace("<h2>Main logo / crest</h2>","<h2>Main Site Logo</h2>");
  html = html.replace("Square PNG or WebP works best · Around 1000 × 1000 px is ideal.","Square or near-square logo with a transparent background. PNG or WebP preferred. Leave a little clear space around the artwork so it displays cleanly throughout the site.");
  html = html.replace("Choose main logo","Choose Main Site Logo");
  html = html.replace("Choose a safe starting theme, then tweak the two identity colours if you want. The sample updates immediately; press Save theme to apply it across the platform.","Choose a safe starting theme, then tweak the identity colours if you want. Player Alert Colour is kept separate so action-required cards stay visible even when your accent colour is similar. The sample updates immediately; press Save theme to apply it across the platform.");
  const iconField = `<div><label>Icon colour</label><input id="theme-icon" name="theme_icon" type="color"`;
  const i = html.indexOf(iconField);
  if(i>=0){
    const end = html.indexOf("</div>",i);
    if(end>=0) html = html.slice(0,end+6)+`<div><label>Player Alert Colour</label><input id="theme-player-alert" name="theme_player_alert" type="color" value="${alert}"></div>`+html.slice(end+6);
  }
  html = html.replace("<div class=\"previewbutton\">Example button</div>","<div class=\"previewalert\">Player alert</div><div class=\"previewbutton\">Example button</div>");
  html = html.replace("</head>",`<style>.themegrid{grid-template-columns:repeat(4,minmax(0,1fr))}.previewalert{padding:9px 12px;border:2px solid var(--ap-player-alert);border-radius:9px;color:color-mix(in srgb,var(--ap-player-alert) 72%,white);font-size:.78rem;font-weight:900}@media(max-width:900px){.themegrid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:650px){.themegrid{grid-template-columns:1fr}}</style></head>`);
  html = html.replace("</body>",`<script>(()=>{const a=document.getElementById('theme-player-alert');if(!a)return;const apply=()=>document.documentElement.style.setProperty('--ap-player-alert',a.value);a.addEventListener('input',apply);apply()})();</script></body>`);
  return html;
};

const compactMenu=`<div class="ap-home-menu"><button type="button" aria-label="Open menu" aria-expanded="false" onclick="const p=this.nextElementSibling,o=p.classList.toggle('open');this.setAttribute('aria-expanded',String(o))"><span></span><span></span><span></span></button><div class="ap-home-menu-panel"><a href="/">Alliance Home</a><a href="/leadership">Leadership Console</a><a href="/leadership/players">Players</a><a href="/leadership/security">Security &amp; Access</a><a class="signout" href="/auth/logout">Sign out</a></div></div>`;
const polishMemberHome=(html:string)=>{
  if(!html.includes('class="leadership"') || !html.includes('href="/auth/logout"')) return html;
  return html.replace('</header>',`${compactMenu}</header>`);
};
const polishLeadershipConsole=(html:string)=>{
  if(!html.includes('class="dashboardhero"')||html.includes('class="ap-home-menu"'))return html;
  return html.replace('<div class="dashboardhero">',`<div class="dashboardhero">${compactMenu}`);
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let themeForm:FormData|null = null;
    if(request.method==="POST" && url.pathname==="/settings/alliance/branding"){
      try{
        const f=await request.clone().formData();
        if(String(f.get("slot")||"")==="theme") themeForm=f;
      }catch{}
    }

    const response = await (app as any).fetch(request, env, ctx);

    if(themeForm && response instanceof Response){
      const location=response.headers.get("location")||"";
      if(location.includes("saved=theme")||location.includes("saved=reset")){
        const reset=String(themeForm.get("theme_action")||"save")==="reset";
        const chosen=String(themeForm.get("theme_player_alert")||"");
        await saveAlertColour(env,reset?DEFAULT_ALERT:(validHex(chosen)?chosen:DEFAULT_ALERT));
      }
    }

    if (!(response instanceof Response) || !response.headers.get("content-type")?.includes("text/html")) return response;
    let html = await response.text();
    if (!html.includes("</head>")) return response;
    const alert=await getAlertColour(env);
    if(request.method==="GET" && url.pathname==="/settings/alliance/branding") html=polishBrandingPage(html,alert);
    if(request.method==="GET" && url.pathname==="/") html=polishMemberHome(html);
    if(request.method==="GET" && url.pathname==="/leadership"){
      const allianceName=await getAllianceName(env);
      html=html.replace(/Development environment/gi,allianceName);
      html=polishLeadershipConsole(html);
    }
    html=html.replaceAll('href="/security/access"','href="/leadership/security"');
    html=html.replaceAll('href="/players"','href="/leadership/players"');
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(html.replace("</head>", `${brandingCss(alert)}</head>`), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
} satisfies ExportedHandler<Env>;
