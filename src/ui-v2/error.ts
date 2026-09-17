import type {UiV2Env} from "./context";
import {esc} from "./shell";
import {resolveTheme} from "./theme";

type AllianceRow={name:string;tag:string|null;server_number:number|null};
type SettingRow={key:string;value:string};

const errors:Record<number,{eyebrow:string;title:string;message:string}>={
  400:{eyebrow:"Request problem",title:"That request could not be completed",message:"Please check the information and try again."},
  401:{eyebrow:"Sign-in required",title:"You need to sign in",message:"Sign in with Discord to continue to this page."},
  403:{eyebrow:"Access restricted",title:"You do not have access to this page",message:"Your account is signed in, but it does not have the permission required for this action."},
  404:{eyebrow:"Page missing",title:"This page has gone AWOL",message:"The address does not match a page in the platform. Nothing has been changed."},
  405:{eyebrow:"Action unavailable",title:"That action is not supported",message:"Return to the previous page and try the available controls instead."},
  409:{eyebrow:"Update conflict",title:"That change could not be applied",message:"The information changed before the request completed. Refresh the original page and try again."},
  413:{eyebrow:"Upload too large",title:"That file is too large",message:"Choose a smaller file and try the upload again."},
  429:{eyebrow:"Please slow down",title:"Too many requests",message:"Wait a moment, then try again."},
  500:{eyebrow:"Platform error",title:"Something went wrong",message:"The request was not completed. Please return to the platform and try again."},
  502:{eyebrow:"Connection problem",title:"A connected service is unavailable",message:"The platform could not reach a service it needs. Please try again shortly."},
  503:{eyebrow:"Temporarily unavailable",title:"The platform is taking a breather",message:"Please try again shortly."}
};

const assetUrl=(key:string)=>`/assets/${encodeURIComponent(key)}`;

function backPath(request:Request){
  const fallback="/ui-v2";
  const referer=request.headers.get("referer");
  if(!referer)return fallback;
  try{
    const source=new URL(referer),current=new URL(request.url);
    if(source.origin!==current.origin||source.pathname===current.pathname)return fallback;
    return `${source.pathname}${source.search}`;
  }catch{return fallback;}
}

export async function renderThemedError(request:Request,env:UiV2Env,status:number){
  const [alliance,settingRows]=await Promise.all([
    env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<AllianceRow>(),
    env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'theme_%' OR key IN ('platform_name','brand_main_logo','brand_favicon')").all<SettingRow>()
  ]);
  const settings=Object.fromEntries((settingRows.results??[]).map(row=>[row.key,row.value])),palette=resolveTheme(settings),error=errors[status]||{eyebrow:`Error ${status}`,title:"The request could not be completed",message:"Return to the platform and try again."},name=alliance?.name||"Alliance Platform",tag=alliance?.tag?`[${alliance.tag}]`:"Alliance",server=alliance?.server_number?`Server #${alliance.server_number}`:"Server not set",logo=settings.brand_main_logo?`<img src="${assetUrl(settings.brand_main_logo)}" alt="${esc(name)} crest">`:`<span>${esc(alliance?.tag||"AMP")}</span>`,favicon=settings.brand_favicon?`<link rel="icon" href="${assetUrl(settings.brand_favicon)}">`:"",back=backPath(request);
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${status} · ${esc(name)}</title>${favicon}<style>:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;--bg:${palette.pageBackground};--panel:${palette.panelBackground};--card:${palette.cardBackground};--line:${palette.border};--text:${palette.mainText};--muted:${palette.mutedText};--primary:${palette.primary};--secondary:${palette.secondary};--button:${palette.button};--button-text:${palette.buttonText};--hover:${palette.hover};--tag:${palette.allianceTag};--server:${palette.serverNumber};--site:${palette.siteName};--footer:${palette.footerWording}}*{box-sizing:border-box}body{display:grid;min-height:100vh;margin:0;padding:22px;place-items:center;background:radial-gradient(circle at top,color-mix(in srgb,var(--primary) 12%,var(--bg)) 0,var(--bg) 58%);color:var(--text)}main{width:min(100%,620px);overflow:hidden;border:1px solid var(--line);border-radius:20px;background:var(--panel);box-shadow:0 24px 70px rgba(0,0,0,.35)}.error-brand{display:flex;align-items:center;gap:15px;padding:19px 22px;border-bottom:1px solid var(--line)}.error-logo{display:grid;width:58px;height:58px;flex:0 0 58px;place-items:center;overflow:hidden;color:var(--primary);font-size:.72rem;font-weight:950;text-align:center}.error-logo img{display:block;width:100%;height:100%;object-fit:contain}.brand-copy strong,.brand-copy span{display:block}.brand-copy strong{font-size:1rem}.brand-copy span{margin-top:5px;color:var(--muted);font-size:.72rem;font-weight:750}.tag{color:var(--tag)}.server{color:var(--server)}.error-content{padding:30px 30px 32px}.error-code{color:var(--primary);font-size:.7rem;font-weight:950;letter-spacing:.1em;text-transform:uppercase}.error-content h1{margin:9px 0 10px;font-size:clamp(1.55rem,5vw,2.05rem);line-height:1.12;letter-spacing:-.025em}.error-content p{margin:0;color:var(--muted);font-size:.94rem;line-height:1.6}.error-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:23px}.error-button{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:10px 15px;border:1px solid transparent;border-radius:10px;background:var(--button);color:var(--button-text);font-size:.78rem;font-weight:900;text-decoration:none;transition:border-color .15s ease,box-shadow .15s ease,transform .15s ease}.error-button:hover{border-color:var(--hover);box-shadow:0 0 18px color-mix(in srgb,var(--hover) 15%,transparent);transform:translateY(-1px)}.error-button.secondary{border-color:var(--line);background:var(--card);color:var(--secondary)}.error-footer{display:flex;justify-content:space-between;gap:14px;padding:15px 22px;border-top:1px solid var(--line);color:var(--footer);font-size:.68rem}.error-footer strong{color:var(--site)}@media(max-width:520px){body{padding:12px}.error-brand{padding:16px 18px}.error-logo{width:50px;height:50px;flex-basis:50px}.error-content{padding:24px 18px 26px}.error-actions{display:grid}.error-button{width:100%}.error-footer{display:block;padding:14px 18px}.error-footer span{display:block;margin-top:4px}}</style></head><body><main><header class="error-brand"><div class="error-logo">${logo}</div><div class="brand-copy"><strong>${esc(name)}</strong><span><span class="tag">${esc(tag)}</span> · <span class="server">${esc(server)}</span></span></div></header><section class="error-content"><div class="error-code">${status} · ${esc(error.eyebrow)}</div><h1>${esc(error.title)}</h1><p>${esc(error.message)}</p><div class="error-actions"><a class="error-button" href="${esc(back)}">Return to previous page</a><a class="error-button secondary" href="/ui-v2">Leadership Console</a></div></section><footer class="error-footer"><strong>${esc(settings.platform_name?.trim()||"The Pond")}</strong><span>Error ${status}</span></footer></main></body></html>`;
  const returnLabel=back==="/ui-v2"?"Return to platform":"Return to previous page";
  const correctedHtml=html
    .replace("Return to previous page",returnLabel)
    .replace('<a class="error-button secondary" href="/ui-v2">Leadership Console</a>',"")
    .replace("</head>","<style>.brand-copy .tag,.brand-copy .server{display:inline;margin:0}</style></head>");
  return new Response(correctedHtml,{status,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-frame-options":"DENY","referrer-policy":"same-origin","content-security-policy":"default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"}});
}

export async function themedErrorResponse(request:Request,env:UiV2Env,response:Response){
  if(response.status<400||new URL(request.url).pathname.startsWith("/api/")||new URL(request.url).pathname.startsWith("/assets/"))return response;
  const destination=request.headers.get("sec-fetch-dest"),accept=request.headers.get("accept")||"";
  if(destination!=="document"&&!accept.includes("text/html"))return response;
  try{return await renderThemedError(request,env,response.status)}catch(error){console.error("Themed error page failed",error);return response;}
}
