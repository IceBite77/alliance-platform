import {loadUiV2Context,type UiV2Env} from "./context";
import {renderUiV2Shell,uiV2Html} from "./shell";

const previewBody=`<div class="content-grid"><section class="ui-card"><span class="card-label">One source</span><h2>Application shell</h2><p>The header, identity, branding, navigation, page width and footer on this page are rendered once by the new shell.</p></section><section class="ui-card"><span class="card-label">Existing engine</span><h2>Backend retained</h2><p>This preview uses the current Discord session, D1 alliance settings, player link, ranks and central permission system.</p></section><section class="ui-card"><span class="card-label">Clean boundary</span><h2>No legacy rewrites</h2><p>No HTML replacement, header polish, route translation or page-specific header CSS is involved in this UI.</p></section></div>`;

export async function handleUiV2(request:Request,env:UiV2Env):Promise<Response|null>{
  const url=new URL(request.url);
  if(request.method!=="GET"||url.pathname!=="/ui-v2")return null;

  const context=await loadUiV2Context(request,env);
  if(!context)return Response.redirect(new URL("/login",request.url),302);

  return uiV2Html(renderUiV2Shell(context,{
    eyebrow:"UI v2 · Shell preview",
    title:"A clean foundation",
    description:"This is the new application shell in isolation. Once its desktop, iPad and mobile layout is approved, each real module will supply only the content below this heading.",
    body:previewBody
  }));
}
