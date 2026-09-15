import app from "./player_account_link";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }
type Actor={id:number;display_name:string;is_owner:number};
type SessionAccount={id:number;display_name:string;is_owner:number;is_active:number;approval_status:string};
type PendingAccount={id:number;display_name:string;provider_username:string|null};
type AvailablePlayer={id:number;display_name:string;rank:number};
const SESSION_COOKIE="ap_session";
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const cookie=(r:Request,n:string)=>{for(const p of(r.headers.get("cookie")??"").split(";")){const [x,...z]=p.trim().split("=");if(x===n)return z.join("=")}return null};
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
const hash=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const sessionAccount=async(r:Request,e:Env)=>{const t=cookie(r,SESSION_COOKIE);if(!t)return null;return e.DB.prepare("SELECT a.id,a.display_name,a.is_owner,a.is_active,a.approval_status FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(await hash(t)).first<SessionAccount>()};
const actor=async(r:Request,e:Env)=>{const a=await sessionAccount(r,e);return a&&a.is_active&&a.approval_status==="active"?{id:a.id,display_name:a.display_name,is_owner:a.is_owner}:null};
const safePost=(r:Request,e:Env)=>{const origin=r.headers.get("origin"),site=r.headers.get("sec-fetch-site");if(site&&site!=="same-origin"&&site!=="same-site"&&site!=="none")return false;if(!origin||origin==="null")return true;try{const o=new URL(origin).hostname,h=new URL(r.url).hostname,a=new URL(e.APP_URL).hostname;return o===h||o===a}catch{return false}};
const redirect=(u:string,r:Request)=>Response.redirect(new URL(u,r.url),302);
const audit=(e:Env,a:Actor,action:string,id:number,oldValues:unknown,newValues:unknown)=>e.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,a.display_name,action,"account",String(id),"web",JSON.stringify(oldValues),JSON.stringify(newValues)).run();
const withHtml=(res:Response,html:string)=>{const headers=new Headers(res.headers);headers.delete("content-length");return new Response(html,{status:res.status,statusText:res.statusText,headers})};
const pendingPage=(name:string)=>new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Waiting for access</title><style>:root{color-scheme:dark;font-family:Inter,system-ui,sans-serif}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px;background:radial-gradient(circle at top,#17243d 0,#0c1220 45%,#090e18 100%);color:#eef3ff}.box{width:min(92vw,560px);padding:36px;text-align:center;background:#151d2e;border:1px solid #2b3850;border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.35)}.duck{font-size:3rem;margin-bottom:14px}.step{font-size:.76rem;text-transform:uppercase;letter-spacing:.09em;color:#8292ae;font-weight:900}h1{margin:8px 0 10px;font-size:1.7rem}p{margin:0 auto 20px;color:#aebddd;line-height:1.55}.who{padding:12px 14px;margin:18px 0;border:1px solid #34445f;border-radius:11px;background:#0e1626;color:#dce5f5;font-weight:800}a{color:#aebddd;text-decoration:none;font-weight:800}</style></head><body><main class="box"><div class="duck">🦆</div><div class="step">Access request received</div><h1>Waiting for access</h1><p>Your Discord account has been recognised, but a member of the alliance leadership needs to match it to your player profile before you can continue.</p><div class="who">${esc(name)}</div><p>You can close this page. Once your access is approved, sign in again with the same Discord account.</p><a href="/auth/logout">Sign out</a></main></body></html>`,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});
const waitingPanel=async(request:Request,env:Env,res:Response)=>{
  if(request.method!=="GET"||new URL(request.url).pathname!=="/players"||res.status!==200||!res.headers.get("content-type")?.includes("text/html"))return res;
  const a=await actor(request,env).catch(()=>null);if(!a?.is_owner)return res;
  try{
    const pending=(await env.DB.prepare(`SELECT a.id,a.display_name,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.approval_status='pending' AND a.is_owner=0 ORDER BY a.id`).all<PendingAccount>()).results??[];
    if(!pending.length)return res;
    const available=(await env.DB.prepare(`SELECT p.id,p.display_name,p.rank FROM players p WHERE p.is_active=1 AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.player_id=p.id) ORDER BY p.display_name COLLATE NOCASE`).all<AvailablePlayer>()).results??[];
    const options=available.map(p=>`<option value="${p.id}">${esc(p.display_name)} · R${p.rank}</option>`).join("");
    const rows=pending.map(p=>`<div class="waitingrow"><div class="waitingwho"><strong>${esc(p.display_name)}</strong><span>Discord · ${esc(p.provider_username||p.display_name)}</span></div><form method="post" action="/security/access/${p.id}/approve"><select name="player_id" required><option value="">Choose player…</option>${options}</select><button type="submit"${available.length?"":" disabled"}>Approve</button></form><form method="post" action="/security/access/${p.id}/reject" onsubmit="return confirm('Reject this access request?')"><button class="secondary" type="submit">Reject</button></form></div>`).join("");
    const panel=`<section class="waitingaccess"><div class="waitinghead"><div><div class="step">Access requests</div><h2>Waiting for access</h2><p>Match each Discord request to an active player before approving access.</p></div><span class="waitingcount">${pending.length}</span></div>${rows}${available.length?"":'<div class="notice error">There are no unlinked active players available to approve.</div>'}</section><style>.waitingaccess{margin:20px 0 22px;padding:18px;border:1px solid #405274;border-radius:14px;background:#10192a}.waitinghead{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px}.waitinghead h2{margin:2px 0 4px}.waitinghead p{margin:0;color:#90a0bb;font-size:.86rem}.waitingcount{min-width:30px;height:30px;padding:0 9px;border-radius:999px;background:#26344d;display:flex;align-items:center;justify-content:center;font-weight:900}.waitingrow{display:grid;grid-template-columns:minmax(170px,1fr) minmax(320px,1.6fr) auto;gap:10px;align-items:center;padding:12px 0;border-top:1px solid #263650}.waitingwho strong,.waitingwho span{display:block}.waitingwho span{margin-top:3px;color:#8292ae;font-size:.76rem}.waitingrow form{display:flex;gap:8px;align-items:center;margin:0}.waitingrow select{margin:0;min-width:0}.waitingrow button{width:auto;margin:0;white-space:nowrap}.waitingrow button.secondary{background:#26344d}@media(max-width:760px){.waitingrow{grid-template-columns:1fr}.waitingrow form{width:100%}.waitingrow select{flex:1}.waitingrow button{min-height:44px}}</style>`;
    let html=await res.text();const marker='<div class="toolbar">';html=html.includes(marker)?html.replace(marker,`${panel}${marker}`):html.replace('<div class="list">',`${panel}<div class="list">`);return withHtml(res,html)
  }catch{return res}
};

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const u=new URL(request.url);
  if(request.method==="GET"&&u.pathname==="/pending"){
    const a=await sessionAccount(request,env).catch(()=>null);if(!a)return redirect("/login",request);if(a.approval_status==="active"&&a.is_active)return redirect("/",request);if(a.approval_status!=="pending")return redirect("/login",request);return pendingPage(a.display_name)
  }
  if(request.method==="GET"&&u.pathname==="/players")return waitingPanel(request,env,await (app as any).fetch(request,env));
  if(!u.pathname.startsWith("/security/access/"))return (app as any).fetch(request,env);
  const decision=u.pathname.match(/^\/security\/access\/(\d+)\/(approve|reject)$/);
  if(decision&&request.method==="POST"){
    const a=await actor(request,env);if(!a?.is_owner||!safePost(request,env))return new Response("Forbidden",{status:403});
    const id=Number(decision[1]),target=await env.DB.prepare("SELECT id,approval_status FROM accounts WHERE id=? AND is_owner=0").bind(id).first<{id:number;approval_status:string}>();
    if(!target||target.approval_status!=="pending")return new Response("Pending account not found",{status:404});
    if(decision[2]==="reject"){
      await env.DB.batch([env.DB.prepare("UPDATE accounts SET approval_status='rejected',is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id),env.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE account_id=? AND revoked_at IS NULL").bind(id)]);
      await audit(env,a,"account.signup.rejected",id,{status:"pending"},{status:"rejected"});return redirect("/players?access=updated",request)
    }
    const f=await request.formData(),pid=Number(f.get("player_id"));if(!Number.isInteger(pid)||pid<1)return new Response("Choose a player",{status:400});
    const p=await env.DB.prepare("SELECT id FROM players WHERE id=? AND is_active=1").bind(pid).first();if(!p)return new Response("Player not found",{status:404});
    const used=await env.DB.prepare("SELECT id FROM accounts WHERE player_id=? AND id<>?").bind(pid,id).first();if(used)return new Response("That player is already linked to another account",{status:409});
    await env.DB.batch([env.DB.prepare("UPDATE accounts SET player_id=?,approval_status='active',is_active=1,approved_at=CURRENT_TIMESTAMP,approved_by_account_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(pid,a.id,id),env.DB.prepare("INSERT OR IGNORE INTO account_groups(account_id,group_id,added_by_account_id) SELECT ?,id,? FROM permission_groups WHERE public_id='group-members'").bind(id,a.id)]);
    await audit(env,a,"account.signup.approved",id,{status:"pending"},{status:"active",player_id:pid});return redirect("/players?access=updated",request)
  }
  return (app as any).fetch(request,env)
}} satisfies ExportedHandler<Env>;
