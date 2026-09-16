import {loadUiV2Context,type UiV2Env} from "./context";
import {handleUiV2Branding} from "./branding";
import {renderUiV2Console} from "./console";
import {renderUiV2Players} from "./players";

export async function handleUiV2(request:Request,env:UiV2Env):Promise<Response|null>{
  const url=new URL(request.url);
  const branding=await handleUiV2Branding(request,env);
  if(branding)return branding;
  if(request.method!=="GET"||!(url.pathname==="/ui-v2"||url.pathname==="/ui-v2/players"))return null;

  const context=await loadUiV2Context(request,env);
  if(!context)return Response.redirect(new URL("/login",request.url),302);

  if(request.method==="GET"&&url.pathname==="/ui-v2/players")return renderUiV2Players(env,context);

  return renderUiV2Console(env,context);
}
