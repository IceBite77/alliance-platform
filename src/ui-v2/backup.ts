import * as XLSX from "xlsx";
import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type CountRow={total:number};
type AuditRow={occurred_at:string;action:string};
type DataRow=Record<string,unknown>;

const backupTables=[
  "settings","alliance","players","player_away","player_away_periods","player_squads","player_companions",
  "player_roster_snapshots","player_rank_history","player_private_notes","alliance_ranks","accounts","account_identities",
  "permissions","rank_permissions","permission_groups","group_permissions","permission_group_ranks","account_groups","account_permission_overrides",
  "account_security_blocks","discord_guild_connection","audit_log"
] as const;

const reportSheets:Array<[string,string]>=[
  ["Players",`SELECT p.id "Player ID",p.display_name "Player Name",'R'||p.rank "Rank",r.display_name "Rank Title",p.base_level "Base Level",p.player_power "Total Strength",p.total_hero_power "Total Hero Power",CASE p.is_active WHEN 1 THEN 'Active' ELSE 'Former' END "Membership",p.joined_at "Joined",p.left_at "Left",printf('%02d/%02d',p.birthday_day,p.birthday_month) "Birthday" FROM players p LEFT JOIN alliance_ranks r ON r.rank_level=p.rank ORDER BY p.is_active DESC,p.display_name COLLATE NOCASE`],
  ["Squads",`SELECT p.display_name "Player",s.squad_number "Squad",s.power "Power",s.updated_at "Updated" FROM player_squads s JOIN players p ON p.id=s.player_id ORDER BY p.display_name COLLATE NOCASE,s.squad_number`],
  ["Companions",`SELECT p.display_name "Player",c.companion_type "Companion",c.level "Level",c.assigned_squad "Assigned Squad",c.updated_at "Updated" FROM player_companions c JOIN players p ON p.id=c.player_id ORDER BY p.display_name COLLATE NOCASE,c.companion_type`],
  ["Away",`SELECT p.display_name "Player",w.start_date "Start Date",w.end_date "End Date",w.note "Note",CASE WHEN w.cancelled_at IS NULL THEN 'Recorded' ELSE 'Cancelled' END "Status",w.created_at "Created",w.updated_at "Updated" FROM player_away_periods w JOIN players p ON p.id=w.player_id ORDER BY w.start_date DESC,p.display_name COLLATE NOCASE`],
  ["Performance History",`SELECT p.display_name "Player",s.total_strength "Total Strength",s.squad_1_power "Squad 1",s.squad_2_power "Squad 2",s.squad_3_power "Squad 3",s.squad_4_power "Squad 4",s.total_hero_power "Total Hero Power",s.source "Source",s.recorded_at "Recorded" FROM player_roster_snapshots s JOIN players p ON p.id=s.player_id ORDER BY s.recorded_at DESC,p.display_name COLLATE NOCASE`],
  ["Rank History",`SELECT p.display_name "Player",CASE WHEN h.old_rank IS NULL THEN NULL ELSE 'R'||h.old_rank END "Previous Rank",'R'||h.new_rank "New Rank",h.note "Note",h.changed_at "Changed" FROM player_rank_history h JOIN players p ON p.id=h.player_id ORDER BY h.changed_at DESC,p.display_name COLLATE NOCASE`]
];

const css=`<style>
.backup-status{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}.backup-status div{padding:15px 16px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.backup-status span,.backup-status strong{display:block}.backup-status span{color:var(--ui-muted);font-size:.67rem;font-weight:900;letter-spacing:.07em;text-transform:uppercase}.backup-status strong{margin-top:6px;font-size:.93rem}.backup-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.backup-card{display:flex;min-height:245px;flex-direction:column;padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.backup-card .label{color:var(--ui-accent);font-size:.66rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.backup-card h2{margin:10px 0 7px;font-size:1.08rem}.backup-card p{margin:0;color:var(--ui-muted);font-size:.8rem;line-height:1.55}.backup-card ul{margin:13px 0 17px;padding-left:18px;color:var(--ui-secondary);font-size:.72rem;line-height:1.6}.backup-card form{margin-top:auto}.backup-button{width:100%;padding:11px 13px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.77rem;font-weight:900;cursor:pointer;transition:box-shadow .15s ease,transform .15s ease}.backup-button:hover{box-shadow:0 0 18px color-mix(in srgb,var(--ui-hover) 18%,transparent);transform:translateY(-1px)}.backup-note{margin-top:16px;padding:14px 15px;border:1px solid var(--ui-line);border-radius:12px;background:var(--ui-surface-3);color:var(--ui-muted);font-size:.76rem;line-height:1.55}.backup-note strong{color:var(--ui-secondary)}@media(max-width:850px){.backup-grid{grid-template-columns:1fr}.backup-card{min-height:0}}@media(max-width:620px){.backup-status{grid-template-columns:1fr}}
</style>`;

const pad=(value:number)=>String(value).padStart(2,"0");
const timestamp=()=>{const date=new Date();return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`};
const slug=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"alliance";
const download=(body:BodyInit,type:string,filename:string)=>new Response(body,{headers:{"content-type":type,"content-disposition":`attachment; filename="${filename}"`,"cache-control":"no-store","x-content-type-options":"nosniff"}});
const audit=(env:UiV2Env,context:UiV2Context,action:string,metadata:unknown)=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,"platform_backup","installation","ui-v2-backup",JSON.stringify(metadata)).run();

const bytesToBase64=(buffer:ArrayBuffer)=>{
  const bytes=new Uint8Array(buffer);let binary="";const chunk=0x8000;
  for(let index=0;index<bytes.length;index+=chunk)binary+=String.fromCharCode(...bytes.subarray(index,index+chunk));
  return btoa(binary);
};

async function brandingAssets(env:UiV2Env){
  const listed=await env.ASSETS.list({prefix:"branding/"}),assets=[];
  for(const item of listed.objects){
    const object=await env.ASSETS.get(item.key);if(!object)continue;
    assets.push({key:item.key,size:item.size,contentType:object.httpMetadata?.contentType||"application/octet-stream",data:bytesToBase64(await object.arrayBuffer())});
  }
  return assets;
}

async function fullBackup(env:UiV2Env,context:UiV2Context){
  const data:Record<string,DataRow[]>={};
  for(const table of backupTables)data[table]=(await env.DB.prepare(`SELECT * FROM ${table}`).all<DataRow>()).results??[];
  const assets=await brandingAssets(env),exportedAt=new Date().toISOString();
  await audit(env,context,"backup.complete.downloaded",{format:"json",tables:backupTables.length,assets:assets.length,exportedAt});
  const payload={format:"alliance-platform-backup",formatVersion:1,exportedAt,alliance:context.alliance,security:{sessionsIncluded:false,installationActivationIncluded:false},data,assets};
  return download(JSON.stringify(payload,null,2),"application/json; charset=utf-8",`${slug(context.alliance.name)}-complete-backup-${timestamp()}.json`);
}

async function excelExport(env:UiV2Env,context:UiV2Context){
  const workbook=XLSX.utils.book_new();let rowCount=0;
  for(const [name,query] of reportSheets){const rows=(await env.DB.prepare(query).all<DataRow>()).results??[];rowCount+=rows.length;const sheet=XLSX.utils.json_to_sheet(rows);XLSX.utils.book_append_sheet(workbook,sheet,name.slice(0,31));}
  const contents=XLSX.write(workbook,{type:"array",bookType:"xlsx"}) as ArrayBuffer,exportedAt=new Date().toISOString();
  await audit(env,context,"backup.leadership_export.downloaded",{format:"xlsx",sheets:reportSheets.length,rows:rowCount,exportedAt});
  return download(contents,"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",`${slug(context.alliance.name)}-leadership-export-${timestamp()}.xlsx`);
}

async function rosterExport(env:UiV2Env,context:UiV2Context){
  const rows=(await env.DB.prepare(`SELECT p.id "Player ID",p.display_name "Player Name",'R'||p.rank "Rank",p.base_level "Base Level",p.player_power "Total Strength",(SELECT power FROM player_squads s WHERE s.player_id=p.id AND s.squad_number=1) "Squad 1 Power",p.total_hero_power "Total Hero Power" FROM players p WHERE p.is_active=1 ORDER BY p.display_name COLLATE NOCASE`).all<DataRow>()).results??[];
  const csv=XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows)),exportedAt=new Date().toISOString();
  await audit(env,context,"backup.roster_export.downloaded",{format:"csv",players:rows.length,exportedAt});
  return download(`\uFEFF${csv}`,"text/csv; charset=utf-8",`${slug(context.alliance.name)}-active-roster-${timestamp()}.csv`);
}

async function page(env:UiV2Env,context:UiV2Context){
  const [players,away,snapshots,last]=await Promise.all([
    env.DB.prepare("SELECT COUNT(*) total FROM players").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) total FROM player_away_periods").first<CountRow>(),
    env.DB.prepare("SELECT COUNT(*) total FROM player_roster_snapshots").first<CountRow>(),
    env.DB.prepare("SELECT occurred_at,action FROM audit_log WHERE action LIKE 'backup.%' ORDER BY occurred_at DESC,id DESC LIMIT 1").first<AuditRow>()
  ]);
  const lastExport=last?.occurred_at||"No exports yet";
  const body=`${css}<div class="backup-status"><div><span>Player records</span><strong>${Number(players?.total??0)}</strong></div><div><span>Away records</span><strong>${Number(away?.total??0)}</strong></div><div><span>Latest export</span><strong>${esc(lastExport)}</strong></div></div><div class="backup-grid">
    <article class="backup-card"><span class="label">Recovery</span><h2>Complete platform backup</h2><p>A portable JSON recovery file containing the platform data and uploaded branding artwork.</p><ul><li>Includes accounts, permissions and audit history</li><li>Includes ${Number(snapshots?.total??0)} performance snapshots</li><li>Never includes active login sessions</li></ul><form method="post" action="/ui-v2/backup/complete"><button class="backup-button" type="submit">Download complete backup</button></form></article>
    <article class="backup-card"><span class="label">Spreadsheet</span><h2>Leadership Excel export</h2><p>A readable workbook for offline review, reporting and safekeeping.</p><ul><li>Players and squad information</li><li>Away and rank history</li><li>Performance history in separate sheets</li></ul><form method="post" action="/ui-v2/backup/excel"><button class="backup-button" type="submit">Download Excel workbook</button></form></article>
    <article class="backup-card"><span class="label">Roster</span><h2>Active roster CSV</h2><p>A lightweight export using the same columns understood by the roster upload page.</p><ul><li>Active players only</li><li>Names, ranks, base and headline power</li><li>Ready to review or upload again</li></ul><form method="post" action="/ui-v2/backup/roster"><button class="backup-button" type="submit">Download roster CSV</button></form></article>
  </div><div class="backup-note"><strong>Restore is deliberately separate.</strong> A future restore tool will validate the file, show exactly what will change and require a second confirmation before altering live data. Keep complete backups somewhere secure because they contain private platform and account records.</div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Data",title:"Backup & Export",description:"Protect the alliance data and download useful working copies whenever you need them.",body,activePath:"/ui-v2/backup",back:{href:"/ui-v2/leadership",label:"Leadership Console"}}));
}

export async function handleUiV2Backup(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;if(!path.startsWith("/ui-v2/backup"))return null;
  if(!context.user.isOwner)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Data",title:"Backup & Export",description:"Only the platform Owner can download complete alliance data.",body:"",activePath:"/ui-v2/backup"}),403);
  if(path==="/ui-v2/backup"&&request.method==="GET")return page(env,context);
  if(request.method!=="POST"||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  if(path==="/ui-v2/backup/complete")return fullBackup(env,context);
  if(path==="/ui-v2/backup/excel")return excelExport(env,context);
  if(path==="/ui-v2/backup/roster")return rosterExport(env,context);
  return null;
}
