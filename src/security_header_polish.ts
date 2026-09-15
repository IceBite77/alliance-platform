import app from "./security_dashboard";
import { leadershipHeader, leadershipShellCss } from "./leadership_shell";

interface Env { DB:D1Database; }

export default {
  async fetch(request:Request,env:Env,ctx:ExecutionContext):Promise<Response>{
    const response=await (app as any).fetch(request,env,ctx);
    if(!(response instanceof Response)||!response.headers.get("content-type")?.includes("text/html"))return response;
    const url=new URL(request.url);
    if(url.pathname!=="/security/access")return response;

    let html=await response.text();
    const shell=await leadershipHeader(request,env);
    html=html.replace(/<div class="adminbrand">[\s\S]*?<\/div><section class="hero">/,`${shell.html}<section class="hero">`);
    html=html.replace("</head>",`${leadershipShellCss(shell.accent,shell.icon)}<style>.hero{padding:0!important;margin:0 0 18px!important}.hero .step{font-size:.82rem!important;margin-bottom:8px!important}.hero h1{margin:0 0 8px!important;font-size:1.8rem!important}.hero p{margin:0!important;color:#b8c4d9!important;line-height:1.5!important}.summary{margin:22px 0!important}.card{background:#0e1626!important;border:1px solid #2b3850!important;border-radius:14px!important}.group,.permcat{background:#111b2e!important}</style></head>`);
    const headers=new Headers(response.headers);headers.delete("content-length");
    return new Response(html,{status:response.status,statusText:response.statusText,headers});
  }
} satisfies ExportedHandler<Env>;
