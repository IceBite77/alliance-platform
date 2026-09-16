import {playerActor,playerIsAdministrator,playerPermitted,type PlayerActor} from "../player_access";

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
  accent:string;
  highlight:string;
  footerText:string;
  showRankNames:boolean;
};

export type UiV2User={
  accountId:number;
  displayName:string;
  rank:number|null;
  rankName:string|null;
  isOwner:boolean;
  isAdministrator:boolean;
};

export type UiV2NavItem={
  label:string;
  href:string;
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
type PlayerRow={rank:number|null;rank_name:string|null};

const DEFAULT_ACCENT="#5865f2";
const DEFAULT_HIGHLIGHT="#d7a83e";
const validHex=(value:string|undefined)=>Boolean(value&&/^#[0-9a-fA-F]{6}$/.test(value));

const NAV_ITEMS:UiV2NavItem[]=[
  {label:"Leadership Console",href:"/leadership"},
  {label:"Players",href:"/leadership/players",anyPermission:["players.edit","players.manage_membership","players.approve_changes"]},
  {label:"Security",href:"/leadership/security",anyPermission:["accounts.manage","permissions.manage"]},
  {label:"Audit Log",href:"/leadership/audit",anyPermission:["audit.view"]},
  {label:"Settings",href:"/leadership/settings",anyPermission:["settings.manage","settings.details","settings.branding","settings.discord","settings.ranks","settings.players"]}
];

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

  const [alliance,settingRows,player,isAdministrator,navigation]=await Promise.all([
    env.DB.prepare("SELECT name,tag,server_number FROM alliance WHERE id=1").first<AllianceRow>(),
    env.DB.prepare("SELECT key,value FROM settings WHERE key IN ('platform_name','brand_main_logo','brand_favicon','theme_accent','theme_icon','footer_text','show_rank_names')").all<SettingRow>(),
    actor.player_id
      ?env.DB.prepare("SELECT p.rank,r.display_name rank_name FROM players p LEFT JOIN alliance_ranks r ON r.rank_level=p.rank WHERE p.id=? LIMIT 1").bind(actor.player_id).first<PlayerRow>()
      :Promise.resolve(null),
    playerIsAdministrator(env,actor),
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

  return {
    alliance:{name:alliance.name,tag:alliance.tag,serverNumber:alliance.server_number},
    branding:{
      platformName:settings.platform_name?.trim()||"The Alliance Management Platform",
      mainLogo:settings.brand_main_logo||null,
      favicon:settings.brand_favicon||null,
      accent:validHex(settings.theme_accent)?settings.theme_accent:DEFAULT_ACCENT,
      highlight:validHex(settings.theme_icon)?settings.theme_icon:DEFAULT_HIGHLIGHT,
      footerText:settings.footer_text?.trim()||"",
      showRankNames
    },
    user:{
      accountId:actor.id,
      displayName:actor.display_name,
      rank,
      rankName,
      isOwner:Boolean(actor.is_owner),
      isAdministrator
    },
    navigation
  };
}
