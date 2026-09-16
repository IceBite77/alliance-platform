import {playerSameOrigin} from "../player_access";
import {loadUiV2Context,type UiV2Context,type UiV2Env} from "./context";
import {esc,renderUiV2Shell,uiV2Html} from "./shell";
import {DEFAULT_THEME,THEME_FIELDS,THEME_PRESETS,paletteSettings,presetById,resolveTheme,validPalette,validThemeColour,type ThemePalette} from "./theme";

type SettingRow={key:string;value:string};
type CustomTheme={name:string;palette:ThemePalette};
type AssetSlot={setting:string;key:string;types:string[]};

const ASSET_SLOTS:Record<"main"|"login",AssetSlot>={
  main:{setting:"brand_main_logo",key:"branding/main-logo",types:["image/png","image/jpeg","image/webp"]},
  login:{setting:"brand_login_logo",key:"branding/login-logo",types:["image/png","image/jpeg","image/webp"]}
};
const ICON_SLOTS:Array<[string,string]>=[["master","branding/icons/master.png"],["i16","branding/icons/favicon-16.png"],["i32","branding/icons/favicon-32.png"],["i48","branding/icons/favicon-48.png"],["apple","branding/icons/apple-touch-icon.png"],["pwa192","branding/icons/android-chrome-192.png"],["pwa512","branding/icons/android-chrome-512.png"]];

const setting=async(env:UiV2Env,key:string)=>await env.DB.prepare("SELECT value FROM settings WHERE key=? LIMIT 1").bind(key).first<{value:string}>();

async function settings(env:UiV2Env){
  const rows=await env.DB.prepare("SELECT key,value FROM settings WHERE key LIKE 'theme_%' OR key IN ('platform_name','login_title','footer_text','brand_main_logo','brand_login_logo','brand_favicon')").all<SettingRow>();
  return Object.fromEntries((rows.results??[]).map(row=>[row.key,row.value]));
}

function customTheme(source:Record<string,string>,slot:1|2):CustomTheme|null{
  try{
    const palette=JSON.parse(source[`theme_custom_${slot}`]||"");
    if(!validPalette(palette))return null;
    return {name:(source[`theme_custom_${slot}_name`]||`Custom Theme ${slot}`).trim().slice(0,40)||`Custom Theme ${slot}`,palette};
  }catch{return null;}
}

const saveSettings=async(env:UiV2Env,values:Array<{key:string;value:string}>)=>{
  await env.DB.batch(values.map(item=>env.DB.prepare("INSERT INTO settings (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(item.key,item.value)));
};

const deleteSetting=async(env:UiV2Env,key:string)=>env.DB.prepare("DELETE FROM settings WHERE key=?").bind(key).run();

const audit=async(env:UiV2Env,context:UiV2Context,action:string,newValues:unknown)=>{
  await env.DB.prepare("INSERT INTO audit_log (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,new_values) VALUES (?,?,? ,?,'branding','ui-v2','ui-v2-branding',?)")
    .bind(crypto.randomUUID(),context.user.accountId,context.user.displayName,action,JSON.stringify(newValues)).run();
};

function paletteFromForm(form:FormData):ThemePalette|null{
  const palette={} as ThemePalette;
  for(const field of THEME_FIELDS){
    const value=String(form.get(`colour_${field.key}`)||"").trim();
    if(!validThemeColour(value))return null;
    palette[field.key]=value;
  }
  return palette;
}

function themeVars(palette:ThemePalette){
  return {
    pageBackground:"--ui-bg",panelBackground:"--ui-surface",cardBackground:"--ui-surface-2",border:"--ui-line",
    primary:"--ui-accent",secondary:"--ui-secondary",mainText:"--ui-text",mutedText:"--ui-muted",rank:"--ui-rank-highlight",
    allianceTag:"--ui-alliance-tag",serverNumber:"--ui-server-number",navigationText:"--ui-navigation",footer:"--ui-footer",
    button:"--ui-button",buttonText:"--ui-button-text",hover:"--ui-hover",success:"--ui-success",warning:"--ui-warning",
    danger:"--ui-danger",siteName:"--ui-site-name",loginHeading:"--ui-login-heading",footerWording:"--ui-footer-wording"
  } satisfies Record<keyof ThemePalette,string>;
}

const brandingCss=`<style>
.branding-section{margin-top:28px}.branding-section-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:13px}.branding-section-head h2{margin:0;font-size:1.15rem}.branding-section-head p{margin:3px 0 0;color:var(--ui-muted);font-size:.88rem}.artwork-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.artwork-card{padding:17px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-2)}.artwork-card h3{margin:0 0 6px;font-size:1rem}.artwork-card>p{min-height:42px;margin:0;color:var(--ui-muted);font-size:.78rem;line-height:1.45}.artwork-preview{height:138px;margin:14px 0;display:flex;align-items:center;justify-content:center;border:1px dashed var(--ui-line-strong);border-radius:12px;background:var(--ui-surface-3);overflow:hidden}.artwork-preview img{display:block;max-width:88%;max-height:112px;object-fit:contain}.artwork-fallback{color:var(--ui-accent);font-size:1.1rem;font-weight:900}.asset-form input[type=file]{width:100%;padding:9px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-muted);font-size:.76rem}.asset-guide{margin:8px 0 10px;color:var(--ui-muted);font-size:.72rem;line-height:1.45}.asset-form .theme-button{width:100%}.artwork-card>form:not(.asset-form){margin-top:8px}.artwork-card .remove-button{width:100%;border:1px solid color-mix(in srgb,var(--ui-danger) 55%,var(--ui-line));background:color-mix(in srgb,var(--ui-danger) 12%,var(--ui-surface-3));color:var(--ui-danger)}.upload-message{display:none;margin-top:9px;padding:9px;border:1px solid color-mix(in srgb,var(--ui-danger) 55%,var(--ui-line));border-radius:8px;color:var(--ui-danger);font-size:.74rem}.upload-message.show{display:block}.preset-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.preset-card,.custom-card{padding:15px;border:1px solid var(--ui-line);border-radius:14px;background:var(--ui-surface-2)}.preset-card h3,.custom-card h3{margin:11px 0 5px;font-size:.95rem}.preset-card p,.custom-card p{min-height:38px;margin:0;color:var(--ui-muted);font-size:.76rem;line-height:1.45}.swatches{display:flex;gap:5px}.swatch{width:24px;height:24px;border:1px solid rgba(255,255,255,.14);border-radius:7px}.small-button{width:100%;margin-top:12px;padding:9px 10px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-navigation);font-size:.78rem;font-weight:850;cursor:pointer}.small-button:hover{border-color:var(--ui-hover);color:var(--ui-text)}.custom-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.custom-empty{color:var(--ui-muted);font-style:italic}.theme-editor{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:18px;align-items:start}.colour-panel,.wording-panel,.preview-panel{border:1px solid var(--ui-line);border-radius:15px;background:var(--ui-surface-2);padding:20px}.colour-group+.colour-group{margin-top:22px}.colour-group h3{margin:0 0 10px;color:var(--ui-secondary);font-size:.8rem;text-transform:uppercase;letter-spacing:.08em}.colour-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.colour-field{display:grid;grid-template-columns:42px 1fr;align-items:center;gap:10px;padding:9px;border:1px solid var(--ui-line);border-radius:10px;background:color-mix(in srgb,var(--ui-surface) 65%,transparent)}.colour-field input[type=color]{width:42px;height:34px;padding:2px;border:0;border-radius:7px;background:transparent;cursor:pointer}.colour-field label{font-size:.8rem;font-weight:780}.colour-field code{display:block;margin-top:2px;color:var(--ui-muted);font-size:.7rem}.editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.editor-actions .primary-action{grid-column:1/-1}.theme-button{padding:11px 13px;border:0;border-radius:10px;background:var(--ui-button);color:var(--ui-button-text);font-weight:850;cursor:pointer}.theme-button.secondary{border:1px solid var(--ui-line-strong);background:var(--ui-surface-3);color:var(--ui-navigation)}.custom-name{width:100%;margin-top:8px;padding:10px 11px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.preview-panel{position:sticky;top:18px}.preview-panel h3{margin:0 0 14px}.preview-shell{padding:14px;border:1px solid var(--ui-line);border-radius:13px;background:var(--ui-surface)}.preview-head{display:flex;justify-content:space-between;gap:12px;padding-bottom:12px;border-bottom:1px solid var(--ui-line)}.preview-site{color:var(--ui-site-name);font-weight:900}.preview-identity{font-size:.75rem;font-weight:800}.preview-tag{color:var(--ui-alliance-tag)}.preview-server{color:var(--ui-server-number)}.preview-rank{color:var(--ui-rank-highlight);font-size:.76rem;font-weight:850}.preview-nav{display:inline-block;margin-top:12px;padding:8px 10px;border:1px solid var(--ui-line-strong);border-radius:8px;color:var(--ui-navigation);font-size:.72rem;font-weight:850}.preview-nav:hover{border-color:var(--ui-hover);color:var(--ui-hover)}.preview-card{margin-top:12px;padding:14px;border:1px solid var(--ui-line);border-radius:11px;background:var(--ui-surface-2);transition:.15s ease}.preview-card:hover{border-color:var(--ui-hover);box-shadow:0 0 18px color-mix(in srgb,var(--ui-hover) 18%,transparent);transform:translateY(-1px)}.preview-card strong{color:var(--ui-accent)}.preview-card p{margin:6px 0 0;color:var(--ui-muted);font-size:.76rem;line-height:1.45}.preview-button{margin-top:12px;padding:9px 11px;border:0;border-radius:8px;background:var(--ui-button);color:var(--ui-button-text);font-weight:850}.preview-status{display:flex;gap:8px;margin-top:12px;font-size:.68rem;font-weight:850}.preview-status .success{color:var(--ui-success)}.preview-status .warning{color:var(--ui-warning)}.preview-status .danger{color:var(--ui-danger)}.preview-footer{display:flex;justify-content:space-between;gap:10px;margin-top:13px;padding-top:11px;border-top:1px solid var(--ui-line);color:var(--ui-footer);font-size:.68rem}.preview-footer strong{color:var(--ui-site-name)}.preview-footer span{color:var(--ui-footer-wording)}.wording-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.wording-grid label{display:block;margin-bottom:6px;font-size:.8rem;font-weight:800}.wording-grid input{width:100%;padding:11px 12px;border:1px solid var(--ui-line-strong);border-radius:9px;background:var(--ui-surface-3);color:var(--ui-text)}.notice{margin-bottom:18px;padding:12px 14px;border:1px solid color-mix(in srgb,var(--ui-success) 42%,var(--ui-line));border-radius:11px;background:color-mix(in srgb,var(--ui-success) 10%,var(--ui-surface-2));color:var(--ui-success);font-size:.86rem;font-weight:750}@media(max-width:980px){.artwork-grid,.preset-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.theme-editor{grid-template-columns:1fr}.preview-panel{position:static}.wording-grid{grid-template-columns:1fr}}@media(max-width:650px){.artwork-grid,.preset-grid,.custom-grid,.colour-grid{grid-template-columns:1fr}.branding-section-head{display:block}.branding-section-head p{margin-top:6px}.editor-actions{grid-template-columns:1fr}.editor-actions .primary-action{grid-column:auto}}
</style>`;

function presetCards(){
  return THEME_PRESETS.map(theme=>`<article class="preset-card"><div class="swatches">${[theme.palette.pageBackground,theme.palette.panelBackground,theme.palette.primary,theme.palette.secondary,theme.palette.rank].map(colour=>`<span class="swatch" style="background:${colour}"></span>`).join("")}</div><h3>${esc(theme.name)}</h3><p>${esc(theme.description)}</p><form method="post" action="/ui-v2/branding"><input type="hidden" name="action" value="apply_preset"><input type="hidden" name="preset" value="${esc(theme.id)}"><button class="small-button">Apply theme</button></form></article>`).join("");
}

function customCards(customs:Array<CustomTheme|null>){
  return customs.map((theme,index)=>`<article class="custom-card"><div class="swatches">${theme?[theme.palette.pageBackground,theme.palette.panelBackground,theme.palette.primary,theme.palette.secondary,theme.palette.rank].map(colour=>`<span class="swatch" style="background:${colour}"></span>`).join(""):`<span class="custom-empty">Empty slot</span>`}</div><h3>${esc(theme?.name||`Custom Theme ${index+1}`)}</h3><p>${theme?"Saved colour palette ready to apply.":"Adjust the palette below, give it a name and save it here."}</p>${theme?`<form method="post" action="/ui-v2/branding"><input type="hidden" name="action" value="apply_custom"><input type="hidden" name="slot" value="${index+1}"><button class="small-button">Apply saved theme</button></form>`:""}</article>`).join("");
}

function defaultFooter(context:UiV2Context){
  const tag=context.alliance.tag?`[${context.alliance.tag}]`:"Alliance";
  const server=context.alliance.serverNumber?`Server #${context.alliance.serverNumber}`:"Server not set";
  return `${context.alliance.name} · ${tag} · ${server}`;
}

const assetUrl=(key:string)=>`/assets/${encodeURIComponent(key)}`;

function assetPreview(key:string|undefined,fallback:string){
  return key?`<img src="${assetUrl(key)}" alt="">`:`<span class="artwork-fallback">${esc(fallback)}</span>`;
}

function artworkSection(source:Record<string,string>,context:UiV2Context){
  const fallback=(context.alliance.tag||context.alliance.name.slice(0,4)||"AMP").toUpperCase();
  const main=source.brand_main_logo,login=source.brand_login_logo,icon=source.brand_favicon;
  const upload=(slot:"main"|"login",label:string,guide:string)=>`<form class="asset-form" method="post" action="/ui-v2/branding" enctype="multipart/form-data"><input type="hidden" name="action" value="upload_${slot}"><input type="file" name="asset" accept="image/png,image/jpeg,image/webp"><p class="asset-guide">${esc(guide)}</p><button class="theme-button" type="submit">${esc(label)}</button><div class="upload-message" role="status" aria-live="polite"></div></form>`;
  const remove=(action:string,label:string)=>`<form method="post" action="/ui-v2/branding" onsubmit="return confirm('Remove this image?');"><input type="hidden" name="action" value="${action}"><button class="theme-button remove-button" type="submit">${esc(label)}</button></form>`;
  return `<section class="branding-section"><div class="branding-section-head"><div><h2>Images</h2><p>Three shared assets used throughout the platform. Themes change colours only and leave these images untouched.</p></div></div><div class="artwork-grid">
    <article class="artwork-card"><h3>Main Logo</h3><p>The primary alliance logo used in the application shell and member pages.</p><div class="artwork-preview">${assetPreview(main,fallback)}</div>${upload("main",main?"Replace Main Logo":"Upload Main Logo","PNG, JPG or WebP · Maximum 5 MB · Square artwork works best.")}${main?remove("remove_main","Remove Main Logo"):""}</article>
    <article class="artwork-card"><h3>Login Logo</h3><p>Optional artwork for sign-in. Until one is uploaded, it automatically uses the Main Logo.</p><div class="artwork-preview">${assetPreview(login||main,fallback)}</div>${upload("login",login?"Replace Login Logo":"Upload Login Logo","PNG, JPG or WebP · Maximum 5 MB · High-resolution artwork is fine.")}${login?remove("remove_login","Remove Login Logo"):""}</article>
    <article class="artwork-card"><h3>App &amp; Browser Icon</h3><p>One source image creates the browser, Apple and app icon sizes automatically.</p><div class="artwork-preview">${assetPreview(icon,fallback)}</div><form class="asset-form icon-form" method="post" action="/ui-v2/branding" enctype="multipart/form-data"><input type="hidden" name="action" value="save_icons"><input type="file" name="icon_source" accept="image/png"><p class="asset-guide">Square PNG required · Maximum 5 MB · 512 × 512 px or larger recommended.</p><button class="theme-button" type="submit">${icon?"Replace Icon Set":"Upload & create icon set"}</button><div class="upload-message" role="status" aria-live="polite"></div></form>${icon?remove("remove_icons","Remove Icon Set"):""}</article>
  </div></section>`;
}

function colourEditor(palette:ThemePalette,customs:Array<CustomTheme|null>,context:UiV2Context){
  const groups=["Foundation","Brand & identity","Interaction","Status","Wording"] as const;
  const fields=groups.map(group=>`<section class="colour-group"><h3>${group}</h3><div class="colour-grid">${THEME_FIELDS.filter(field=>field.group===group).map(field=>`<div class="colour-field"><input type="color" id="colour-${field.key}" name="colour_${field.key}" value="${palette[field.key]}" data-theme-colour="${field.key}"><div><label for="colour-${field.key}">${esc(field.label)}</label><code data-colour-value="${field.key}">${palette[field.key].toUpperCase()}</code></div></div>`).join("")}</div></section>`).join("");
  return `<form method="post" action="/ui-v2/branding" id="palette-form"><div class="theme-editor"><div class="colour-panel">${fields}<div class="editor-actions"><button class="theme-button primary-action" name="action" value="save_palette">Save current palette</button><div><input class="custom-name" name="custom_1_name" maxlength="40" value="${esc(customs[0]?.name||"Custom Theme 1")}"><button class="theme-button secondary" name="action" value="save_custom_1">Save to slot 1</button></div><div><input class="custom-name" name="custom_2_name" maxlength="40" value="${esc(customs[1]?.name||"Custom Theme 2")}"><button class="theme-button secondary" name="action" value="save_custom_2">Save to slot 2</button></div></div></div>${livePreview(context)}</div></form>`;
}

function livePreview(context:UiV2Context){
  const tag=context.alliance.tag?`[${context.alliance.tag}]`:"Alliance",server=context.alliance.serverNumber?`Server #${context.alliance.serverNumber}`:"Server not set",footer=context.branding.footerText||defaultFooter(context);
  return `<aside class="preview-panel"><h3>Live preview</h3><div class="preview-shell"><div class="preview-head"><div><div class="preview-site">${esc(context.branding.platformName)}</div><div class="preview-identity"><span class="preview-tag">${esc(tag)}</span><span> · </span><span class="preview-server">${esc(server)}</span></div></div><div class="preview-rank">· R4 · Elder Drake</div></div><a class="preview-nav">Leadership Console</a><div class="preview-card"><strong>Clickable card</strong><p>Move the mouse over this card to preview the shared hover colour.</p></div><button class="preview-button" type="button">Example button</button><div class="preview-status"><span class="success">Success</span><span class="warning">Warning</span><span class="danger">Danger</span></div><div class="preview-footer"><strong>${esc(context.branding.platformName)}</strong><span>${esc(footer)}</span></div></div></aside>`;
}

function wordingForm(source:Record<string,string>,context:UiV2Context){
  return `<section class="branding-section"><div class="branding-section-head"><div><h2>Wording</h2><p>Set the platform text here. Its colours can be adjusted in the Wording palette group below.</p></div></div><form class="wording-panel" method="post" action="/ui-v2/branding"><div class="wording-grid"><div><label for="site-name">Site Name</label><input id="site-name" name="site_name" maxlength="80" value="${esc(source.platform_name||"")}" placeholder="The Pond"></div><div><label for="login-heading">Login Heading</label><input id="login-heading" name="login_heading" maxlength="100" value="${esc(source.login_title||"")}" placeholder="${esc(`Welcome to ${context.alliance.name}`)}"></div><div><label for="footer-wording">Footer Wording</label><input id="footer-wording" name="footer_wording" maxlength="140" value="${esc(source.footer_text||context.branding.footerText)}" placeholder="${esc(defaultFooter(context))}"></div></div><button class="theme-button" style="margin-top:14px" name="action" value="save_wording">Save wording</button></form></section>`;
}

function brandingScript(){
  const vars=themeVars(DEFAULT_THEME.palette);
  return `<script>(()=>{const vars=${JSON.stringify(vars)};document.querySelectorAll('[data-theme-colour]').forEach(input=>{input.addEventListener('input',()=>{const key=input.dataset.themeColour;document.documentElement.style.setProperty(vars[key],input.value);const output=document.querySelector('[data-colour-value="'+key+'"]');if(output)output.textContent=input.value.toUpperCase();});});
  const show=(form,title,text)=>{const box=form.querySelector('.upload-message');if(!box)return;box.innerHTML='<strong>'+title+'</strong><br>'+text;box.classList.add('show')};
  const clear=form=>{const box=form.querySelector('.upload-message');if(box){box.textContent='';box.classList.remove('show')}};
  document.querySelectorAll('.asset-form').forEach(form=>{const input=form.querySelector('input[type=file]');if(!input)return;const icon=form.classList.contains('icon-form');form.addEventListener('submit',async event=>{clear(form);const file=input.files&&input.files[0];if(!file){event.preventDefault();show(form,'No image selected','Choose an image before uploading.');return}if(file.size>5*1024*1024){event.preventDefault();show(form,'Image is too large','Choose an image smaller than 5 MB.');return}const allowed=icon?['image/png']:['image/png','image/jpeg','image/webp'];if(!allowed.includes(file.type)){event.preventDefault();show(form,'Unsupported image',icon?'Choose a PNG image.':'Choose a PNG, JPG or WebP image.');return}if(!icon)return;event.preventDefault();let image;try{image=await createImageBitmap(file)}catch(_){show(form,'Unsupported image','Choose a valid PNG image.');return}if(image.width!==image.height){image.close();show(form,'Image must be square','Choose a square PNG image.');return}const data=new FormData();data.append('action','save_icons');const make=size=>new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const drawing=canvas.getContext('2d');drawing.clearRect(0,0,size,size);drawing.drawImage(image,0,0,size,size);canvas.toBlob(resolve,'image/png')});for(const [field,size] of [['master',512],['i16',16],['i32',32],['i48',48],['apple',180],['pwa192',192],['pwa512',512]])data.append(field,await make(size),field+'.png');image.close();const button=form.querySelector('button');if(button){button.disabled=true;button.textContent='Creating icon set…'}try{const response=await fetch('/ui-v2/branding',{method:'POST',body:data});location.href=response.url||'/ui-v2/branding'}catch(_){if(button){button.disabled=false;button.textContent='Upload & create icon set'}show(form,'Upload failed','The image could not be uploaded. Please try again.')}});});})();</script>`;
}

function page(context:UiV2Context,source:Record<string,string>,message:string|null){
  const palette=resolveTheme(source),customs=[customTheme(source,1),customTheme(source,2)];
  const body=`${brandingCss}${message?`<div class="notice">${esc(message)}</div>`:""}${artworkSection(source,context)}${wordingForm(source,context)}<section class="branding-section"><div class="branding-section-head"><div><h2>Built-in themes</h2><p>Five safe starting points. Applying one changes colours only—never logos or wording.</p></div></div><div class="preset-grid">${presetCards()}</div></section><section class="branding-section"><div class="branding-section-head"><div><h2>Saved themes</h2><p>Two reusable palettes for seasonal or alternative looks.</p></div></div><div class="custom-grid">${customCards(customs)}</div></section><section class="branding-section"><div class="branding-section-head"><div><h2>Colour palette</h2><p>Every new UI page reads these same roles. Changes appear instantly in the preview.</p></div></div>${colourEditor(palette,customs,context)}</section>${brandingScript()}`;
  return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings · Branding",title:"Branding",description:"Choose a coordinated theme, fine-tune individual colours, and save reusable palettes without redesigning each page.",body}));
}

async function handlePost(request:Request,env:UiV2Env,context:UiV2Context,source:Record<string,string>){
  if(!playerSameOrigin(request,env))return new Response("Forbidden",{status:403});
  const form=await request.formData(),action=String(form.get("action")||"");
  if(action==="upload_main"||action==="upload_login"){
    const slot=action==="upload_main"?"main":"login",cfg=ASSET_SLOTS[slot],file=form.get("asset");
    if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||!cfg.types.includes(file.type))return Response.redirect(new URL("/ui-v2/branding?error=image",request.url),303);
    const existing=await setting(env,cfg.setting);
    await env.ASSETS.put(cfg.key,file.stream(),{httpMetadata:{contentType:file.type,cacheControl:"public, max-age=300"},customMetadata:{originalName:file.name.slice(0,180)}});
    await saveSettings(env,[{key:cfg.setting,value:cfg.key}]);
    if(existing?.value&&existing.value!==cfg.key)await env.ASSETS.delete(existing.value);
    await audit(env,context,"branding.asset.updated",{slot,key:cfg.key,contentType:file.type,size:file.size});
    return Response.redirect(new URL(`/ui-v2/branding?saved=${slot}`,request.url),303);
  }
  if(action==="remove_main"||action==="remove_login"){
    const slot=action==="remove_main"?"main":"login",cfg=ASSET_SLOTS[slot],existing=await setting(env,cfg.setting);
    if(existing?.value)await env.ASSETS.delete(existing.value);
    await deleteSetting(env,cfg.setting);
    await audit(env,context,"branding.asset.removed",{slot,key:existing?.value||null});
    return Response.redirect(new URL(`/ui-v2/branding?saved=removed-${slot}`,request.url),303);
  }
  if(action==="save_icons"){
    const files:File[]=[];
    for(const [field] of ICON_SLOTS){const file=form.get(field);if(!(file instanceof File)||file.size===0||file.size>5*1024*1024||file.type!=="image/png")return Response.redirect(new URL("/ui-v2/branding?error=image",request.url),303);files.push(file);}
    for(let index=0;index<ICON_SLOTS.length;index++){const [,key]=ICON_SLOTS[index],file=files[index];await env.ASSETS.put(key,file.stream(),{httpMetadata:{contentType:"image/png",cacheControl:"public, max-age=300"}});}
    await env.ASSETS.delete("branding/favicon");
    await saveSettings(env,[{key:"brand_favicon",value:"branding/icons/favicon-32.png"}]);
    await audit(env,context,"branding.icons.generated",{source:"single square upload",sizes:[16,32,48,180,192,512]});
    return Response.redirect(new URL("/ui-v2/branding?saved=icons",request.url),303);
  }
  if(action==="remove_icons"){
    await Promise.all([...ICON_SLOTS.map(([,key])=>key),"branding/favicon"].map(key=>env.ASSETS.delete(key)));
    await deleteSetting(env,"brand_favicon");
    await audit(env,context,"branding.icons.removed",{deleted:ICON_SLOTS.map(([,key])=>key)});
    return Response.redirect(new URL("/ui-v2/branding?saved=removed-icons",request.url),303);
  }
  if(action==="apply_preset"){
    const preset=presetById(String(form.get("preset")||""));
    if(!preset)return page(context,source,"That theme could not be found.");
    await saveSettings(env,[...paletteSettings(preset.palette),{key:"theme_active",value:`preset:${preset.id}`}]);
    await audit(env,context,"branding.theme.preset.applied",{preset:preset.id});
    return Response.redirect(new URL("/ui-v2/branding?saved=preset",request.url),303);
  }
  if(action==="apply_custom"){
    const slot=String(form.get("slot"))==="2"?2:1,theme=customTheme(source,slot);
    if(!theme)return page(context,source,"That custom theme slot is empty.");
    await saveSettings(env,[...paletteSettings(theme.palette),{key:"theme_active",value:`custom:${slot}`}]);
    await audit(env,context,"branding.theme.custom.applied",{slot,name:theme.name});
    return Response.redirect(new URL("/ui-v2/branding?saved=custom",request.url),303);
  }
  if(action==="save_wording"){
    const siteName=String(form.get("site_name")||"").trim().slice(0,80),loginHeading=String(form.get("login_heading")||"").trim().slice(0,100),footerWording=String(form.get("footer_wording")||"").trim().slice(0,140);
    await saveSettings(env,[{key:"platform_name",value:siteName},{key:"login_title",value:loginHeading},{key:"footer_text",value:footerWording}]);
    await audit(env,context,"branding.wording.updated",{siteName,loginHeading,footerWording});
    return Response.redirect(new URL("/ui-v2/branding?saved=wording",request.url),303);
  }
  const palette=paletteFromForm(form);
  if(!palette)return page(context,source,"One or more colours were not valid. Nothing was saved.");
  if(action==="save_palette"){
    await saveSettings(env,[...paletteSettings(palette),{key:"theme_active",value:"custom-current"}]);
    await audit(env,context,"branding.palette.updated",palette);
    return Response.redirect(new URL("/ui-v2/branding?saved=palette",request.url),303);
  }
  if(action==="save_custom_1"||action==="save_custom_2"){
    const slot=action.endsWith("2")?2:1,name=String(form.get(`custom_${slot}_name`)||`Custom Theme ${slot}`).trim().slice(0,40)||`Custom Theme ${slot}`;
    await saveSettings(env,[{key:`theme_custom_${slot}`,value:JSON.stringify(palette)},{key:`theme_custom_${slot}_name`,value:name}]);
    await audit(env,context,"branding.theme.custom.saved",{slot,name});
    return Response.redirect(new URL(`/ui-v2/branding?saved=slot${slot}`,request.url),303);
  }
  return page(context,source,"No branding action was selected.");
}

export async function handleUiV2Branding(request:Request,env:UiV2Env):Promise<Response|null>{
  const url=new URL(request.url);
  if(url.pathname!=="/ui-v2/branding"||!(request.method==="GET"||request.method==="POST"))return null;
  const context=await loadUiV2Context(request,env);
  if(!context)return Response.redirect(new URL("/login",request.url),302);
  if(!context.user.canManageBranding)return uiV2Html(renderUiV2Shell(context,{eyebrow:"Settings",title:"Branding",description:"You do not have permission to manage branding.",body:""}),403);
  const source=await settings(env);
  if(request.method==="POST")return handlePost(request,env,context,source);
  const messages:Record<string,string>={preset:"Built-in theme applied.",custom:"Saved theme applied.",palette:"Colour palette saved.",wording:"Wording saved.",slot1:"Custom Theme 1 saved.",slot2:"Custom Theme 2 saved.",main:"Main Logo saved.",login:"Login Logo saved.",icons:"App & Browser Icon set created.","removed-main":"Main Logo removed.","removed-login":"Login Logo removed. The sign-in page will use the Main Logo.","removed-icons":"App & Browser Icon set removed."};
  const message=url.searchParams.get("error")==="image"?"That image could not be used. Check its format and size, then try again.":messages[url.searchParams.get("saved")||""]||null;
  return page(context,source,message);
}
