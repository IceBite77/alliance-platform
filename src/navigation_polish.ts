import app from "./player_birthday_ui";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }
type Identity={display_name:string;rank:number};
const SESSION_COOKIE="ap_session";
const esc=(v:string)=>v.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const cookie=(r:Request,n:string)=>{for(const p of(r.headers.get("cookie")??"").split(";")){const [x,...z]=p.trim().split("=");if(x===n)return z.join("=")}return null};
const b64=(b:Uint8Array)=>{let s="";for(const x of b)s+=String.fromCharCode(x);return btoa(s).replaceAll("+","-").replaceAll("/","_").replaceAll("=","")};
const hash=async(v:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))));
const identity=async(r:Request,e:Env)=>{const t=cookie(r,SESSION_COOKIE);if(!t)return null;return await e.DB.prepare(`SELECT p.display_name,p.rank FROM sessions s JOIN accounts a ON a.id=s.account_id JOIN players p ON p.id=a.player_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>CURRENT_TIMESTAMP AND a.is_active=1 AND a.approval_status='active' LIMIT 1`).bind(await hash(t)).first<Identity>()};
const allianceName=async(e:Env)=>{const row=await e.DB.prepare("SELECT name FROM alliance WHERE id=1 LIMIT 1").first<{name:string}>();return row?.name?.trim()||"Alliance"};
const normalize=(v:unknown)=>v instanceof Response?v:new Response(String(v??""),{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"no-referrer"}});

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
    if(currentTitle){
      const alliance=await allianceName(env);
      const page=path==="/"?"Leadership Console":currentTitle;
      const title=`${esc(alliance)} · ${page}`;
      html=html.replace(/<title>.*?<\/title>/i,`<title>${title}</title>`);
    }
    const who=await identity(request,env);
    if(who&&path!=="/"&&html.includes('<div class="adminbrand">')&&html.includes('<div class="crumb">')){
      const welcome=`<div class="signedinwelcome" style="margin-left:auto;text-align:right;line-height:1.2"><span style="display:block;color:#8292ae;font-size:.68rem;text-transform:uppercase;letter-spacing:.06em;font-weight:800">Welcome</span><strong style="display:block;font-size:.86rem;margin-top:3px">${esc(who.display_name)} · R${who.rank}</strong></div>`;
      html=html.replace('<div class="crumb">',`${welcome}<div class="crumb" style="margin-left:16px">`);
    }
    return new Response(html,{status:res.status,statusText:res.statusText,headers:res.headers});
  }
} satisfies ExportedHandler<Env>;
