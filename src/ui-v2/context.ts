import {playerActor,playerIsAdministrator,playerPermitted,type PlayerActor} from "../player_access";
import {resolveTheme,type ThemePalette} from "./theme";

export interface UiV2Env {
  DB:D1Database;
  ASSETS:R2Bucket;
  APP_URL:string;
}

export type UiV2Alliance={
  name:string;
  tag:string|null;
  serverNumber:number|null;
};

export type UiV2Branding={
  platformName:string;
  mainLogo:string|null;
  favicon:string|null;
  palette:ThemePalette;
  footerText:string;
  showRankNames:boolean;
};

export type UiV2User={
  accountId:number;
  displayName:string;
  rank:number|null;
  rankName:string|null;
  rankColour:string;
  isOwner:boolean;
  isAdministrator:boolean;
  canManageBranding:boolean;
  canManageRanks:boolean;
  canManagePlayers:boolean;
  canManageSecurity:boolean;
  canViewAudit:boolean;
  canManageSettings:boolean;
};

export type UiV2NavItem={
  label:string;
  href:string;
  section:"Navigation"|"Management"|"Security"|"Settings";
  anyPermission?:string[];
};

export type UiV2Context={
  alliance:UiV2Alliance;
  branding:UiV2Branding;
  user:UiV2User;
  navigation:UiV2NavItem[];
};

type AllianceRow={name:string;tag:string|null;server_number:number|null};
type SettingRow={key:string;value:string};
type PlayerRow={rank:number|null;rank_name:string|null;rank_colour:string|null};

const NAV_ITEMS:UiV2NavItem[]=[
  {label:"Leadership Console",href:"/ui-v2",section:"Navigation"},
  {label:"Players",href:"/ui-v2/players",section:"Management",anyPermission:["players.edit","players.manage_membership","players.approve_changes"]},
  {label:"Access & Permissions",href:"/leadership/security",section:"Security",anyPermission:["accounts.manage","permissions.manage"]},
  {label:"Audit Log",href:"/leadership/audit",section:"Security",anyPermission:["audit.view"]},
  {label:"Settings Home",href:"/leadership/settings",section:"Settings",anyPermission:["settings.manage","settings.details","settings.branding","settings.discord","settings.ranks","settings.players"]},
  {label:"Alliance Details",href:"/leadership/settings/details",section:"Settings",anyPermission:["settings.manage","settings.details"]},
  {label:"Branding",href:"/ui-v2/branding",section:"Settings",anyPermission:["settings.manage","settings.branding"]},
  {label:"Discord",href:"/leadership/settings/discord",section:"Settings",anyPermission:["settings.manage","settings.discord"]},
  {label:"Ranks",href:"/ui-v2/ranks",section:"Settings",anyPermission:["settings.manage","settings.ranks"]},
  {label:"Player Settings",href:"/leadership/settings/players",section:"Settings",anyPermission:["settings.manage","settings.players"]}
];

const anyPermitted=async(env:UiV2Env,actor:PlayerActor,permissions:string[])=>{
  for(const permission of permissions)if(await playerPermitted(env,actor,permission))return true;
  return false;
};

async function permittedNavigation(env:UiV2Env,actor:PlayerActor){
  const visible:UiV2NavItem[]=[];
  for(const item of NAV_ITEMS){
    if(!item.anyPermission){visible.push(item);continue;}
    for(const permission of item.anyPermission){
      if(await playerPermitted(env,actor,permission)){visible.push(item);break;}
    }
  }
  return visible;
}

export async function loadUiV2Context(request:Request,env:UiV2Env):Promise<UiV2Context|null>{
  const actor=await playerActor(request,env);
  if(!actor)return null;

  const playerPermissions=["players.edit","players.manage_membership","players.approve_changes"];
  const securityPermissions=["accounts.manage","permissions.manage"];
  const settingsPermissions=["settings.manage","settings.details","settings.branding","settings.discord","settings.ranks","settings.players"];
  const [alliance,settingRows,player,isAdministrator,canManageBranding,canManageRanks,canManagePlayers,canManageSecurity,canViewAudit,canManageSettings,navigation]=await Promise.all([
    env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<AllianceRow>(),
    env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'theme_%' OR key IN ('platform_name','brand_main_logo','brand_favicon','footer_text','show_rank_names')").all<SettingRow>(),
    actor.player_id
      ?env.DB.prepare("SELECT p.rank,r.display_name rank_name,r.colour rank_colour FROM players p LEFT JOIN alliance_ranks r ON r.rank_level=p.rank WHERE p.id=? LIMIT 1").bind(actor.player_id).first<PlayerRow>()
      :Promise.resolve(null),
    playerIsAdministrator(env,actor),
    playerPermitted(env,actor,"settings.branding"),
    playerPermitted(env,actor,"settings.ranks"),
    anyPermitted(env,actor,playerPermissions),
    anyPermitted(env,actor,securityPermissions),
    playerPermitted(env,actor,"audit.view"),
    anyPermitted(env,actor,settingsPermissions),
    permittedNavigation(env,actor)
  ]);

  if(!alliance)throw new Error("Alliance configuration is missing");
  const settings=Object.fromEntries((settingRows.results??[]).map(row=>[row.key,row.value]));
  const showRankNames=settings.show_rank_names!=="0";
  const rank=player?.rank??null;
  const configuredRankName=player?.rank_name?.trim()||null;
  const rankName=showRankNames&&configuredRankName&&configuredRankName.toLowerCase()!==`r${rank}`.toLowerCase()
    ?configuredRankName
    :null;
  const palette=resolveTheme(settings);

  return {
    alliance:{name:alliance.name,tag:alliance.tag,serverNumber:alliance.server_number},
    branding:{
      platformName:settings.platform_name?.trim()||"The Pond",
      mainLogo:settings.brand_main_logo||null,
      favicon:settings.brand_favicon||null,
      palette,
      footerText:settings.footer_text?.trim()||"",
      showRankNames
    },
    user:{
      accountId:actor.id,
      displayName:actor.display_name,
      rank,
      rankName,
      rankColour:player?.rank_colour||"#d7a83e",
      isOwner:Boolean(actor.is_owner),
      isAdministrator,
      canManageBranding,
      canManageRanks,
      canManagePlayers,
      canManageSecurity,
      canViewAudit,
      canManageSettings
    },
    navigation
  };
}
