import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type Player={id:number;display_name:string};
type TrainRow={schedule_date:string;driver_player_id:number;driver_name:string;vip_player_id:number|null;vip_name:string|null;updated_at:string};

const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const isoToday=()=>{
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/London",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const value=(type:string)=>parts.find(part=>part.type===type)?.value||"";
  return `${value("year")}-${value("month")}-${value("day")}`;
};
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(`${value}T12:00:00Z`));
const formatDate=(value:string)=>new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"short",day:"numeric",month:"short",year:"numeric"}).format(new Date(`${value}T12:00:00Z`));

const css=`<style>
.train-notice{margin-bottom:16px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.8rem;font-weight:850}.train-layout{display:grid;grid-template-columns:minmax(290px,.8fr) minmax(0,1.4fr);gap:15px}.train-card{padding:18px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-2)}.train-card h2{margin:0 0 5px;font-size:1rem}.train-card>p{margin:0 0 16px;color:var(--ui-muted);font-size:.78rem;line-height:1.5}.train-form{display:grid;gap:12px}.train-field span{display:block;margin-bottom:6px;color:var(--ui-muted);font-size:.68rem;font-weight:850}.train-field input,.train-field select{width:100%;padding:11px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.train-save{padding:11px 14px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.77rem;font-weight:950;cursor:pointer}.train-list{display:grid}.train-row{display:grid;grid-template-columns:145px minmax(0,1fr) minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--ui-line)}.train-row:first-child{border-top:0;padding-top:0}.train-row:last-child{padding-bottom:0}.train-date strong,.train-person strong,.train-person span{display:block}.train-date strong{font-size:.76rem}.train-date span{display:inline-flex;margin-top:5px;padding:4px 7px;border-radius:999px;background:color-mix(in srgb,var(--ui-accent) 11%,var(--ui-surface-3));color:var(--ui-accent);font-size:.57rem;font-weight:900;text-transform:uppercase}.train-person span{margin-bottom:3px;color:var(--ui-muted);font-size:.61rem;font-weight:850;text-transform:uppercase}.train-person strong{overflow:hidden;font-size:.76rem;text-overflow:ellipsis;white-space:nowrap}.train-delete{padding:7px 9px;border:1px solid color-mix(in srgb,var(--ui-danger) 45%,var(--ui-line));border-radius:8px;background:transparent;color:var(--ui-danger);font-size:.65rem;font-weight:900;cursor:pointer}.train-empty{padding:28px 12px;color:var(--ui-muted);font-size:.8rem;text-align:center}@media(max-width:850px){.train-layout{grid-template-columns:1fr}.train-row{grid-template-columns:130px minmax(0,1fr) minmax(0,1fr) auto}}@media(max-width:600px){.train-row{grid-template-columns:1fr 1fr}.train-date{grid-column:1/-1}.train-row form{justify-self:end}.train-person strong{white-space:normal}}
</style>`;

const loadPlayers=async(env:UiV2Env)=>(await env.DB.prepare("SELECT id,display_name FROM players WHERE is_active=1 ORDER BY display_name COLLATE NOCASE").all<Player>()).results??[];
const loadSchedule=async(env:UiV2Env)=>(await env.DB.prepare("SELECT t.schedule_date,t.driver_player_id,d.display_name driver_name,t.vip_player_id,v.display_name vip_name,t.updated_at FROM alliance_train_schedule t JOIN players d ON d.id=t.driver_player_id LEFT JOIN players v ON v.id=t.vip_player_id WHERE t.schedule_date>=date('now','-14 days') ORDER BY t.schedule_date ASC").all<TrainRow>()).results??[];

function page(request:Request,context:UiV2Context,players:Player[],schedule:TrainRow[]){
  if(!context.user.canManageTrain)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Alliance Operations",title:"Alliance Train",description:"You do not have permission to manage the Train schedule.",body:"",activePath:"/ui-v2/train"}),403);
  const url=new URL(request.url),saved=url.searchParams.get("saved")==="1",deleted=url.searchParams.get("deleted")==="1",today=isoToday();
  const options=players.map(player=>`<option value="${player.id}">${esc(player.display_name)}</option>`).join("");
  const rows=schedule.map(row=>`<div class="train-row"><div class="train-date"><strong>${esc(formatDate(row.schedule_date))}</strong>${row.schedule_date===today?"<span>Today</span>":""}</div><div class="train-person"><span>Driver</span><strong>${esc(row.driver_name)}</strong></div><div class="train-person"><span>VIP</span><strong>${esc(row.vip_name||"Not set")}</strong></div><form method="post" action="/ui-v2/train/delete" data-confirm="Remove this Train entry?" data-confirm-title="Remove Train entry" data-confirm-button="Remove"><input type="hidden" name="schedule_date" value="${row.schedule_date}"><button class="train-delete" type="submit">Remove</button></form></div>`).join("");
  const body=`${css}${saved?'<div class="train-notice">Train schedule saved. Today’s homepage card updates automatically.</div>':""}${deleted?'<div class="train-notice">Train entry removed.</div>':""}<div class="train-layout"><section class="train-card"><h2>Add or update a date</h2><p>Saving the same date again replaces its Driver and VIP.</p><form class="train-form" method="post" action="/ui-v2/train"><label class="train-field"><span>Date</span><input type="date" name="schedule_date" value="${today}" required></label><label class="train-field"><span>Driver</span><select name="driver_player_id" required><option value="">Choose driver…</option>${options}</select></label><label class="train-field"><span>VIP</span><select name="vip_player_id"><option value="">No VIP</option>${options}</select></label><button class="train-save" type="submit"${players.length?"":" disabled"}>Save Train entry</button></form></section><section class="train-card"><h2>Schedule</h2><p>Recent entries remain visible for reference; future dates can be planned in advance.</p><div class="train-list">${rows||'<div class="train-empty">No Train entries have been scheduled yet.</div>'}</div></section></div>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Alliance Operations",title:"Alliance Train",description:"Schedule the daily Driver and optional VIP.",body,activePath:"/ui-v2/train",back:{href:"/ui-v2/leadership",label:"Leadership Console"}}));
}

async function save(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageTrain||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),date=String(form.get("schedule_date")||""),driver=Number(form.get("driver_player_id")),vipRaw=String(form.get("vip_player_id")||""),vip=vipRaw?Number(vipRaw):null;
  if(!validDate(date)||!Number.isInteger(driver)||driver<1||(vip!==null&&(!Number.isInteger(vip)||vip<1)))return new Response("Invalid Train entry",{status:400});
  const ids=[driver,...(vip===null?[]:[vip])],found=(await env.DB.prepare(`SELECT id FROM players WHERE is_active=1 AND id IN (${ids.map(()=>"?").join(",")})`).bind(...ids).all<{id:number}>()).results??[];
  if(found.length!==new Set(ids).size)return new Response("Driver and VIP must be active players",{status:400});
  const before=await env.DB.prepare("SELECT schedule_date,driver_player_id,vip_player_id FROM alliance_train_schedule WHERE schedule_date=?").bind(date).first();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO alliance_train_schedule (schedule_date,driver_player_id,vip_player_id,updated_by_account_id,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(schedule_date) DO UPDATE SET driver_player_id=excluded.driver_player_id,vip_player_id=excluded.vip_player_id,updated_by_account_id=excluded.updated_by_account_id,updated_at=CURRENT_TIMESTAMP").bind(date,driver,vip,context.user.accountId),
    env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,"train.schedule.saved","alliance_train_schedule",date,"ui-v2-train",JSON.stringify(before),JSON.stringify({schedule_date:date,driver_player_id:driver,vip_player_id:vip}))
  ]);
  return redirect(request,"/ui-v2/train?saved=1");
}

async function remove(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageTrain||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const date=String((await request.formData()).get("schedule_date")||"");
  if(!validDate(date))return new Response("Invalid Train date",{status:400});
  const before=await env.DB.prepare("SELECT schedule_date,driver_player_id,vip_player_id FROM alliance_train_schedule WHERE schedule_date=?").bind(date).first();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM alliance_train_schedule WHERE schedule_date=?").bind(date),
    env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,"train.schedule.deleted","alliance_train_schedule",date,"ui-v2-train",JSON.stringify(before),null)
  ]);
  return redirect(request,"/ui-v2/train?deleted=1");
}

export async function handleUiV2Train(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  const path=new URL(request.url).pathname;
  if(path!=="/ui-v2/train"&&path!=="/ui-v2/train/delete")return null;
  if(request.method==="GET"&&path==="/ui-v2/train")return page(request,context,await loadPlayers(env),await loadSchedule(env));
  if(request.method==="POST"&&path==="/ui-v2/train")return save(request,env,context);
  if(request.method==="POST"&&path==="/ui-v2/train/delete")return remove(request,env,context);
  return new Response("Method not allowed",{status:405});
}
