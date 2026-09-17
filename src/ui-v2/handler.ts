import {loadUiV2Context,type UiV2Env} from "./context";
import {handleUiV2Branding} from "./branding";
import {renderUiV2Console} from "./console";
import {renderUiV2Players} from "./players";
import {handleUiV2PlayerImport} from "./player_import";
import {handleUiV2PlayerManagement} from "./player_management";
import {handleUiV2Ranks} from "./ranks";

export async function handleUiV2(request:Request,env:UiV2Env):Promise<Response|null>{
  const url=new URL(request.url);
  const branding=await handleUiV2Branding(request,env);
  if(branding)return branding;
  const playerManagement=url.pathname.startsWith("/ui-v2/players/import")||url.pathname==="/ui-v2/players/new"||url.pathname==="/ui-v2/players/access"||/^\/ui-v2\/players\/access\/\d+\/(?:approve|reject)$/.test(url.pathname)||/^\/ui-v2\/players\/\d+(?:\/(?:update|deactivate|reactivate|disconnect))?$/.test(url.pathname);
  const supported=(request.method==="GET"&&(url.pathname==="/ui-v2"||url.pathname==="/ui-v2/players"||url.pathname==="/ui-v2/ranks"||playerManagement))||(request.method==="POST"&&(url.pathname==="/ui-v2/ranks"||playerManagement));
  if(!supported)return null;

  const context=await loadUiV2Context(request,env);
  if(!context)return Response.redirect(new URL("/login",request.url),302);

  const playerImport=await handleUiV2PlayerImport(request,env,context);
  if(playerImport)return playerImport;
  const management=await handleUiV2PlayerManagement(request,env,context);
  if(management)return management;
  if(request.method==="GET"&&url.pathname==="/ui-v2/players")return renderUiV2Players(env,context,url);
  if(url.pathname==="/ui-v2/ranks")return handleUiV2Ranks(request,env,context);

  return renderUiV2Console(env,context);
}
