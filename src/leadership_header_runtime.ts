import app from "./security_runtime";
import {leadershipHeader,leadershipShellCss} from "./leadership_shell";

interface Env { DB:D1Database }

const isLeadershipSubpage=(path:string)=>path.startsWith("/leadership/")&&path!=="/leadership/players"&&!path.startsWith("/leadership/players/");

export default {async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
  const response=await(app as any).fetch(request,env,ctx);
  if(request.method!=="GET"||!response.headers.get("content-type")?.includes("text/html"))return response;
  const path=new URL(request.url).pathname;
  if(!isLeadershipSubpage(path))return response;
  let html=await response.text();
  if(!html.includes('class="adminbrand"'))return new Response(html,{status:response.status,statusText:response.statusText,headers:response.headers});
  const shell=await leadershipHeader(request,env);
  html=html.replace(/<div class="adminbrand">[\s\S]*?<\/div>(?=\s*(?:<section|<div class="hero"|<div class="pagehead"|<div class="content"|<h1))/i,shell.html);
  if(!html.includes('id="leadership-shared-shell"'))html=html.replace("</head>",`${leadershipShellCss(shell.accent,shell.icon)}</head>`);
  const headers=new Headers(response.headers);headers.delete("content-length");
  return new Response(html,{status:response.status,statusText:response.statusText,headers});
}} satisfies ExportedHandler<Env>;
