import app from "./security_runtime";
import {leadershipHeader,leadershipShellCss} from "./leadership_shell";

interface Env { DB:D1Database }

const isLeadershipSubpage=(path:string)=>path.startsWith("/leadership/");

// Replace exactly the legacy .adminbrand element. We deliberately balance nested
// divs instead of guessing where page content begins: Settings pages wrap their
// first h1 in layout containers, so the old marker approach could remove opening
// layout markup and leave each Settings page with a different/broken structure.
const replaceLegacyHeader=(html:string,shared:string)=>{
  const start=html.indexOf('<div class="adminbrand"');
  if(start<0)return html;
  const tag=/<\/?div\b[^>]*>/gi;
  tag.lastIndex=start;
  let depth=0,m:RegExpExecArray|null;
  while((m=tag.exec(html))){
    if(/^<div\b/i.test(m[0]))depth++;
    else depth--;
    if(depth===0)return html.slice(0,start)+shared+html.slice(tag.lastIndex);
  }
  return html;
};

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const response=await(app as any).fetch(request,env,ctx);
  if(request.method!=="GET"||!response.headers.get("content-type")?.includes("text/html"))return response;
  const path=new URL(request.url).pathname;
  if(!isLeadershipSubpage(path))return response;
  let html=await response.text();
  if(!html.includes('class="adminbrand"'))return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  const shell=await leadershipHeader(request,env);
  html=replaceLegacyHeader(html,shell.html);
  html=html.replace("</head>",`${leadershipShellCss(shell.accent,shell.icon)}</head>`);
  const headers=new Headers(response.headers);headers.delete("content-length");
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}} satisfies ExportedHandler<Env>;
