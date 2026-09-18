import {playerActor,playerIsAdministrator,playerPermitted,type PlayerActor} from "../player_access";
import {resolveTheme,type ThemePalette} from "./theme";

export interface UiV2Env {
  DB:D1Database;
  ASSETS:R2Bucket;
  APP_URL:string;
  DISCORD_CLIENT_ID?:string;
  DISCORD_BOT_TOKEN?:string;
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
  playerId:number|null;
  displayName:string;
  rank:number|null;
  rankName:string|null;
  rankColour:string;
  isOwner:boolean;
  isAdministrator:boolean;
  canAccessLeadership:boolean;
  canManageBranding:boolean;
  canManageRanks:boolean;
  canManageDetails:boolean;
  canManageDiscord:boolean;
  canManagePlayerSettings:boolean;
  canManagePlayers:boolean;
  canManageAway:boolean;
  canManageVs:boolean;
  canViewVs:boolean;
  canManageDs:boolean;
  canViewDs:boolean;
  canManageTrain:boolean;
  canManageShieldDrops:boolean;
  canViewIntelligence:boolean;
  canViewFrontRankings:boolean;
  canViewFrontShieldDrops:boolean;
  canViewFrontAwayDetails:boolean;
  canViewFrontTrain:boolean;
  canEditPlayers:boolean;
  canManageMembership:boolean;
  canManageProtectedRank:boolean;
  canManageAccounts:boolean;
  canManagePrivateNotes:boolean;
  canApproveAccounts:boolean;
  canApprovePlayerChanges:boolean;
  canManageSecurity:boolean;
  canManagePermissions:boolean;
  canViewAudit:boolean;
  canManageSettings:boolean;
};

export type UiV2NavItem={
  label:string;
  href:string;
  section:"Navigation"|"Management"|"Operations"|"Security"|"Settings";
  anyPermission?:string[];
  ownerOnly?:boolean;
  administratorOnly?:boolean;
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

const LEADERSHIP_PERMISSIONS=[
  "players.edit","players.manage_membership","players.approve_changes","players.manage_protected_rank",
  "players.private_notes","accounts.approve","accounts.manage",
  "away.manage_all","vs.manage","ds.manage","train.manage","shield_drops.manage","intelligence.view","audit.view","settings.manage","settings.details","settings.branding",
  "settings.discord","integrations.manage","settings.ranks","settings.players"
];

const NAV_ITEMS:UiV2NavItem[]=[
  {label:"Front Page",href:"/ui-v2",section:"Navigation"},
  {label:"My Profile",href:"/ui-v2/my-profile",section:"Navigation"},
  {label:"Leadership Console",href:"/ui-v2/leadership",section:"Navigation",anyPermission:LEADERSHIP_PERMISSIONS},
  {label:"Players",href:"/ui-v2/players",section:"Management",anyPermission:["players.edit","players.manage_membership","players.approve_changes","players.manage_protected_rank","players.private_notes","accounts.approve","accounts.manage"]},
  {label:"Player Change Requests",href:"/ui-v2/player-changes",section:"Management",anyPermission:["players.approve_changes"]},
  {label:"Away",href:"/ui-v2/away",section:"Operations",anyPermission:["away.manage_all"]},
  {label:"VS Battle Centre",href:"/ui-v2/vs",section:"Operations",anyPermission:["vs.manage"]},
  {label:"Desert Storm",href:"/ui-v2/desert-storm",section:"Operations",anyPermission:["ds.manage"]},
  {label:"Weekly Events",href:"/ui-v2/events",section:"Operations",anyPermission:["away.manage_all","vs.manage","ds.manage","settings.manage"]},
  {label:"Alliance Train",href:"/ui-v2/train",section:"Operations",anyPermission:["train.manage"]},
  {label:"Shield Drop Watch",href:"/ui-v2/shield-drops",section:"Operations",anyPermission:["shield_drops.manage"]},
  {label:"Intelligence Centre",href:"/ui-v2/intelligence",section:"Operations",anyPermission:["intelligence.view"]},
  {label:"Backup & Export",href:"/ui-v2/backup",section:"Operations",ownerOnly:true},
  {label:"Access & Permissions",href:"/ui-v2/security",section:"Security",administratorOnly:true},
  {label:"Audit Log",href:"/ui-v2/audit",section:"Security",anyPermission:["audit.view"]},
  {label:"Settings Home",href:"/ui-v2/settings",section:"Settings",anyPermission:["settings.manage","settings.details","settings.branding","settings.discord","integrations.manage","settings.ranks","settings.players"]},
  {label:"Alliance Details",href:"/ui-v2/settings/details",section:"Settings",anyPermission:["settings.manage","settings.details"]},
  {label:"Branding",href:"/ui-v2/branding",section:"Settings",anyPermission:["settings.manage","settings.branding"]},
  {label:"Discord",href:"/ui-v2/settings/discord",section:"Settings",anyPermission:["settings.manage","settings.discord","integrations.manage"]},
  {label:"Ranks",href:"/ui-v2/ranks",section:"Settings",anyPermission:["settings.manage","settings.ranks"]},
  {label:"Player Settings",href:"/ui-v2/settings/players",section:"Settings",anyPermission:["settings.manage","settings.players"]}
];

const anyPermitted=async(env:UiV2Env,actor:PlayerActor,permissions:string[])=>{
  for(const permission of permissions)if(await playerPermitted(env,actor,permission))return true;
  return false;
};

async function permittedNavigation(env:UiV2Env,actor:PlayerActor){
  const visible:UiV2NavItem[]=[],administrator=await playerIsAdministrator(env,actor);
  for(const item of NAV_ITEMS){
    if(item.ownerOnly&&!actor.is_owner)continue;
    if(item.administratorOnly&&!administrator)continue;
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

  const playerPermissions=["players.edit","players.manage_membership","players.approve_changes","players.manage_protected_rank","players.private_notes","accounts.approve","accounts.manage"];
  const securityPermissions=["accounts.manage","permissions.manage"];
  const settingsPermissions=["settings.manage","settings.details","settings.branding","settings.discord","integrations.manage","settings.ranks","settings.players"];
  const [alliance,settingRows,player,isAdministrator,canAccessLeadership,canManageBranding,canManageRanks,canManageDetails,canManageDiscord,canManagePlayerSettings,canManagePlayers,canManageAway,canManageVs,canViewVs,canManageDs,canViewDs,canManageTrain,canManageShieldDrops,canViewIntelligence,canViewFrontRankings,canViewFrontShieldDrops,canViewFrontAwayDetails,canViewFrontTrain,canEditPlayers,canManageMembership,canManageProtectedRank,canManageAccounts,canManagePrivateNotes,canApproveAccounts,canApprovePlayerChanges,canManageSecurity,canManagePermissions,canViewAudit,canManageSettings,navigation]=await Promise.all([
    env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<AllianceRow>(),
    env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'theme_%' OR key IN ('platform_name','brand_main_logo','brand_favicon','footer_text','show_rank_names')").all<SettingRow>(),
    actor.player_id
      ?env.DB.prepare("SELECT p.rank,r.display_name rank_name,r.colour rank_colour FROM players p LEFT JOIN alliance_ranks r ON r.rank_level=p.rank WHERE p.id=? LIMIT 1").bind(actor.player_id).first<PlayerRow>()
      :Promise.resolve(null),
    playerIsAdministrator(env,actor),
    anyPermitted(env,actor,LEADERSHIP_PERMISSIONS),
    anyPermitted(env,actor,["settings.manage","settings.branding"]),
    anyPermitted(env,actor,["settings.manage","settings.ranks"]),
    anyPermitted(env,actor,["settings.manage","settings.details"]),
    anyPermitted(env,actor,["settings.manage","settings.discord","integrations.manage"]),
    anyPermitted(env,actor,["settings.manage","settings.players"]),
    anyPermitted(env,actor,playerPermissions),
    playerPermitted(env,actor,"away.manage_all"),
    playerPermitted(env,actor,"vs.manage"),
    playerPermitted(env,actor,"vs.view"),
    playerPermitted(env,actor,"ds.manage"),
    playerPermitted(env,actor,"ds.view"),
    playerPermitted(env,actor,"train.manage"),
    playerPermitted(env,actor,"shield_drops.manage"),
    playerPermitted(env,actor,"intelligence.view"),
    playerPermitted(env,actor,"front.rankings.view"),
    playerPermitted(env,actor,"front.shield_drops.view"),
    playerPermitted(env,actor,"front.away_details.view"),
    playerPermitted(env,actor,"front.train.view"),
    playerPermitted(env,actor,"players.edit"),
    playerPermitted(env,actor,"players.manage_membership"),
    playerPermitted(env,actor,"players.manage_protected_rank"),
    playerPermitted(env,actor,"accounts.manage"),
    playerPermitted(env,actor,"players.private_notes"),
    playerPermitted(env,actor,"accounts.approve"),
    playerPermitted(env,actor,"players.approve_changes"),
    anyPermitted(env,actor,securityPermissions),
    playerPermitted(env,actor,"permissions.manage"),
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
      playerId:actor.player_id,
      displayName:actor.display_name,
      rank,
      rankName,
      rankColour:player?.rank_colour||"#d7a83e",
      isOwner:Boolean(actor.is_owner),
      isAdministrator,
      canAccessLeadership,
      canManageBranding,
      canManageRanks,
      canManageDetails,
      canManageDiscord,
      canManagePlayerSettings,
      canManagePlayers,
      canManageAway,
      canManageVs,
      canViewVs,
      canManageDs,
      canViewDs,
      canManageTrain,
      canManageShieldDrops,
      canViewIntelligence,
      canViewFrontRankings,
      canViewFrontShieldDrops,
      canViewFrontAwayDetails,
      canViewFrontTrain,
      canEditPlayers,
      canManageMembership,
      canManageProtectedRank,
      canManageAccounts,
      canManagePrivateNotes,
      canApproveAccounts,
      canApprovePlayerChanges,
      canManageSecurity:isAdministrator,
      canManagePermissions:isAdministrator,
      canViewAudit,
      canManageSettings
    },
    navigation
  };
}
