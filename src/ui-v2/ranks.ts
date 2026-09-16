import {playerSameOrigin} from "../player_access";
import type {UiV2Context,UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";
import {validThemeColour} from "./theme";

type RankRow={rank_level:number;display_name:string;image_path:string|null;colour:string;player_count:number};
type StoredRank={rank_level:number;display_name:string;image_path:string|null;colour:string};

const assetUrl=(key:string)=>`/assets/${encodeURIComponent(key)}`;
const rankKey=(rank:number)=>`ranks/r${rank}`;
const validRank=(value:string)=>/^[1-5]$/.test(value);

const audit=async(env:UiV2Env,context:UiV2Context,action:string,rank:number|string,oldValues:unknown,newValues:unknown)=>env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,"alliance_rank",String(rank),"ui-v2-ranks",JSON.stringify(oldValues),JSON.stringify(newValues)).run();

const ranksCss=`<style>
.rank-notice{margin-bottom:18px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 45%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 9%,var(--ui-surface-2));color:var(--ui-success);font-size:.82rem;font-weight:800}.rank-notice.error{border-color:color-mix(in srgb,var(--ui-danger) 45%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 9%,var(--ui-surface-2));color:var(--ui-danger)}.display-card{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:18px;padding:17px 18px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-2)}.display-card h2{margin:0;font-size:1rem}.display-card p{margin:5px 0 0;color:var(--ui-muted);font-size:.78rem}.display-form{display:flex;align-items:center;gap:10px}.display-form label{display:flex;align-items:center;gap:8px;color:var(--ui-secondary);font-size:.78rem;font-weight:850}.display-form input{width:18px;height:18px;accent-color:var(--ui-button)}.rank-button{padding:10px 12px;border:0;border-radius:9px;background:var(--ui-button);color:var(--ui-button-text);font-size:.75rem;font-weight:900;cursor:pointer}.rank-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:11px}.rank-card{padding:15px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-2)}.rank-preview{height:108px;display:grid;place-items:center;border:1px dashed var(--ui-line-strong);border-radius:11px;background:var(--ui-surface-3);overflow:hidden}.rank-preview img{display:block;max-width:90%;max-height:94px;object-fit:contain}.rank-fallback{color:var(--rank-colour);font-size:1.25rem;font-weight:950}.rank-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:13px 0 10px}.rank-card-head strong{font-size:1.05rem;color:var(--rank-colour)}.rank-card-head span{color:var(--ui-muted);font-size:.67rem}.rank-field{display:block;margin-top:9px}.rank-field>span{display:block;margin-bottom:5px;color:var(--ui-muted);font-size:.68rem;font-weight:850}.rank-field input[type=text],.rank-field input[type=file]{width:100%;padding:9px;border:1px solid var(--ui-line-strong);border-radius:8px;background:var(--ui-surface-3);color:var(--ui-text);font-size:.75rem}.rank-colour-field{display:grid;grid-template-columns:42px 1fr;gap:8px;align-items:center}.rank-colour-field input[type=color]{width:42px;height:36px;padding:2px;border:1px solid var(--ui-line-strong);border-radius:8px;background:var(--ui-surface-3);cursor:pointer}.rank-colour-value{padding:9px;border:1px solid var(--ui-line);border-radius:8px;color:var(--rank-colour);font-size:.7rem;font-weight:900}.rank-actions{display:flex;justify-content:flex-end;margin-top:15px}.rank-save{min-width:220px}.remove-art{width:100%;margin-top:7px;padding:8px;border:1px solid color-mix(in srgb,var(--ui-danger) 50%,var(--ui-line));border-radius:8px;background:color-mix(in srgb,var(--ui-danger) 10%,var(--ui-surface-3));color:var(--ui-danger);font-size:.7rem;font-weight:850;cursor:pointer}.rank-hint{margin:10px 0 0;color:var(--ui-muted);font-size:.68rem;line-height:1.45}@media(max-width:1050px){.rank-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:750px){.rank-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.display-card{display:block}.display-form{margin-top:13px}}@media(max-width:520px){.rank-grid{grid-template-columns:1fr}.rank-save{width:100%}}
</style>`;

function rankCards(ranks:RankRow[]){
  return ranks.map(rank=>`<article class="rank-card" style="--rank-colour:${rank.colour}" data-rank-card><div class="rank-preview">${rank.image_path?`<img src="${assetUrl(rank.image_path)}" alt="R${rank.rank_level} artwork">`:`<span class="rank-fallback">R${rank.rank_level}</span>`}</div><div class="rank-card-head"><strong>R${rank.rank_level}</strong><span>${rank.player_count} ${rank.player_count===1?"player":"players"}</span></div><label class="rank-field"><span>Rank name</span><input type="text" name="display_name_${rank.rank_level}" maxlength="40" required value="${esc(rank.display_name)}"></label><label class="rank-field"><span>Rank colour</span><div class="rank-colour-field"><input type="color" name="colour_${rank.rank_level}" value="${rank.colour}" data-rank-colour><span class="rank-colour-value" data-rank-colour-value>${rank.colour.toUpperCase()}</span></div></label><label class="rank-field"><span>${rank.image_path?"Replace artwork":"Rank artwork"}</span><input type="file" name="asset_${rank.rank_level}" accept="image/png,image/jpeg,image/webp"></label><p class="rank-hint">PNG, JPG or WebP · Maximum 5 MB</p>${rank.image_path?`<button class="remove-art" type="submit" name="action" value="remove_artwork:${rank.rank_level}" formnovalidate onclick="return confirm('Remove this rank artwork?');">Remove artwork</button>`:""}</article>`).join("");
}

const ranksScript=`<script>(()=>{document.querySelectorAll('[data-rank-colour]').forEach(input=>input.addEventListener('input',()=>{const card=input.closest('[data-rank-card]');card?.style.setProperty('--rank-colour',input.value);const value=card?.querySelector('[data-rank-colour-value]');if(value)value.textContent=input.value.toUpperCase()}));})();</script>`;

async function page(env:UiV2Env,context:UiV2Context,url:URL){
  const [rankResult,displaySetting]=await Promise.all([
    env.DB.prepare("SELECT r.rank_level,r.display_name,r.image_path,r.colour,(SELECT COUNT(*) FROM players p WHERE p.rank=r.rank_level AND p.is_active=1) player_count FROM alliance_ranks r ORDER BY r.rank_level DESC").all<RankRow>(),
    env.DB.prepare("SELECT value FROM settings WHERE key='show_rank_names'").first<{value:string}>()
  ]);
  const saved=url.searchParams.get("saved"),error=url.searchParams.get("error");
  const notice=error?`<div class="rank-notice error">Rank settings could not be saved. Check every name, colour and image, then try again.</div>`:saved?`<div class="rank-notice">${saved==="display"?"Rank display setting saved.":saved==="artwork-removed"?"Rank artwork removed.":"All rank settings saved."}</div>`:"";
  const showNames=displaySetting?.value!=="0";
  const body=`${ranksCss}${notice}<section class="display-card"><div><h2>Player rank display</h2><p>Choose whether custom rank titles appear beside R1–R5 throughout the platform.</p></div><form class="display-form" method="post" action="/ui-v2/ranks"><input type="hidden" name="action" value="save_display"><label><input type="checkbox" name="show_rank_names" value="1"${showNames?" checked":""}> Show rank names</label><button class="rank-button" type="submit">Save display</button></form></section><form method="post" action="/ui-v2/ranks" enctype="multipart/form-data"><div class="rank-grid">${rankCards(rankResult.results??[])}</div><div class="rank-actions"><button class="rank-button rank-save" type="submit" name="action" value="save_all">Save all rank settings</button></div></form>${ranksScript}`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title:"Ranks",description:"Set each rank’s name, colour and artwork. These values follow the player everywhere the rank is shown.",body,activePath:"/ui-v2/ranks"}));
}

async function saveAll(form:FormData,env:UiV2Env,context:UiV2Context,request:Request){
  const current=await env.DB.prepare("SELECT rank_level,display_name,image_path,colour FROM alliance_ranks ORDER BY rank_level").all<StoredRank>();
  const existingRanks=current.results??[];
  if(existingRanks.length!==5)return Response.redirect(new URL("/ui-v2/ranks?error=rank",request.url),303);
  const next=existingRanks.map(item=>({...item,display_name:String(form.get(`display_name_${item.rank_level}`)||"").trim(),colour:String(form.get(`colour_${item.rank_level}`)||"").trim(),file:form.get(`asset_${item.rank_level}`)}));
  const invalid=next.some(item=>{
    if(!item.display_name||item.display_name.length>40||!validThemeColour(item.colour))return true;
    return item.file instanceof File&&item.file.size>0&&(item.file.size>5*1024*1024||!["image/png","image/jpeg","image/webp"].includes(item.file.type));
  });
  if(invalid)return Response.redirect(new URL("/ui-v2/ranks?error=rank",request.url),303);
  for(const item of next){
    if(item.file instanceof File&&item.file.size>0){
      item.image_path=rankKey(item.rank_level);
      await env.ASSETS.put(item.image_path,item.file.stream(),{httpMetadata:{contentType:item.file.type,cacheControl:"public, max-age=300"},customMetadata:{originalName:item.file.name.slice(0,180)}});
    }
  }
  const savedRanks=next.map(({file,...item})=>item);
  const statements=savedRanks.map(item=>env.DB.prepare("UPDATE alliance_ranks SET display_name=?,colour=?,image_path=?,updated_at=CURRENT_TIMESTAMP WHERE rank_level=?").bind(item.display_name,item.colour,item.image_path,item.rank_level));
  statements.push(env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values) VALUES (?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,"alliance.ranks.updated","alliance_rank","all","ui-v2-ranks",JSON.stringify(existingRanks),JSON.stringify(savedRanks)));
  await env.DB.batch(statements);
  return Response.redirect(new URL("/ui-v2/ranks?saved=all",request.url),303);
}

async function handlePost(request:Request,env:UiV2Env,context:UiV2Context){
  if(!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),action=String(form.get("action")||"");
  if(action==="save_display"){
    const show=form.get("show_rank_names")==="1"?"1":"0";
    await env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('show_rank_names',?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(show).run();
    await audit(env,context,"alliance.rank.display.updated","display",null,{show_rank_names:show==="1"});
    return Response.redirect(new URL("/ui-v2/ranks?saved=display",request.url),303);
  }
  if(action==="save_all")return saveAll(form,env,context,request);
  const removeMatch=/^remove_artwork:([1-5])$/.exec(action),rankText=removeMatch?.[1]||"";
  if(!validRank(rankText))return Response.redirect(new URL("/ui-v2/ranks?error=action",request.url),303);
  const rank=Number(rankText),existing=await env.DB.prepare("SELECT display_name,image_path,colour FROM alliance_ranks WHERE rank_level=?").bind(rank).first<{display_name:string;image_path:string|null;colour:string}>();
  if(!existing)return Response.redirect(new URL("/ui-v2/ranks?error=rank",request.url),303);
  if(existing.image_path)await env.ASSETS.delete(existing.image_path);
  await env.DB.prepare("UPDATE alliance_ranks SET image_path=NULL,updated_at=CURRENT_TIMESTAMP WHERE rank_level=?").bind(rank).run();
  await audit(env,context,"alliance.rank.artwork.removed",rank,existing,{...existing,image_path:null});
  return Response.redirect(new URL("/ui-v2/ranks?saved=artwork-removed",request.url),303);
}

export async function handleUiV2Ranks(request:Request,env:UiV2Env,context:UiV2Context){
  if(!context.user.canManageRanks)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title:"Ranks",description:"You do not have permission to manage ranks.",body:"",activePath:"/ui-v2/ranks"}),403);
  return request.method==="POST"?handlePost(request,env,context):page(env,context,new URL(request.url));
}
