export interface PlayerProfileEnv { DB:D1Database }

export type PlayerProfileInput={
  valid:boolean;
  name:string;
  rank:number;
  base:number|null;
  joined:string|null;
  left:string|null;
  birthdayMonth:number|null;
  birthdayDay:number|null;
};

export const getPlayerMaxBaseLevel=async(env:PlayerProfileEnv)=>{
  const row=await env.DB.prepare("SELECT value FROM settings WHERE key='player_max_base_level'").first<{value:string}>();
  const n=Number(row?.value??35);
  return Number.isInteger(n)&&n>=1&&n<=999?n:35;
};

export const getPlayerMaxOverlordLevel=async(env:PlayerProfileEnv)=>{
  const row=await env.DB.prepare("SELECT value FROM settings WHERE key='player_max_overlord_level'").first<{value:string}>();
  const n=Number(row?.value??6);
  return Number.isInteger(n)&&n>=1&&n<=999?n:6;
};

export const parsePlayerBirthday=(value:string)=>{
  const text=value.trim();
  const match=text.match(/^(\d{1,2})\/(\d{1,2})$/);
  if(!match)return{day:null,month:null,valid:text===""};
  const day=Number(match[1]),month=Number(match[2]);
  if(!Number.isInteger(day)||!Number.isInteger(month)||month<1||month>12||day<1||day>31)return{day:null,month:null,valid:false};
  const date=new Date(Date.UTC(2000,month-1,day));
  return{day,month,valid:date.getUTCMonth()===month-1&&date.getUTCDate()===day};
};

export const formatPlayerBirthday=(day:number|null|undefined,month:number|null|undefined)=>
  day&&month?`${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}`:"";

export const readPlayerProfileForm=async(request:Request,env:PlayerProfileEnv):Promise<PlayerProfileInput>=>{
  const form=await request.formData();
  const name=String(form.get("display_name")||"").trim();
  const rank=Number(form.get("rank")||1);
  const baseRaw=String(form.get("base_level")||"").trim();
  const joinedRaw=String(form.get("joined_at")||"").trim();
  const leftRaw=String(form.get("left_at")||"").trim();
  const birthdayRaw=String(form.get("birthday")||"").trim();
  const legacyMonth=String(form.get("birthday_month")||"").trim();
  const legacyDay=String(form.get("birthday_day")||"").trim();
  const max=await getPlayerMaxBaseLevel(env);
  const base=baseRaw?Number(baseRaw):null;
  const parsed=birthdayRaw!==""?parsePlayerBirthday(birthdayRaw):null;
  const birthdayMonth=parsed?parsed.month:(legacyMonth?Number(legacyMonth):null);
  const birthdayDay=parsed?parsed.day:(legacyDay?Number(legacyDay):null);
  const birthdayValid=parsed?parsed.valid:true;
  const valid=!!name&&name.length<=80&&Number.isInteger(rank)&&rank>=1&&rank<=5&&
    (base===null||(Number.isInteger(base)&&base>=1&&base<=max))&&birthdayValid&&
    (birthdayMonth===null||(Number.isInteger(birthdayMonth)&&birthdayMonth>=1&&birthdayMonth<=12))&&
    (birthdayDay===null||(Number.isInteger(birthdayDay)&&birthdayDay>=1&&birthdayDay<=31));
  return{valid,name,rank,base,joined:joinedRaw||null,left:leftRaw||null,birthdayMonth,birthdayDay};
};
