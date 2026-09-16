import players from "./leadership_players";
import {playerActor,playerRedirect} from "./player_access";
import {deactivatePlayerMembership,reactivatePlayerMembership,disconnectPlayerLogin} from "./player_membership";

interface Env { DB:D1Database; APP_URL:string }

const PREVIEW="/leadership/players-preview";
const LIVE="/leadership/players";

const legacyVisualCss=`<style id="players-preview-visual-match">
.pagehead{display:block!important;margin-bottom:0!important}.pagehead h1{margin:0 0 8px!important;font-size:1.8rem!important}.pagehead p{color:#b8c4d9!important;line-height:1.5!important;margin:0!important}.pagehead>.button{position:absolute;right:30px;margin-top:76px!important}.tabs{display:flex!important;gap:8px!important;margin:22px 0!important}.tabs a{padding:8px 11px!important;border-radius:999px!important;border:1px solid #34445f!important;color:#aebddd!important;text-decoration:none!important;font-size:.82rem!important;font-weight:800!important}.tabs a.active{background:#111b2e!important;border-color:var(--accent)!important;color:#fff!important}.players{display:grid!important;gap:10px!important}.playerrow{display:grid!important;grid-template-columns:56px 1fr 150px 34px!important;gap:14px!important;align-items:center!important;padding:13px 15px!important;border:1px solid #2b3850!important;border-radius:13px!important;background:#0e1626!important;text-decoration:none!important;color:#eef3ff!important}.playerrow:hover{border-color:var(--accent)!important}.previewrank{width:44px;height:44px;border-radius:11px;background:#111b2e;border:1px solid #34445f;display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--icon);overflow:hidden}.previewrank img{width:100%;height:100%;object-fit:contain}.pname{font-weight:850!important}.meta{font-size:.8rem!important;color:#8292ae!important;margin-top:3px!important}.status{font-size:.78rem!important;font-weight:800!important;background:none!important;padding:0!important}.status.login{color:#87e6a7!important}.previewarrow{color:#63769a;font-size:1.25rem}.formcard{padding:18px!important;border-radius:14px!important;background:#0e1626!important;border:1px solid #2b3850!important}.fieldgrid{gap:12px!important}label{display:block!important;margin:14px 0 7px!important;font-weight:700!important;font-size:inherit!important;color:inherit!important}input,select{width:100%!important;padding:11px 12px!important;border-radius:10px!important;border:1px solid #3a4964!important;background:#0e1626!important;color:#fff!important;font-size:.95rem!important}.hint{font-size:.78rem!important;color:#8292ae!important;margin-top:6px!important}.actions{display:flex!important;gap:10px!important;margin-top:18px!important}.button,button{display:inline-block!important;border:0!important;border-radius:10px!important;background:var(--accent)!important;color:#fff!important;text-decoration:none!important;font-weight:800!important;padding:11px 14px!important;cursor:pointer!important}.button.secondary,button.secondary{background:#26344d!important}.button.danger,button.danger{background:#6f2b38!important}
@media(max-width:700px){.pagehead>.button{position:static;display:block!important;text-align:center;margin-top:12px!important}.playerrow{grid-template-columns:48px 1fr 28px!important}.playerrow .status{display:none!important}.fieldgrid{grid-template-columns:1fr!important}.actions{display:grid!important}.actions button,.actions .button{width:100%!important;text-align:center!important}}
</style>`;

const rewriteRequest=(request:Request)=>{
  const url=new URL(request.url);
  url.pathname=url.pathname.replace(PREVIEW,LIVE);
  return new Request(url.toString(),request);
};

const decorateList=async(body:string,env:Env)=>{
  if(!body.includes('<div class="players">'))return body;
  const ranks=await env.DB.prepare("SELECT rank_level,display_name,image_path FROM alliance_ranks ORDER BY rank_level DESC").all<{rank_level:number;display_name:string;image_path:string|null}>();
  const byRank=new Map((ranks.results??[]).map(r=>[r.rank_level,r]));
  return body.replace(/<a class="playerrow"([^>]*)><div class="grow"><div class="pname">([\s\S]*?)<\/div><div class="meta">Player ID \d+ · R(\d)([\s\S]*?)<\/div><\/div>([\s\S]*?)<\/a>/g,(whole,attrs,name,rankText,rest,status)=>{
    const rank=Number(rankText),rr=byRank.get(rank);
    const art=rr?.image_path?`<img src="/assets/${encodeURIComponent(rr.image_path)}" alt="">`:`R${rank}`;
    const rankName=rr&&rr.display_name!==`R${rank}`?` ${rr.display_name}`:"";
    const cleanedRest=String(rest).replace(/ · Discord [^<]*/,"");
    return `<a class="playerrow"${attrs}><div class="previewrank">${art}</div><div class="grow"><div class="pname">${name}</div><div class="meta">R${rank}${rankName}${cleanedRest}</div></div>${status}<div class="previewarrow">›</div></a>`;
  });
};

const rewriteResponse=async(response:Response,env:Env)=>{
  const location=response.headers.get("location");
  if(location){
    const url=new URL(location);
    if(url.pathname.startsWith(LIVE)){
      url.pathname=url.pathname.replace(LIVE,PREVIEW);
      const headers=new Headers(response.headers);headers.set("location",url.toString());
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    }
    return response;
  }
  if(!response.headers.get("content-type")?.includes("text/html"))return response;
  let body=(await response.text()).replaceAll(LIVE,PREVIEW);
  body=await decorateList(body,env);
  body=body.replace('<h1>Players</h1><p>Roster, profiles, birthdays, rank history and platform access.</p>','<div class="step">Management</div><h1>Players</h1><p>Manage alliance members, ranks and lifecycle details. Player IDs stay fixed even when names change, so history remains intact.</p>');
  body=body.replace('>Active Players</a>','>Active</a>').replace('>Former Players</a>','>Former members</a>').replace('>Add Player</a>','>+ Add player</a>');
  body=body.replace('</head>',legacyVisualCss+'</head>');
  return new Response(body,{status:response.status,statusText:response.statusText,headers:response.headers});
};

export default {async fetch(request:Request,env:Env):Promise<Response>{
  const path=new URL(request.url).pathname;
  const actor=await playerActor(request,env);if(!actor)return playerRedirect("/login",request);
  const deactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/deactivate$/);
  if(request.method==="POST"&&deactivate){
    const result=await deactivatePlayerMembership(request,env,actor,Number(deactivate[1]));
    if(result)return result;
    return playerRedirect(`${PREVIEW}?show=inactive`,request);
  }
  const reactivate=path.match(/^\/leadership\/players-preview\/(\d+)\/reactivate$/);
  if(request.method==="POST"&&reactivate){
    const result=await reactivatePlayerMembership(request,env,actor,Number(reactivate[1]));
    if(result)return result;
    return playerRedirect(`${PREVIEW}/${Number(reactivate[1])}?saved=1`,request);
  }
  const disconnect=path.match(/^\/leadership\/players-preview\/(\d+)\/disconnect-discord$/);
  if(request.method==="POST"&&disconnect){
    const result=await disconnectPlayerLogin(request,env,actor,Number(disconnect[1]));
    if(result)return result;
    return playerRedirect(`${PREVIEW}/${Number(disconnect[1])}?discord=disconnected`,request);
  }
  return rewriteResponse(await (players as any).fetch(rewriteRequest(request),env),env);
}} satisfies ExportedHandler<Env>;
