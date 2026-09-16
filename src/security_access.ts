import app from "./account_lifecycle";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }
type Actor={id:number;display_name:string;is_owner:number};
type SessionAccount={id:number;display_name:string;is_owner:number;is_active:number;approval_status:string};
type PendingAccount={id:number;display_name:string;provider_username:string|null};
type AvailablePlayer={id:number;display_name:string;rank:number};
type LoginAccount={id:number;display_name:string;is_active:number;approval_status:string};
type DiscordToken={access_token:string};
type DiscordUser={id:string;username:string;global_name?:string|null};

const SESSION_COOKIE="ap_session";
const cookie=(r:Request,n:string)=>{for(const p of(r.headers.get("cookie")??"").split(";")){const[k,...v]=p.trim().split("=");if(k===n)return v.join("=")}return null};
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
const hash=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const actor=async(r:Request,e:Env)=>{const t=cookie(r,SESSION_COOKIE);if(!t)return null;return await e.DB.prepare("SELECT a.id,a.display_name,a.is_owner FROM sessions s JOIN accounts a ON a.id=s.account_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 AND a.approval_status='active' LIMIT 1").bind(await hash(t)).first<Actor>()};
const safePost=(r:Request,e:Env)=>{const site=r.headers.get("sec-fetch-site");if(site==="same-origin"||site==="none")return true;const origin=r.headers.get("origin");if(!origin)return true;return new Set([new URL(r.url).origin,new URL(e.APP_URL).origin]).has(origin)};
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const redirect=(p:string,r:Request)=>Response.redirect(new URL(p,r.url),302);
const revoke=async(e:Env,id:number)=>e.DB.prepare("UPDATE sessions SET revoked_at=CURRENT_TIMESTAMP WHERE account_id=? AND revoked_at IS NULL").bind(id).run();
const audit=async(e:Env,a:Actor,action:string,entity:string,id:string,oldV:unknown,newV:unknown,meta:unknown={})=>e.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values,metadata) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),a.id,a.display_name,action,entity,id,"security",JSON.stringify(oldV),JSON.stringify(newV),JSON.stringify(meta)).run();

const pending=async(e:Env)=>await e.DB.prepare("SELECT a.id,a.display_name,i.provider_username FROM accounts a LEFT JOIN account_identities i ON i.account_id=a.id AND i.provider='discord' WHERE a.approval_status='pending' AND a.is_active=1 ORDER BY a.created_at ASC").all<PendingAccount>();
const availablePlayers=async(e:Env)=>await e.DB.prepare("SELECT p.id,p.display_name,p.rank FROM players p LEFT JOIN accounts a ON a.player_id=p.id WHERE p.is_active=1 AND a.id IS NULL ORDER BY p.display_name COLLATE NOCASE").all<AvailablePlayer>();

const waitingPanel=async(res:Response,r:Request,e:Env)=>{
  const ct=res.headers.get("content-type")||"";if(!ct.includes("text/html"))return res;
  const a=await actor(r,e);if(!a?.is_owner)return res;
  const [p,players]=await Promise.all([pending(e),availablePlayers(e)]),rows=p.results??[],opts=players.results??[];
  let body=await res.text();
  const cards=rows.length?rows.map(x=>`<div class="accessrow"><div><strong>${esc(x.provider_username||x.display_name)}</strong><span>Waiting for access</span></div><form method="post" action="/security/access/${x.id}/approve"><select name="player_id" required><option value="">Match to player…</option>${opts.map(y=>`<option value="${y.id}">${esc(y.display_name)} · R${y.rank}</option>`).join("")}</select><button type="submit">Approve</button></form><form method="post" action="/security/access/${x.id}/reject"><button class="reject" type="submit">Reject</button></form></div>`).join(""):`<div class="emptyaccess">No Discord sign-ins are waiting for access.</div>`;
  const panel=`<section class="accesspanel"><div class="accesshead"><div><div class="step">Access control</div><h2>Waiting for access</h2><p>Match new Discord sign-ins to an existing player before they can enter the platform.</p></div><div class="accesscount">${rows.length}</div></div>${cards}</section>`;
  body=body.replace("</main>",`${panel}</main>`).replace("</head>",`<style>.accesspanel{margin-top:22px;padding:22px;border:1px solid #2b3850;border-radius:16px;background:#0e1626}.accesshead{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.accesshead h2{margin:2px 0 5px}.accesshead p{margin:0;color:#90a0bb}.accesscount{min-width:42px;height:42px;border-radius:12px;background:#17243d;display:flex;align-items:center;justify-content:center;font-weight:900}.accessrow{display:grid;grid-template-columns:minmax(180px,1fr) minmax(300px,1.6fr) auto;gap:10px;align-items:center;padding:14px 0;border-top:1px solid #253149}.accessrow:first-of-type{margin-top:16px}.accessrow strong,.accessrow span{display:block}.accessrow span{color:#8292ae;font-size:.8rem;margin-top:3px}.accessrow form{display:flex;gap:8px;margin:0}.accessrow select{margin:0;min-width:190px}.accessrow button{width:auto;margin:0;white-space:nowrap}.accessrow .reject{background:#24191c!important;color:#ffd5dc;border:1px solid #5b3038}.emptyaccess{margin-top:16px;padding:14px;border-radius:11px;background:#0b1322;color:#90a0bb}@media(max-width:760px){.accessrow{grid-template-columns:1fr}.accessrow form{width:100%}.accessrow select{flex:1;min-width:0}.accessrow button{flex:0 0 auto}}</style></head>`);
  const h=new Headers(res.headers);h.delete("content-length");return new Response(body,{status:res.status,statusText:res.statusText,headers:h});
};

const approve=async(r:Request,e:Env,a:Actor,id:number)=>{
  const target=await e.DB.prepare("SELECT id,display_name,is_active,approval_status FROM accounts WHERE id=? AND is_owner=0").bind(id).first<LoginAccount>();if(!target)return new Response("Account not found",{status:404});
  const f=await r.formData(),playerId=Number(f.get("player_id"));if(!Number.isInteger(playerId)||playerId<1)return redirect("/players?accesserror=player",r);
  const player=await e.DB.prepare("SELECT id,display_name FROM players WHERE id=? AND is_active=1").bind(playerId).first<{id:number;display_name:string}>();if(!player)return redirect("/players?accesserror=player",r);
  const used=await e.DB.prepare("SELECT id FROM accounts WHERE player_id=? AND id<>?").bind(playerId,id).first<{id:number}>();if(used)return redirect("/players?accesserror=linked",r);
  await e.DB.prepare("UPDATE accounts SET player_id=?,display_name=?,approval_status='active',approved_at=CURRENT_TIMESTAMP,approved_by_account_id=?,is_active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(playerId,player.display_name,a.id,id).run();
  const members=await e.DB.prepare("SELECT id FROM permission_groups WHERE public_id='group-members' LIMIT 1").first<{id:number}>();if(members)await e.DB.prepare("INSERT OR IGNORE INTO account_groups (account_id,group_id,created_by_account_id) VALUES (?,?,?)").bind(id,members.id,a.id).run();
  await audit(e,a,"account.approved","account",String(id),{approval_status:target.approval_status,player_id:null},{approval_status:"active",player_id:playerId},{player_display_name:player.display_name});
  return redirect("/players?access=approved",r);
};
const reject=async(r:Request,e:Env,a:Actor,id:number)=>{const target=await e.DB.prepare("SELECT id,approval_status FROM accounts WHERE id=? AND is_owner=0").bind(id).first<{id:number;approval_status:string}>();if(!target)return new Response("Account not found",{status:404});await revoke(e,id);await e.DB.prepare("UPDATE accounts SET approval_status='rejected',rejected_at=CURRENT_TIMESTAMP,rejected_by_account_id=?,is_active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(a.id,id).run();await audit(e,a,"account.rejected","account",String(id),{approval_status:target.approval_status},{approval_status:"rejected",is_active:0},{});return redirect("/players?access=rejected",r)};

export default {async fetch(request:Request,env:Env):Promise<Response>{const u=new URL(request.url),m=u.pathname.match(/^\/security\/access\/(\d+)\/(approve|reject)$/);if(request.method==="POST"&&m){const a=await actor(request,env);if(!a?.is_owner||!safePost(request,env))return new Response("Forbidden",{status:403});return m[2]==="approve"?approve(request,env,a,Number(m[1])):reject(request,env,a,Number(m[1]))}const res=await app.fetch(request,env as any);return request.method==="GET"&&(u.pathname==="/players"||u.pathname==="/leadership/players")?waitingPanel(res,request,env):res}} satisfies ExportedHandler<Env>;
