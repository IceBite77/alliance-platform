import app from "./security_access";

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

type PendingAccess={id:number;display_name:string;provider_username:string|null;created_at:string};
type AvailablePlayer={id:number;display_name:string;rank:number};

const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const withHtml=(res:Response,html:string)=>{const headers=new Headers(res.headers);headers.delete("content-length");return new Response(html,{status:res.status,statusText:res.statusText,headers})};

const pendingAccess=async(env:Env)=>{const q=await env.DB.prepare("SELECT a.id,a.display_name,i.provider_username,a.created_at FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.approval_status='pending' ORDER BY a.created_at").all<PendingAccess>();return q.results??[]};
const availablePlayers=async(env:Env)=>{const q=await env.DB.prepare("SELECT p.id,p.display_name,p.rank FROM players p WHERE p.is_active=1 AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.player_id=p.id) ORDER BY p.display_name COLLATE NOCASE").all<AvailablePlayer>();return q.results??[]};

const polishPending=async(res:Response,env:Env)=>{
  if(!res.headers.get("content-type")?.includes("text/html")) return res;
  let html=await res.text();
  const alliance=await env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1 LIMIT 1").first<{name:string;tag:string|null;server_number:number|null}>().catch(()=>null);
  const name=alliance?.name||"Alliance Platform";
  const identity=`${alliance?.tag?`[${esc(alliance.tag)}] · `:""}${alliance?.server_number?`Server #${alliance.server_number}`:""}`;
  html=html.replace('<div class="duck">🦆</div>','<div class="pendingbrand"><img src="/assets/branding/icons/master.png" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><span class="brandfallback" style="display:none">AMP</span></div>');
  html=html.replace('<a href="/auth/logout">Sign out</a>',`<a class="pendingSignout" href="/auth/logout">Sign out</a><div class="pendingfooter"><strong>${esc(name)}</strong><span>${identity?`${identity} · `:""}The Alliance Management Platform</span></div>`);
  html=html.replace('</head>',`<style>.duck{display:none}.pendingbrand{width:76px;height:76px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center}.pendingbrand img{display:block;max-width:76px;max-height:76px;object-fit:contain}.brandfallback{width:70px;height:70px;border-radius:17px;background:linear-gradient(145deg,#5865f2,#3442a7);align-items:center;justify-content:center;font-weight:900}.pendingSignout{display:inline-block;margin-top:4px;padding:12px 22px;border-radius:11px;background:#5865f2;color:#fff!important;font-weight:800;text-decoration:none}.pendingfooter{display:flex;justify-content:space-between;gap:14px;margin-top:28px;padding-top:17px;border-top:1px solid #2b3850;color:#8292ae;font-size:.78rem;text-align:left}.pendingfooter strong{color:#aebddd}.pendingfooter span{text-align:right}@media(max-width:650px){.pendingfooter{display:block;text-align:center}.pendingfooter span{display:block;text-align:center;margin-top:5px}}</style></head>`);
  return withHtml(res,html);
};

const polishLeadership=async(res:Response,env:Env)=>{
  if(!res.headers.get("content-type")?.includes("text/html")) return res;
  const wait=await pendingAccess(env);
  if(!wait.length)return res;
  let html=await res.text();
  const message=wait.length===1?"1 player waiting for access":`${wait.length} players waiting for access`;
  html=html.replace(/(<a class="navcard" href="\/players">[\s\S]*?)(<span class="navarrow">→<\/span>)/,`$1<div class="pendingaccessbadge">${esc(message)}</div>$2`);
  html=html.replace('</head>',`<style>.navcard[href="/players"]{border-color:#b47b36!important;box-shadow:0 0 0 1px rgba(180,123,54,.18),0 14px 35px rgba(0,0,0,.18)}.pendingaccessbadge{display:inline-flex;margin-top:12px;padding:7px 10px;border-radius:999px;border:1px solid #b47b36;background:#2a2118;color:#f0c58d;font-size:.76rem;font-weight:900}</style></head>`);
  return withHtml(res,html);
};

const polishPlayers=async(res:Response,env:Env)=>{
  if(!res.headers.get("content-type")?.includes("text/html")) return res;
  const wait=await pendingAccess(env);
  let html=await res.text();
  if(!wait.length)return res;
  const ps=await availablePlayers(env);
  const options=ps.map(p=>`<option value="${p.id}">${esc(p.display_name)} · R${p.rank}</option>`).join("");
  const rows=wait.map(x=>`<div class="accessrequest"><div class="accesswho"><strong>${esc(x.display_name)}</strong><span>Discord · ${esc(x.provider_username||"Unknown")}</span></div><form method="post" action="/security/access/${x.id}/approve" class="accessactions"><select name="player_id" required><option value="">Link to player…</option>${options}</select><button type="submit">Link & approve</button><button class="danger" type="submit" formaction="/security/access/${x.id}/reject">Reject</button></form></div>`).join("");
  const panel=`<section class="pendingaccesspanel"><div class="pendingaccesshead"><div><div class="step">Account access</div><h2>Waiting for access · ${wait.length}</h2><p>Match each Discord login to the correct alliance player before approving access.</p></div></div>${rows}${ps.length?"":'<div class="accesswarning">There are no unlinked active players available. Add the player first, then return here to approve their account.</div>'}</section>`;
  html=html.replace('<div class="toolbar">',panel+'<div class="toolbar">');
  html=html.replace('</head>',`<style>.pendingaccesspanel{margin:22px 0;padding:20px;border:1px solid #b47b36;border-radius:14px;background:#171a22}.pendingaccesshead h2{margin:0 0 5px}.pendingaccesshead p{margin:0 0 12px;color:#aeb9cb}.accessrequest{display:grid;grid-template-columns:minmax(180px,1fr) minmax(420px,1.8fr);gap:16px;align-items:center;padding:14px 0;border-top:1px solid #30384a}.accesswho strong,.accesswho span{display:block}.accesswho span{margin-top:4px;color:#8292ae;font-size:.8rem}.accessactions{display:grid;grid-template-columns:minmax(170px,1fr) auto auto;gap:8px;align-items:center}.accessactions select{margin:0}.accessactions button{white-space:nowrap}.accesswarning{margin-top:12px;padding:11px 13px;border-radius:10px;background:#2a2118;color:#f0c58d;font-size:.86rem}@media(max-width:760px){.accessrequest{grid-template-columns:1fr}.accessactions{grid-template-columns:1fr}.accessactions button{width:100%}}</style></head>`);
  return withHtml(res,html);
};

const polishSecurity=async(res:Response)=>{
  if(!res.headers.get("content-type")?.includes("text/html")) return res;
  let html=await res.text();
  html=html.replace("Platform access is separate from alliance R1–R5 rank.","Define who can access platform features. Player accounts and day-to-day approvals are managed from Players.");
  html=html.replace("Accounts, approvals, platform roles and protected permissions.","Access groups, rank rules, administrators and protected permissions.");
  html=html.replace(/<div class="pending">[\s\S]*?<\/div>\s*<\/div>/,"");
  html=html.replace(/<h2>Waiting for approval[^<]*<\/h2>[\s\S]*?(?=<h2>|<section|<div class="account)/,"");
  return withHtml(res,html);
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url=new URL(request.url);
    if(url.pathname==="/security-access") return Response.redirect(new URL("/security/access",request.url),302);

    const result = await (app as any).fetch(request, env);
    if (!(result instanceof Response)) {
      if (typeof result === "string") return new Response(result,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});
      throw new TypeError("Worker handler did not return a Response");
    }

    // Approval now lives in Players. Keep the existing audited backend actions,
    // but return leadership to Players after approving or rejecting a request.
    if(request.method==="POST"&&/^\/security\/access\/\d+\/(approve|reject)$/.test(url.pathname)&&result.status>=300&&result.status<400){
      const headers=new Headers(result.headers);headers.set("location",new URL("/players?access=updated",request.url).toString());return new Response(null,{status:302,headers});
    }
    if(url.pathname==="/pending") return polishPending(result,env);
    if(url.pathname==="/") return polishLeadership(result,env);
    if(url.pathname==="/players"&&request.method==="GET") return polishPlayers(result,env);
    if(url.pathname==="/security/access"&&request.method==="GET") return polishSecurity(result);
    return result;
  }
} satisfies ExportedHandler<Env>;
