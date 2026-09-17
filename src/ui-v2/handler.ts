import {loadUiV2Context,type UiV2Env} from "./context";
import {renderUiV2Audit} from "./audit";
import {handleUiV2Away} from "./away";
import {handleUiV2Backup} from "./backup";
import {handleUiV2Branding} from "./branding";
import {renderUiV2Console} from "./console";
import {renderUiV2Players} from "./players";
import {handleUiV2PlayerImport} from "./player_import";
import {handleUiV2PlayerManagement} from "./player_management";
import {handleUiV2Ranks} from "./ranks";
import {handleUiV2Security} from "./security";
import {handleUiV2Settings} from "./settings";

export async function handleUiV2(request:Request,env:UiV2Env):Promise<Response|null>{
  const url=new URL(request.url);
  const branding=await handleUiV2Branding(request,env);
  if(branding)return branding;
  const playerManagement=url.pathname.startsWith("/ui-v2/players/import")||url.pathname==="/ui-v2/players/new"||url.pathname==="/ui-v2/players/access"||/^\/ui-v2\/players\/access\/\d+\/(?:approve|reject|block)$/.test(url.pathname)||/^\/ui-v2\/players\/\d+(?:\/(?:update|performance|deactivate|reactivate|disconnect|login-enable|login-disable|notes)|\/notes\/\d+\/(?:update|delete))?$/.test(url.pathname);
  const away=url.pathname==="/ui-v2/away"||/^\/ui-v2\/away\/\d+\/(?:update|cancel)$/.test(url.pathname);
  const backup=url.pathname==="/ui-v2/backup"||/^\/ui-v2\/backup\/(?:complete|excel|roster)$/.test(url.pathname);
  const security=url.pathname==="/ui-v2/security"||url.pathname==="/ui-v2/security/groups"||url.pathname==="/ui-v2/security/owner-transfer"||/^\/ui-v2\/security\/(?:groups\/\d+(?:\/(?:delete|permissions|members(?:\/\d+\/remove)?))?|accounts\/\d+\/(?:administrator-add|administrator-remove)|blocks\/\d+\/unblock)$/.test(url.pathname);
  const settings=url.pathname==="/ui-v2/settings"||/^\/ui-v2\/settings\/(?:details|players|discord(?:\/(?:verify|disconnect))?)$/.test(url.pathname);
  const supported=(request.method==="GET"&&(url.pathname==="/ui-v2"||url.pathname==="/ui-v2/players"||url.pathname==="/ui-v2/ranks"||url.pathname==="/ui-v2/audit"||away||backup||playerManagement||security||settings))||(request.method==="POST"&&(url.pathname==="/ui-v2/ranks"||away||backup||playerManagement||security||settings));
  if(!supported)return null;

  const context=await loadUiV2Context(request,env);
  if(!context)return Response.redirect(new URL("/login",request.url),302);

  const securityResponse=await handleUiV2Security(request,env,context);
  if(securityResponse)return securityResponse;
  const awayResponse=await handleUiV2Away(request,env,context);
  if(awayResponse)return awayResponse;
  const backupResponse=await handleUiV2Backup(request,env,context);
  if(backupResponse)return backupResponse;
  if(request.method==="GET"&&url.pathname==="/ui-v2/audit")return renderUiV2Audit(env,context);
  const settingsResponse=await handleUiV2Settings(request,env,context);
  if(settingsResponse)return settingsResponse;
  const playerImport=await handleUiV2PlayerImport(request,env,context);
  if(playerImport)return playerImport;
  const management=await handleUiV2PlayerManagement(request,env,context);
  if(management)return management;
  if(request.method==="GET"&&url.pathname==="/ui-v2/players")return renderUiV2Players(env,context,url);
  if(url.pathname==="/ui-v2/ranks")return handleUiV2Ranks(request,env,context);

  return renderUiV2Console(env,context);
}
