import {loadUiV2Context,type UiV2Env} from "./context";
import {handleUiV2Branding} from "./branding";
import {renderUiV2Console} from "./console";
import {renderUiV2Players} from "./players";
import {handleUiV2Ranks} from "./ranks";

export async function handleUiV2(request:Request,env:UiV2Env):Promise<Response|null>{
  const url=new URL(request.url);
  const branding=await handleUiV2Branding(request,env);
  if(branding)return branding;
  const supported=(request.method==="GET"&&(url.pathname==="/ui-v2"||url.pathname==="/ui-v2/players"||url.pathname==="/ui-v2/ranks"))||(request.method==="POST"&&url.pathname==="/ui-v2/ranks");
  if(!supported)return null;

  const context=await loadUiV2Context(request,env);
  if(!context)return Response.redirect(new URL("/login",request.url),302);

  if(request.method==="GET"&&url.pathname==="/ui-v2/players")return renderUiV2Players(env,context);
  if(url.pathname==="/ui-v2/ranks")return handleUiV2Ranks(request,env,context);

  return renderUiV2Console(env,context);
}
