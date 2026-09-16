export interface PlayerAccessEnv { DB:D1Database; APP_URL:string }

export type PlayerActor={id:number;display_name:string;is_owner:number};

const SESSION_COOKIE="ap_session";

const cookie=(request:Request,name:string)=>{
  for(const part of(request.headers.get("cookie")??"").split(";")){
    const [key,...value]=part.trim().split("=");
    if(key===name)return value.join("=");
  }
  return null;
};

const b64=(bytes:Uint8Array)=>{
  let text="";
  for(const byte of bytes)text+=String.fromCharCode(byte);
  return btoa(text).replaceAll("+","-").replaceAll("/","_").replaceAll("=","");
};

const hash=async(value:string)=>b64(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))));

export const playerActor=async(request:Request,env:PlayerAccessEnv)=>{
  const token=cookie(request,SESSION_COOKIE);
  if(!token)return null;
  return await env.DB.prepare(`
    SELECT a.id,a.display_name,a.is_owner
    FROM sessions s
    JOIN accounts a ON a.id=s.account_id
    LEFT JOIN players p ON p.id=a.player_id
    WHERE s.token_hash=?
      AND s.revoked_at IS NULL
      AND s.expires_at>CURRENT_TIMESTAMP
      AND a.is_active=1
      AND a.approval_status='active'
      AND (a.is_owner=1 OR (a.player_id IS NOT NULL AND p.is_active=1))
    LIMIT 1
  `).bind(await hash(token)).first<PlayerActor>();
};

export const playerPermitted=async(env:PlayerAccessEnv,actor:PlayerActor,key:string)=>{
  if(actor.is_owner)return true;
  const row=await env.DB.prepare(`
    SELECT CASE
      WHEN EXISTS(
        SELECT 1 FROM account_permission_overrides o
        JOIN permissions p ON p.id=o.permission_id
        WHERE o.account_id=? AND p.permission_key=? AND o.effect='deny'
      ) THEN 0
      WHEN EXISTS(
        SELECT 1 FROM account_permission_overrides o
        JOIN permissions p ON p.id=o.permission_id
        WHERE o.account_id=? AND p.permission_key=? AND o.effect='allow'
      ) THEN 1
      WHEN EXISTS(
        SELECT 1 FROM account_groups ag
        JOIN group_permissions gp ON gp.group_id=ag.group_id
        JOIN permissions p ON p.id=gp.permission_id
        WHERE ag.account_id=? AND p.permission_key=?
      ) THEN 1
      ELSE 0
    END AS allowed
  `).bind(actor.id,key,actor.id,key,actor.id,key).first<{allowed:number}>();
  return Number(row?.allowed??0)===1;
};

export const playerSameOrigin=(request:Request,env:PlayerAccessEnv)=>{
  const site=request.headers.get("sec-fetch-site");
  if(site==="same-origin"||site==="none")return true;
  const origin=request.headers.get("origin");
  if(!origin)return true;
  const allowed=new Set([new URL(request.url).origin,new URL(env.APP_URL).origin]);
  return allowed.has(origin);
};

export const playerRedirect=(path:string,request:Request)=>Response.redirect(new URL(path,request.url),302);
