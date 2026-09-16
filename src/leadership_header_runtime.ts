import app from "./security_runtime";
import {leadershipHeader,leadershipShellCss} from "./leadership_shell";

interface Env { DB:D1Database }

const isLeadershipSubpage=(path:string)=>path.startsWith("/leadership/");

// Remove whichever legacy header a renderer supplied. Different generations of
// Leadership pages used different nested markup, so matching the whole block with
// one regex was unreliable. The shared shell is now inserted immediately before
// the page's first real content heading/section after the old header is removed.
const replaceLegacyHeader=(html:string,shared:string)=>{
  const start=html.indexOf('<div class="adminbrand"');
  if(start<0)return html;
  const contentMarkers=['<section class="hero"','<div class="hero"','<div class="pagehead"','<div class="content"','<h1'];
  let end=-1;
  for(const marker of contentMarkers){const i=html.indexOf(marker,start);if(i>=0&&(end<0||i<end))end=i;}
  if(end<0)return html;
  return html.slice(0,start)+shared+html.slice(end);
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
  // Always append the master shell last so old page-local .adminbrand rules cannot
  // win through source order. This is the same shared implementation for Players,
  // Security, Audit, Settings and their child pages.
  html=html.replace("</head>",`${leadershipShellCss(shell.accent,shell.icon)}</head>`);
  const headers=new Headers(response.headers);headers.delete("content-length");
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}} satisfies ExportedHandler<Env>;
