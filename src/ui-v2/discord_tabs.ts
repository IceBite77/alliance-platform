const tabs=[
  ["overview","Overview","/ui-v2/settings/discord"],
  ["setup","Server Setup","/ui-v2/settings/discord-setup"],
  ["ranks","Rank Roles","/ui-v2/settings/discord-rank-sync"],
  ["access","Access Check","/ui-v2/settings/discord-orphan-access"],
  ["notifications","Notifications","/ui-v2/settings/discord-notifications"],
  ["shields","Shield Reminders","/ui-v2/settings/discord-shield-reminders"]
] as const;

export function discordTabs(active:string){return `<style>.discord-nav-tabs{display:flex;align-items:flex-end;gap:5px;margin-bottom:18px;border-bottom:1px solid var(--ui-line-strong);overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}.discord-nav-tab{position:relative;flex:0 0 auto;min-height:48px;padding:12px 17px;border:1px solid transparent;border-bottom:0;border-radius:11px 11px 0 0;color:var(--ui-navigation);font-size:.78rem;font-weight:900;text-decoration:none}.discord-nav-tab:hover{color:var(--ui-hover);background:color-mix(in srgb,var(--ui-hover) 7%,transparent)}.discord-nav-tab.active{border-color:var(--ui-line-strong);background:var(--ui-surface-2);color:var(--ui-accent)}.discord-nav-tab.active::after{content:"";position:absolute;left:-1px;right:-1px;bottom:-2px;height:3px;border-radius:3px 3px 0 0;background:var(--ui-hover)}@media(max-width:700px){.discord-nav-tab{min-height:44px;padding:11px 13px;font-size:.72rem}}</style><nav class="discord-nav-tabs" aria-label="Discord settings">${tabs.map(([id,label,href])=>`<a class="discord-nav-tab${id===active?" active":""}" href="${href}"${id===active?' aria-current="page"':""}>${label}</a>`).join("")}</nav>`}
