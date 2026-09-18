import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type Player={id:number;display_name:string;rank:number;base_level:number|null;player_power:number|null;total_hero_power:number|null;is_active:number;squad1:number|null};
type ExtractedRow={player_name:string;hero_power_text:string;confidence:"high"|"medium"|"low";notes:string};
type OpenAiResponse={output?:Array<{content?:Array<{type?:string;text?:string}>}>;error?:{message?:string}};

const css=`<style>.hp-card{padding:20px;border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2)}.hp-card p{color:var(--ui-muted);font-size:.77rem;line-height:1.55}.hp-field span{display:block;margin:12px 0 6px;color:var(--ui-secondary);font-size:.7rem;font-weight:850}.hp-field input,.hp-table input,.hp-table select{width:100%;padding:10px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.hp-table-wrap{overflow:auto;border:1px solid var(--ui-line);border-radius:13px}.hp-table{width:100%;min-width:760px;border-collapse:collapse}.hp-table th,.hp-table td{padding:10px;border-bottom:1px solid var(--ui-line);font-size:.71rem;text-align:left}.hp-table th{color:var(--ui-muted);font-size:.61rem;text-transform:uppercase}.hp-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:15px}.hp-button{display:inline-flex;align-items:center;justify-content:center;padding:10px 13px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.72rem;font-weight:900;text-decoration:none;cursor:pointer}.hp-button.secondary{border:1px solid var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.hp-notice{margin-bottom:14px;padding:12px 14px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-2);color:var(--ui-muted);font-size:.76rem}.hp-notice.bad{border-color:color-mix(in srgb,var(--ui-danger) 42%,var(--ui-line));color:var(--ui-danger)}.hp-confidence{font-weight:850;text-transform:capitalize}.hp-confidence.low{color:var(--ui-danger)}.hp-confidence.medium{color:var(--ui-warning)}@media(max-width:720px){.hp-actions{display:grid}.hp-button{width:100%}}</style>`;
const normalName=(value:string)=>value.trim().toLocaleLowerCase().replace(/\s+/g," ");
const power=(value:string)=>{const clean=value.trim().replaceAll(",","").replace(/\s+/g,"").toUpperCase(),match=clean.match(/^([0-9]+(?:\.[0-9]+)?)\s*([KMB])?$/);if(!match)return null;const factor=match[2]==="B"?1e9:match[2]==="M"?1e6:match[2]==="K"?1e3:1,result=Math.round(Number(match[1])*factor);return Number.isSafeInteger(result)&&result>=0?result:null};
const imageDataUrl=async(file:File)=>{const bytes=new Uint8Array(await file.arrayBuffer());let binary="";for(let i=0;i<bytes.length;i+=0x8000)binary+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return `data:${file.type};base64,${btoa(binary)}`};

function uploadPage(context:UiV2Context,message=""){
  const body=`${css}${message}<section class="hp-card"><h2>Total Hero Power</h2><p>Upload the complete Hero Power ranking screenshots. Every extracted value is matched and reviewed before player records or history are changed.</p><form method="post" action="/ui-v2/import-centre/screenshots/hero-power/extract" enctype="multipart/form-data"><label class="hp-field"><span>Hero Power screenshots (up to 10)</span><input type="file" name="screenshots" accept="image/png,image/jpeg,image/webp" multiple required></label><div class="hp-actions"><button class="hp-button" type="submit">Read Hero Power screenshots</button><a class="hp-button secondary" href="/ui-v2/import-centre/screenshots">Back to Screenshot Import</a></div></form></section>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"AI-assisted data entry",title:"Total Hero Power Import",description:"Update Hero Power from game ranking screenshots.",body,activePath:"/ui-v2/import-centre/screenshots/hero-power",back:{href:"/ui-v2/import-centre/screenshots",label:"Screenshot Import"}}));
}

async function playersAndAliases(env:UiV2Env){
  const [playerRows,aliasRows]=await Promise.all([
    env.DB.prepare("SELECT p.id,p.display_name,p.rank,p.base_level,p.player_power,p.total_hero_power,p.is_active,(SELECT power FROM player_squads s WHERE s.player_id=p.id AND s.squad_number=1 LIMIT 1) squad1 FROM players p ORDER BY p.is_active DESC,p.display_name COLLATE NOCASE").all<Player>(),
    env.DB.prepare("SELECT alias_normalized,player_id FROM player_name_aliases").all<{alias_normalized:string;player_id:number}>()
  ]),players=playerRows.results??[],map=new Map(players.map(player=>[normalName(player.display_name),player.id]));
  for(const alias of aliasRows.results??[])map.set(alias.alias_normalized,alias.player_id);
  return{players,map};
}

async function extract(env:UiV2Env,files:File[]){
  if(!env.OPENAI_API_KEY)throw new Error("Screenshot importing is not configured yet.");
  if(!files.length||files.length>10)throw new Error("Choose between 1 and 10 screenshots.");
  let total=0;
  for(const file of files){total+=file.size;if(!["image/png","image/jpeg","image/webp"].includes(file.type))throw new Error("Use PNG, JPEG or WebP screenshots.");if(file.size>8*1024*1024)throw new Error(`${file.name} is larger than 8 MB.`)}
  if(total>24*1024*1024)throw new Error("The screenshots are larger than 24 MB in total.");
  const images=await Promise.all(files.map(async file=>({type:"input_image",image_url:await imageDataUrl(file),detail:"high"})));
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{authorization:`Bearer ${env.OPENAI_API_KEY}`,"content-type":"application/json"},body:JSON.stringify({model:env.OPENAI_VISION_MODEL||"gpt-4.1-mini",store:false,input:[{role:"user",content:[{type:"input_text",text:"Read these Last War Total Hero Power ranking screenshots. Extract every visible player name and Total Hero Power value. Preserve names exactly. Power may use commas or K/M/B suffixes. Never guess cropped or unreadable values. If screenshots overlap, return each player once using the clearest reading."},...images]}],text:{format:{type:"json_schema",name:"hero_power_screenshot_rows",strict:true,schema:{type:"object",additionalProperties:false,properties:{rows:{type:"array",items:{type:"object",additionalProperties:false,properties:{player_name:{type:"string"},hero_power_text:{type:"string"},confidence:{type:"string",enum:["high","medium","low"]},notes:{type:"string"}},required:["player_name","hero_power_text","confidence","notes"]}}},required:["rows"]}}}})});
  const result=await response.json() as OpenAiResponse;
  if(!response.ok)throw new Error(result.error?.message||"OpenAI could not read the Hero Power screenshots.");
  const text=result.output?.flatMap(item=>item.content??[]).find(item=>item.type==="output_text")?.text;
  if(!text)throw new Error("OpenAI returned no readable Hero Power rows.");
  let parsed:{rows:ExtractedRow[]};try{parsed=JSON.parse(text)}catch{throw new Error("OpenAI returned an invalid Hero Power result.")}
  if(!Array.isArray(parsed.rows)||!parsed.rows.length||parsed.rows.length>150)throw new Error("No usable Hero Power rows were found.");
  return parsed.rows;
}

async function extractionPreview(env:UiV2Env,context:UiV2Context,files:File[]){
  const [rows,lookup]=await Promise.all([extract(env,files),playersAndAliases(env)]);
  const table=rows.map((row,index)=>{const matched=lookup.map.get(normalName(row.player_name));return `<tr><td>${index+1}</td><td><label><input type="checkbox" name="include_${index}" value="1" checked> Include</label></td><td>${esc(row.player_name)}</td><td><select name="player_id_${index}"><option value="">Choose player…</option>${lookup.players.map(player=>`<option value="${player.id}"${player.id===matched?" selected":""}>${esc(player.display_name)}${player.is_active?"":" · Former"}</option>`).join("")}</select>${matched?"":'<div class="hp-confidence low">No automatic match</div>'}</td><td><input name="power_${index}" value="${esc(row.hero_power_text)}"></td><td><span class="hp-confidence ${row.confidence}">${esc(row.confidence)}</span>${row.notes?`<div>${esc(row.notes)}</div>`:""}</td></tr>`}).join("");
  const body=`${css}<div class="hp-notice">Check every match and value. Untick Include for departed players or unwanted rows. Nothing has been saved.</div><form method="post" action="/ui-v2/import-centre/screenshots/hero-power/validate"><input type="hidden" name="row_count" value="${rows.length}"><div class="hp-table-wrap"><table class="hp-table"><thead><tr><th>#</th><th>Use row</th><th>Read from image</th><th>Matched player</th><th>Total Hero Power</th><th>Confidence</th></tr></thead><tbody>${table}</tbody></table></div><div class="hp-actions"><a class="hp-button secondary" href="/ui-v2/import-centre/screenshots/hero-power">Cancel</a><button class="hp-button" type="submit">Validate Hero Power</button></div></form>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"AI-assisted data entry",title:"Check Hero Power Results",description:`${rows.length} extracted rows · nothing has been saved`,body,activePath:"/ui-v2/import-centre/screenshots/hero-power",back:{href:"/ui-v2/import-centre/screenshots/hero-power",label:"Hero Power Import"}}));
}

async function validatedPreview(request:Request,env:UiV2Env,context:UiV2Context){
  const form=await request.formData(),count=Number(form.get("row_count"));
  if(!Number.isInteger(count)||count<1||count>150)return new Response("The Hero Power preview is no longer valid.",{status:400});
  const players=(await playersAndAliases(env)).players,byId=new Map(players.map(player=>[player.id,player])),seen=new Set<number>(),invalid:string[]=[],rows:Array<{playerId:number;name:string;rank:number;base:number|null;strength:number|null;squad1:number|null;heroPower:number}>=[];
  for(let index=0;index<count;index++){
    if(form.get(`include_${index}`)!=="1")continue;
    const playerId=Number(form.get(`player_id_${index}`)),player=byId.get(playerId),heroPower=power(String(form.get(`power_${index}`)||""));
    if(!player){invalid.push(`Row ${index+1}: choose a player or untick Include.`);continue}
    if(seen.has(playerId)){invalid.push(`Row ${index+1}: ${player.display_name} appears more than once.`);continue}
    seen.add(playerId);
    if(heroPower===null){invalid.push(`Row ${index+1}: enter a valid Hero Power value.`);continue}
    rows.push({playerId,name:player.display_name,rank:player.rank,base:player.base_level,strength:player.player_power,squad1:player.squad1,heroPower});
  }
  if(invalid.length){const body=`${css}<div class="hp-notice bad">${invalid.map(esc).join("<br>")}</div><div class="hp-actions"><a class="hp-button" href="/ui-v2/import-centre/screenshots/hero-power">Upload screenshots again</a></div>`;return uiV2Html(renderUiV2Shell(context,{eyebrow:"AI-assisted data entry",title:"Hero Power Validation",description:"Nothing has been saved.",body,activePath:"/ui-v2/import-centre/screenshots/hero-power"}),400)}
  const payload=esc(JSON.stringify(rows)),table=rows.map((row,index)=>`<tr><td>${index+1}</td><td>${esc(row.name)}</td><td>${row.heroPower.toLocaleString("en-GB")}</td></tr>`).join(""),body=`${css}<div class="hp-notice">${rows.length} Hero Power updates are ready. Confirming uses the normal protected player update and records dated history snapshots.</div><div class="hp-table-wrap"><table class="hp-table"><thead><tr><th>#</th><th>Player</th><th>Total Hero Power</th></tr></thead><tbody>${table}</tbody></table></div><div class="hp-actions"><a class="hp-button secondary" href="/ui-v2/import-centre/screenshots/hero-power">Cancel</a>${rows.length?`<form method="post" action="/ui-v2/players/import/commit"><textarea name="payload" hidden>${payload}</textarea><button class="hp-button" type="submit">Apply ${rows.length} Hero Power updates</button></form>`:""}</div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"AI-assisted data entry",title:"Confirm Hero Power Import",description:"Final review before updating player records.",body,activePath:"/ui-v2/import-centre/screenshots/hero-power",back:{href:"/ui-v2/import-centre/screenshots/hero-power",label:"Hero Power Import"}}));
}

export async function handleUiV2HeroPowerScreenshot(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(!path.startsWith("/ui-v2/import-centre/screenshots/hero-power"))return null;
  if(!context.user.isOwner)return new Response("Forbidden",{status:403});
  if(path==="/ui-v2/import-centre/screenshots/hero-power"&&request.method==="GET")return uploadPage(context,!env.OPENAI_API_KEY?'<div class="hp-notice bad">Screenshot reading needs an OpenAI API key.</div>':"");
  if(path==="/ui-v2/import-centre/screenshots/hero-power/extract"&&request.method==="POST"){
    if(!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
    const form=await request.formData(),files=form.getAll("screenshots").filter((item):item is File=>item instanceof File&&item.size>0);
    try{return await extractionPreview(env,context,files)}catch(error){return uploadPage(context,`<div class="hp-notice bad">${esc(error instanceof Error?error.message:"The screenshots could not be read.")}</div>`)}
  }
  if(path==="/ui-v2/import-centre/screenshots/hero-power/validate"&&request.method==="POST"){
    if(!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
    return validatedPreview(request,env,context);
  }
  return new Response("Not found",{status:404});
}
