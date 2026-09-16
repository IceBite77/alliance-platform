import runtime from "./runtime";
import leadershipApp from "./security_access";
import {playerActor,playerIsAdministrator} from "./player_access";

interface Env { DB:D1Database; ASSETS:R2Bucket; APP_URL:string; DISCORD_CLIENT_ID:string; DISCORD_CLIENT_SECRET:string; DISCORD_BOT_TOKEN:string; SETUP_KEY:string; AUTH_SECRET:string; }

// Permissions which expose at least one Leadership section. Normal member-only
// permissions (profile.view, vs.view, etc.) deliberately do not open Leadership.
const LEADERSHIP_PERMISSION_KEYS=[
  "players.edit","players.manage_membership","players.approve_changes","players.manage_protected_rank",
  "away.manage_all","vs.manage","ds.manage","intelligence.view","audit.view",
  "accounts.manage","permissions.manage","settings.manage","integrations.manage","system.manage",
  "settings.details","settings.branding","settings.discord","settings.ranks","settings.players"
];

const hasLeadershipAccess=async(env:Env,actor:{id:number;is_owner:number})=>{
  if(actor.is_owner===1||await playerIsAdministrator(env,actor as any))return true;
  const marks=LEADERSHIP_PERMISSION_KEYS.map(()=>"?").join(",");
  const row=await env.DB.prepare(`
    SELECT 1 AS ok
    WHERE EXISTS (
      SELECT 1
      FROM account_permission_overrides o
      JOIN permissions p ON p.id=o.permission_id
      WHERE o.account_id=? AND o.effect='allow' AND p.permission_key IN (${marks})
        AND NOT EXISTS (
          SELECT 1 FROM account_permission_overrides d
          WHERE d.account_id=o.account_id AND d.permission_id=o.permission_id AND d.effect='deny'
        )
    ) OR EXISTS (
      SELECT 1
      FROM account_groups ag
      JOIN group_permissions gp ON gp.group_id=ag.group_id
      JOIN permissions p ON p.id=gp.permission_id
      WHERE ag.account_id=? AND p.permission_key IN (${marks})
        AND NOT EXISTS (
          SELECT 1 FROM account_permission_overrides d
          WHERE d.account_id=ag.account_id AND d.permission_id=p.id AND d.effect='deny'
        )
    )
    LIMIT 1
  `).bind(actor.id,...LEADERSHIP_PERMISSION_KEYS,actor.id,...LEADERSHIP_PERMISSION_KEYS).first<{ok:number}>();
  return !!row?.ok;
};

const withHtml=(res:Response,html:string)=>{const headers=new Headers(res.headers);headers.delete("content-length");return new Response(html,{status:res.status,statusText:res.statusText,headers})};

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const url=new URL(request.url),actor=await playerActor(request,env).catch(()=>null);
  const leadership=actor?await hasLeadershipAccess(env,actor):false;

  if(request.method==="GET"&&url.pathname==="/leadership"){
    if(!actor)return Response.redirect(new URL("/login",request.url),302);
    if(!leadership)return new Response("Forbidden",{status:403});
    const rewritten=new URL(request.url);rewritten.pathname="/";
    return (leadershipApp as any).fetch(new Request(rewritten.toString(),request),env,ctx);
  }

  const response=await (runtime as any).fetch(request,env,ctx);
  if(request.method!=="GET"||url.pathname!=="/"||!leadership||!(response instanceof Response)||response.status!==200||!response.headers.get("content-type")?.includes("text/html"))return response;
  let html=await response.text();
  if(!html.includes('class="leadership"')){
    const card=`<a class="leadership" href="/leadership"><strong>Leadership Console</strong><span>Management, operations and alliance settings →</span></a>`;
    html=html.replace('<div class="footer">',`${card}<div class="footer">`);
  }
  return withHtml(response,html);
}} satisfies ExportedHandler<Env>;
