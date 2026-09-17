import * as XLSX from "xlsx";
import {playerSameOrigin} from "../player_access";
import {getPlayerMaxBaseLevel} from "../player_profile_fields";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type RankRow={rank_level:number;display_name:string};
type ExistingPlayer={id:number;display_name:string;rank:number;base_level:number|null;player_power:number|null;total_hero_power:number|null;is_active:number;squad1:number|null};
type ImportAction="add"|"update"|"reactivate"|"unchanged";
type ImportRow={playerId:number|null;name:string;rank:number;base:number|null;strength:number|null;squad1:number|null;heroPower:number|null;action:ImportAction;errors:string[]};
type ImportPayload=Omit<ImportRow,"action"|"errors">;

const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const normalName=(value:string)=>value.trim().toLowerCase();
const normalHeader=(value:string)=>value.trim().toLowerCase().replace(/[_-]+/g," ").replace(/\s+/g," ");
const cell=(row:Record<string,unknown>,aliases:string[])=>{const wanted=new Set(aliases.map(normalHeader));for(const [key,value] of Object.entries(row))if(wanted.has(normalHeader(key)))return value;return ""};
const hasValue=(value:unknown)=>value!==null&&value!==undefined&&String(value).trim()!=="";
const parsePower=(value:unknown)=>{if(!hasValue(value))return null;if(typeof value==="number")return Number.isFinite(value)&&value>=0?Math.round(value):NaN;const text=String(value).trim().replaceAll(",","").replace(/\s+/g,"");const match=text.match(/^([0-9]+(?:\.[0-9]+)?)([KMB])?$/i);if(!match)return NaN;const multiplier=!match[2]?1:match[2].toUpperCase()==="K"?1e3:match[2].toUpperCase()==="M"?1e6:1e9;return Math.round(Number(match[1])*multiplier)};
const parseRank=(value:unknown,ranks:RankRow[],fallback:number)=>{if(!hasValue(value))return fallback;const text=String(value).trim(),match=text.match(/^R?([1-5])$/i);if(match)return Number(match[1]);return ranks.find(rank=>rank.display_name.trim().toLowerCase()===text.toLowerCase())?.rank_level??NaN};
const playerChanged=(player:ExistingPlayer,row:Pick<ImportRow,"name"|"rank"|"base"|"strength"|"squad1"|"heroPower">)=>player.display_name.trim()!==row.name.trim()||player.rank!==row.rank||player.base_level!==row.base||player.player_power!==row.strength||player.squad1!==row.squad1||player.total_hero_power!==row.heroPower;
const actionLabel=(action:ImportAction)=>action==="add"?"Add":action==="update"?"Update":action==="reactivate"?"Reactivate":"No change";

const importCss=`<style>
.import-return{margin-bottom:18px}.import-notice{margin-bottom:17px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-danger) 48%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger);font-size:.8rem;font-weight:800}.import-notice.good{border-color:color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success)}.import-card{padding:21px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.import-card h2{margin:0 0 6px;font-size:1.05rem}.import-card p{margin:0;color:var(--ui-muted);font-size:.8rem;line-height:1.5}.file-field{display:block;margin-top:18px}.file-field span{display:block;margin-bottom:7px;color:var(--ui-secondary);font-size:.75rem;font-weight:850}.file-field input{width:100%;padding:11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.import-hint{margin-top:9px;color:var(--ui-muted);font-size:.69rem;line-height:1.5}.import-actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}.import-button{display:inline-flex;align-items:center;justify-content:center;padding:11px 14px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:900;text-decoration:none;cursor:pointer;transition:border-color .15s ease,color .15s ease,background .15s ease,box-shadow .15s ease}.import-button.secondary{border:1px solid var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.import-button.secondary:hover{border-color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 9%,var(--ui-surface-3));color:var(--ui-hover);box-shadow:0 0 16px color-mix(in srgb,var(--ui-hover) 10%,transparent)}.import-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-bottom:15px}.import-summary div{padding:12px 14px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-2)}.import-summary span,.import-summary strong{display:block}.import-summary span{color:var(--ui-muted);font-size:.64rem;font-weight:900;text-transform:uppercase;letter-spacing:.06em}.import-summary strong{margin-top:4px}.table-wrap{overflow:auto;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.import-table{width:100%;min-width:880px;border-collapse:collapse}.import-table th,.import-table td{padding:10px 11px;border-bottom:1px solid var(--ui-line);font-size:.73rem;text-align:left;white-space:nowrap}.import-table th{color:var(--ui-muted);font-size:.64rem;text-transform:uppercase;letter-spacing:.05em}.import-table tr:last-child td{border-bottom:0}.row-status{font-weight:900}.row-status.add{color:var(--ui-success)}.row-status.update{color:var(--ui-secondary)}.row-status.reactivate{color:var(--ui-warning)}.row-status.unchanged{color:var(--ui-muted)}.row-error{color:var(--ui-danger);white-space:normal!important;min-width:220px}.payload-form{margin:0}@media(max-width:700px){.import-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.import-actions{display:grid;grid-template-columns:1fr}.import-button{width:100%}.import-return{width:auto}}
</style>`;

const loadExisting=async(env:UiV2Env)=>(await env.DB.prepare("SELECT p.id,p.display_name,p.rank,p.base_level,p.player_power,p.total_hero_power,p.is_active,(SELECT power FROM player_squads s WHERE s.player_id=p.id AND s.squad_number=1 LIMIT 1) squad1 FROM players p ORDER BY p.id").all<ExistingPlayer>()).results??[];
const chooseExisting=(id:number|null,name:string,players:ExistingPlayer[])=>{if(id!==null)return players.find(player=>player.id===id)||null;const matches=players.filter(player=>normalName(player.display_name)===normalName(name)),active=matches.find(player=>player.is_active===1);if(active)return active;return matches.length===1?matches[0]:null};

async function parseSpreadsheet(env:UiV2Env,context:UiV2Context,file:File):Promise<ImportRow[]>{
  if(file.size>5*1024*1024)throw new Error("The spreadsheet is larger than 5 MB.");
  if(!/\.(xlsx|csv)$/i.test(file.name))throw new Error("Use an .xlsx or .csv file.");
  const workbook=XLSX.read(await file.arrayBuffer(),{type:"array"}),sheet=workbook.Sheets[workbook.SheetNames[0]];
  if(!sheet)throw new Error("The spreadsheet has no readable worksheet.");
  const raw=XLSX.utils.sheet_to_json<Record<string,unknown>>(sheet,{defval:""});
  if(!raw.length)throw new Error("The spreadsheet contains no player rows.");
  if(raw.length>150)throw new Error("Import a maximum of 150 players at a time.");
  const [maxBase,ranks,existing]=await Promise.all([getPlayerMaxBaseLevel(env),env.DB.prepare("SELECT rank_level,display_name FROM alliance_ranks ORDER BY rank_level").all<RankRow>(),loadExisting(env)]),rankRows=ranks.results??[];
  const seenNames=new Set<string>(),seenIds=new Set<number>();
  return raw.map(source=>{
    const errors:string[]=[],idValue=cell(source,["player id","id"]),id=hasValue(idValue)?Number(idValue):null,name=String(cell(source,["player name","name","player"])).trim();
    if(id!==null&&(!Number.isInteger(id)||id<1))errors.push("Player ID is invalid");
    if(!name)errors.push("Player Name is required");
    if(name.length>80)errors.push("Player Name is too long");
    const sameName=existing.filter(player=>normalName(player.display_name)===normalName(name)),matched=id!==null?existing.find(player=>player.id===id)||null:chooseExisting(null,name,existing);
    if(id!==null&&!matched)errors.push("Player ID was not found");
    if(id===null&&sameName.length>1&&!sameName.some(player=>player.is_active===1))errors.push("Multiple former players use this name; add Player ID");
    if(matched&&existing.some(player=>player.id!==matched.id&&player.is_active===1&&normalName(player.display_name)===normalName(name)))errors.push("Another active player already uses this name");
    const rank=parseRank(cell(source,["rank","alliance rank","r rank"]),rankRows,matched?.rank??1),baseValue=cell(source,["base level","base","base size","hq level","headquarters level"]),base=hasValue(baseValue)?Number(baseValue):matched?.base_level??null,strengthValue=cell(source,["strength","total strength","player power","total power","power","overall power"]),strength=hasValue(strengthValue)?parsePower(strengthValue):matched?.player_power??null,squadValue=cell(source,["squad 1 power","squad1 power","squad 1 strength","squad1 strength","squad 1"]),squad1=hasValue(squadValue)?parsePower(squadValue):matched?.squad1??null,heroValue=cell(source,["total hero power","hero power","heroes power"]),heroPower=hasValue(heroValue)?parsePower(heroValue):matched?.total_hero_power??null;
    if(!Number.isInteger(rank)||rank<1||rank>5)errors.push("Rank must be R1–R5");
    if(base!==null&&(!Number.isInteger(base)||base<1||base>maxBase))errors.push(`Base Level must be 1–${maxBase}`);
    if(strength!==null&&(!Number.isInteger(strength)||strength<0))errors.push("Strength is invalid");
    if(squad1!==null&&(!Number.isInteger(squad1)||squad1<0))errors.push("Squad 1 Power is invalid");
    if(heroPower!==null&&(!Number.isInteger(heroPower)||heroPower<0))errors.push("Total Hero Power is invalid");
    if((rank===5||matched?.rank===5)&&rank!==matched?.rank&&!context.user.canManageProtectedRank)errors.push("Changing R5 requires protected-rank permission");
    const nameKey=normalName(name);
    if(name&&seenNames.has(nameKey))errors.push("Duplicate name in this spreadsheet");
    if(name)seenNames.add(nameKey);
    if(matched&&seenIds.has(matched.id))errors.push("This player appears more than once");
    if(matched)seenIds.add(matched.id);
    const next={name,rank:Number.isFinite(rank)?rank:1,base:Number.isFinite(base as number)?base:null,strength:Number.isFinite(strength as number)?strength:null,squad1:Number.isFinite(squad1 as number)?squad1:null,heroPower:Number.isFinite(heroPower as number)?heroPower:null};
    const action:ImportAction=!matched?"add":!matched.is_active?"reactivate":playerChanged(matched,next)?"update":"unchanged";
    return{playerId:matched?.id??id,name:next.name,rank:next.rank,base:next.base,strength:next.strength,squad1:next.squad1,heroPower:next.heroPower,action,errors};
  });
}

function uploadPage(context:UiV2Context,message=""){
  const body=`${importCss}<a class="import-button secondary import-return" href="/ui-v2/players">← Players</a>${message?`<div class="import-notice">${esc(message)}</div>`:""}<section class="import-card"><h2>Roster spreadsheet</h2><p>Upload the current roster to add new players and update existing records. Each upload also creates a dated performance snapshot for weekly history.</p><form method="post" action="/ui-v2/players/import/preview" enctype="multipart/form-data"><label class="file-field"><span>Excel or CSV file</span><input type="file" name="file" accept=".xlsx,.csv" required></label><div class="import-hint">Recognised columns: Player ID (optional), Player Name, Rank, Base Level, Total Strength, Squad 1 Power and Total Hero Power. Blank data cells retain existing values when a player is matched.</div><div class="import-actions"><a class="import-button secondary" href="/ui-v2/players/import/template.csv">Download template</a><button class="import-button" type="submit">Preview roster update</button></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Upload Excel Roster",description:"Update the alliance roster in bulk without entering every player by hand.",body,activePath:"/ui-v2/players"}));
}

function previewPage(context:UiV2Context,rows:ImportRow[]){
  const bad=rows.some(row=>row.errors.length),counts={add:0,update:0,reactivate:0,unchanged:0};for(const row of rows)counts[row.action]++;
  const table=rows.map((row,index)=>`<tr><td>${index+1}</td><td>${row.playerId??"—"}</td><td>${esc(row.name||"—")}</td><td>R${row.rank}</td><td>${row.base??"—"}</td><td>${row.strength??"—"}</td><td>${row.squad1??"—"}</td><td>${row.heroPower??"—"}</td><td><span class="row-status ${row.action}">${actionLabel(row.action)}</span></td><td class="${row.errors.length?"row-error":""}">${row.errors.length?esc(row.errors.join("; ")):"Ready"}</td></tr>`).join("");
  const payload=esc(JSON.stringify(rows.map(({action,errors,...row})=>row)));
  const body=`${importCss}<a class="import-button secondary import-return" href="/ui-v2/players/import">← Choose another file</a><div class="import-notice ${bad?"":"good"}">${bad?"Nothing has been saved. Correct the highlighted spreadsheet rows and upload again.":`${rows.length} rows validated and ready. A weekly snapshot will be recorded for every row.`}</div><div class="import-summary"><div><span>Add</span><strong>${counts.add}</strong></div><div><span>Update</span><strong>${counts.update}</strong></div><div><span>Reactivate</span><strong>${counts.reactivate}</strong></div><div><span>No change</span><strong>${counts.unchanged}</strong></div></div><div class="table-wrap"><table class="import-table"><thead><tr><th>#</th><th>Player ID</th><th>Player</th><th>Rank</th><th>Base</th><th>Total Strength</th><th>Squad 1</th><th>Hero Power</th><th>Action</th><th>Validation</th></tr></thead><tbody>${table}</tbody></table></div><div class="import-actions"><a class="import-button secondary" href="/ui-v2/players/import">Cancel</a>${bad?"":`<form class="payload-form" method="post" action="/ui-v2/players/import/commit"><textarea name="payload" hidden>${payload}</textarea><button class="import-button" type="submit">Apply roster update</button></form>`}</div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Roster Preview",description:"Review every proposed change before updating player records.",body,activePath:"/ui-v2/players"}));
}

const audit=(env:UiV2Env,context:UiV2Context,action:string,id:string,oldValues:unknown,newValues:unknown)=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,"player",id,"ui-v2-player-import",oldValues===null?null:JSON.stringify(oldValues),JSON.stringify(newValues));

async function commitImport(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageMembership||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData();let rows:ImportPayload[];
  try{rows=JSON.parse(String(form.get("payload")||"[]"))}catch{return uploadPage(context,"The preview data was invalid. Upload the spreadsheet again.")}
  if(!Array.isArray(rows)||!rows.length||rows.length>150)return uploadPage(context,"The preview data was invalid. Upload the spreadsheet again.");
  const [maxBase,existing]=await Promise.all([getPlayerMaxBaseLevel(env),loadExisting(env)]),seenNames=new Set<string>(),seenIds=new Set<number>();
  let prepared:Array<ImportPayload&{matched:ExistingPlayer|null}>;
  try{prepared=rows.map(raw=>{const playerId=raw.playerId===null?null:Number(raw.playerId),name=String(raw.name||"").trim(),rank=Number(raw.rank),base=raw.base===null?null:Number(raw.base),strength=raw.strength===null?null:Number(raw.strength),squad1=raw.squad1===null?null:Number(raw.squad1),heroPower=raw.heroPower===null?null:Number(raw.heroPower),matched=chooseExisting(Number.isInteger(playerId)?playerId:null,name,existing),key=normalName(name),conflict=matched&&existing.some(player=>player.id!==matched.id&&player.is_active===1&&normalName(player.display_name)===key);if(!name||name.length>80||seenNames.has(key)||!Number.isInteger(rank)||rank<1||rank>5||base!==null&&(!Number.isInteger(base)||base<1||base>maxBase)||strength!==null&&(!Number.isInteger(strength)||strength<0)||squad1!==null&&(!Number.isInteger(squad1)||squad1<0)||heroPower!==null&&(!Number.isInteger(heroPower)||heroPower<0)||playerId!==null&&!matched||matched&&seenIds.has(matched.id)||conflict||(rank===5||matched?.rank===5)&&rank!==matched?.rank&&!context.user.canManageProtectedRank)throw new Error(name||"Invalid row");seenNames.add(key);if(matched)seenIds.add(matched.id);return{playerId,name,rank,base,strength,squad1,heroPower,matched}})}catch{return uploadPage(context,"The preview data no longer matches the roster. Upload the spreadsheet again.")}
  let added=0,updated=0,reactivated=0,unchanged=0;
  try{
    for(const row of prepared){
      const values={display_name:row.name,rank:row.rank,base_level:row.base,player_power:row.strength,squad_1_power:row.squad1,total_hero_power:row.heroPower};
      if(!row.matched){
        const inserted=await env.DB.prepare("INSERT INTO players (display_name,rank,base_level,player_power,total_hero_power,is_active) VALUES (?,?,?,?,?,1) RETURNING id").bind(row.name,row.rank,row.base,row.strength,row.heroPower).first<{id:number}>();if(!inserted?.id)throw new Error("Player insert failed");
        const statements=[env.DB.prepare("INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note) VALUES (?,NULL,?,?,?)").bind(inserted.id,row.rank,context.user.accountId,"Player imported"),env.DB.prepare("INSERT INTO player_roster_snapshots (player_id,total_strength,squad_1_power,total_hero_power,recorded_by_account_id) VALUES (?,?,?,?,?)").bind(inserted.id,row.strength,row.squad1,row.heroPower,context.user.accountId),audit(env,context,"player.imported",String(inserted.id),null,values)];
        if(row.squad1!==null)statements.splice(1,0,env.DB.prepare("INSERT INTO player_squads (player_id,squad_number,power) VALUES (?,1,?) ON CONFLICT(player_id,squad_number) DO UPDATE SET power=excluded.power,updated_at=CURRENT_TIMESTAMP").bind(inserted.id,row.squad1));
        await env.DB.batch(statements);added++;continue;
      }
      const player=row.matched,changed=playerChanged(player,row);
      const snapshot=env.DB.prepare("INSERT INTO player_roster_snapshots (player_id,total_strength,squad_1_power,total_hero_power,recorded_by_account_id) VALUES (?,?,?,?,?)").bind(player.id,row.strength,row.squad1,row.heroPower,context.user.accountId);
      if(!changed&&player.is_active){await snapshot.run();unchanged++;continue;}
      const statements=[env.DB.prepare("UPDATE players SET display_name=?,rank=?,base_level=?,player_power=?,total_hero_power=?,is_active=1,left_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.name,row.rank,row.base,row.strength,row.heroPower,player.id),snapshot,audit(env,context,player.is_active?"player.import.updated":"player.import.reactivated",String(player.id),{display_name:player.display_name,rank:player.rank,base_level:player.base_level,player_power:player.player_power,total_hero_power:player.total_hero_power,is_active:player.is_active,squad_1_power:player.squad1},values)];
      if(player.rank!==row.rank)statements.splice(1,0,env.DB.prepare("INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note) VALUES (?,?,?,?,?)").bind(player.id,player.rank,row.rank,context.user.accountId,"Rank updated by roster import"));
      if(row.squad1!==null)statements.splice(1,0,env.DB.prepare("INSERT INTO player_squads (player_id,squad_number,power) VALUES (?,1,?) ON CONFLICT(player_id,squad_number) DO UPDATE SET power=excluded.power,updated_at=CURRENT_TIMESTAMP").bind(player.id,row.squad1));
      await env.DB.batch(statements);if(player.is_active)updated++;else reactivated++;
    }
    await audit(env,context,"players.bulk_imported","bulk",null,{added,updated,reactivated,unchanged,total:rows.length}).run();
    return redirect(request,`/ui-v2/players?added=${added}&updated=${updated}&reactivated=${reactivated}&unchanged=${unchanged}`);
  }catch{return uploadPage(context,"The roster changed after preview or a row could not be saved. No further rows were processed.")}
}

export async function handleUiV2PlayerImport(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith("/ui-v2/players/import"))return null;
  if(!context.user.canManageMembership)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Players",title:"Upload Excel Roster",description:"You do not have permission to update the roster.",body:"",activePath:"/ui-v2/players"}),403);
  if(path==="/ui-v2/players/import"&&request.method==="GET")return uploadPage(context);
  if(path==="/ui-v2/players/import/template.csv"&&request.method==="GET")return new Response("Player ID,Player Name,Rank,Base Level,Total Strength,Squad 1 Power,Total Hero Power\n,Example Player,R1,35,120000000,42000000,28000000\n",{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=player-roster-template.csv","cache-control":"no-store"}});
  if(path==="/ui-v2/players/import/preview"&&request.method==="POST"){
    if(!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
    const form=await request.formData(),file=form.get("file");if(!(file instanceof File)||file.size===0)return uploadPage(context,"Choose an Excel or CSV file first.");
    try{return previewPage(context,await parseSpreadsheet(env,context,file))}catch(error){return uploadPage(context,error instanceof Error?error.message:"The spreadsheet could not be read.")}
  }
  if(path==="/ui-v2/players/import/commit"&&request.method==="POST")return commitImport(request,env,context);
  return new Response("Not found",{status:404});
}
