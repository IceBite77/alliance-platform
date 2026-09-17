import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";

type WeeklyEvent={day_of_week:number;event_name:string;event_time:string|null;note:string|null;enabled:number};

const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const redirect=(request:Request,path:string)=>Response.redirect(new URL(path,request.url),303);
const canManage=(context:UiV2Context)=>context.user.canManageAway||context.user.canManageVs||context.user.canManageDs||context.user.canManageSettings;
const londonWeekday=()=>{
  const day=new Intl.DateTimeFormat("en-GB",{timeZone:"Europe/London",weekday:"long"}).format(new Date());
  return Math.max(1,DAYS.indexOf(day)+1);
};

const eventCss=`<style>
.event-notice{margin-bottom:16px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.8rem;font-weight:850}.event-intro{margin-bottom:16px;padding:15px 17px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2);color:var(--ui-soft);font-size:.8rem;line-height:1.55}.event-week{display:grid;gap:10px}.event-day{padding:16px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface-2)}.event-day.today{border-color:color-mix(in srgb,var(--ui-accent) 52%,var(--ui-line));box-shadow:0 0 18px color-mix(in srgb,var(--ui-accent) 8%,transparent)}.event-day-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.event-day-name{display:flex;align-items:center;gap:9px;font-size:.9rem;font-weight:950}.today-badge{padding:4px 7px;border-radius:999px;background:color-mix(in srgb,var(--ui-accent) 12%,var(--ui-surface-3));color:var(--ui-accent);font-size:.56rem;font-weight:950;text-transform:uppercase}.event-enabled{display:flex;align-items:center;gap:7px;color:var(--ui-secondary);font-size:.68rem;font-weight:850}.event-enabled input{width:16px;height:16px;accent-color:var(--ui-button)}.event-fields{display:grid;grid-template-columns:minmax(220px,1.35fr) minmax(130px,.5fr) minmax(240px,1fr);gap:10px}.event-field{display:block;min-width:0}.event-field span{display:block;margin-bottom:6px;color:var(--ui-muted);font-size:.65rem;font-weight:850}.event-field input{width:100%;min-width:0;padding:10px 11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.event-save{display:flex;justify-content:flex-end;margin-top:14px}.event-save button{padding:11px 15px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.76rem;font-weight:950;cursor:pointer}@media(max-width:800px){.event-fields{grid-template-columns:1fr 1fr}.event-field.note{grid-column:1/-1}}@media(max-width:560px){.event-day-head{align-items:flex-start}.event-fields{grid-template-columns:1fr}.event-field.note{grid-column:auto}.event-save button{width:100%}}
</style>`;

async function rows(env:UiV2Env){
  const result=await env.DB.prepare("SELECT day_of_week,event_name,event_time,note,enabled FROM weekly_events ORDER BY day_of_week").all<WeeklyEvent>();
  return result.results??[];
}

function page(request:Request,context:UiV2Context,events:WeeklyEvent[]){
  if(!canManage(context))return uiV2Html(renderUiV2Shell(context,{eyebrow:"Alliance Operations",title:"Weekly Events",description:"You do not have permission to manage the weekly event schedule.",body:"",activePath:"/ui-v2/events"}),403);
  const byDay=new Map(events.map(event=>[event.day_of_week,event])),today=londonWeekday(),saved=new URL(request.url).searchParams.get("saved")==="1";
  const days=DAYS.map((name,index)=>{
    const number=index+1,event=byDay.get(number),isToday=number===today;
    return `<section class="event-day${isToday?" today":""}"><div class="event-day-head"><div class="event-day-name">${name}${isToday?'<span class="today-badge">Today</span>':""}</div><label class="event-enabled"><input type="checkbox" name="enabled_${number}" value="1"${event?.enabled?" checked":""}>Show on homepage</label></div><div class="event-fields"><label class="event-field"><span>Event</span><input name="event_name_${number}" maxlength="80" value="${esc(event?.event_name||"")}" placeholder="e.g. Zombie Siege"></label><label class="event-field"><span>Time</span><input name="event_time_${number}" maxlength="40" value="${esc(event?.event_time||"")}" placeholder="e.g. 20:00"></label><label class="event-field note"><span>Short note</span><input name="note_${number}" maxlength="140" value="${esc(event?.note||"")}" placeholder="Optional homepage note"></label></div></section>`;
  }).join("");
  const body=`${eventCss}${saved?'<div class="event-notice">Weekly event schedule saved. The homepage Event tile updates automatically.</div>':""}<div class="event-intro">This schedule repeats every week. Leave a day blank or switch off <strong>Show on homepage</strong> when nothing needs to appear.</div><form method="post" action="/ui-v2/events"><div class="event-week">${days}</div><div class="event-save"><button type="submit">Save weekly schedule</button></div></form>`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Alliance Operations",title:"Weekly Events",description:"Set the regular event shown for each day of the week.",body,activePath:"/ui-v2/events",back:{href:"/ui-v2/leadership",label:"Leadership Console"}}));
}

async function save(request:Request,env:UiV2Env,context:UiV2Context){
  if(!canManage(context)||!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),before=await rows(env),next:WeeklyEvent[]=[],statements:D1PreparedStatement[]=[];
  for(let day=1;day<=7;day++){
    const eventName=String(form.get(`event_name_${day}`)||"").trim().replace(/\s+/g," ").slice(0,80);
    const eventTime=String(form.get(`event_time_${day}`)||"").trim().replace(/\s+/g," ").slice(0,40)||null;
    const note=String(form.get(`note_${day}`)||"").trim().replace(/\s+/g," ").slice(0,140)||null;
    const enabled=eventName&&form.get(`enabled_${day}`)==="1"?1:0;
    next.push({day_of_week:day,event_name:eventName,event_time:eventTime,note,enabled});
    statements.push(env.DB.prepare("INSERT INTO weekly_events (day_of_week,event_name,event_time,note,enabled,updated_by_account_id,updated_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(day_of_week) DO UPDATE SET event_name=excluded.event_name,event_time=excluded.event_time,note=excluded.note,enabled=excluded.enabled,updated_by_account_id=excluded.updated_by_account_id,updated_at=CURRENT_TIMESTAMP").bind(day,eventName,eventTime,note,enabled,context.user.accountId));
  }
  statements.push(env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,"weekly_events.updated","weekly_events","schedule","ui-v2-events",JSON.stringify(before),JSON.stringify(next)));
  await env.DB.batch(statements);
  return redirect(request,"/ui-v2/events?saved=1");
}

export async function handleUiV2Events(request:Request,env:UiV2Env,context:UiV2Context):Promise<Response|null>{
  if(new URL(request.url).pathname!=="/ui-v2/events")return null;
  if(request.method==="GET")return page(request,context,await rows(env));
  if(request.method==="POST")return save(request,env,context);
  return new Response("Method not allowed",{status:405});
}
