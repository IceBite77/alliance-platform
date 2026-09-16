export type ThemePalette={
  pageBackground:string;
  panelBackground:string;
  cardBackground:string;
  border:string;
  primary:string;
  secondary:string;
  mainText:string;
  mutedText:string;
  rank:string;
  allianceTag:string;
  serverNumber:string;
  navigationText:string;
  footer:string;
  button:string;
  buttonText:string;
  hover:string;
  success:string;
  warning:string;
  danger:string;
  siteName:string;
  loginHeading:string;
  footerWording:string;
};

export type ThemePreset={id:string;name:string;description:string;palette:ThemePalette};

export const THEME_FIELDS:Array<{key:keyof ThemePalette;setting:string;label:string;group:"Foundation"|"Brand & identity"|"Interaction"|"Status"|"Wording"}>=[
  {key:"pageBackground",setting:"theme_page_background",label:"Page Background",group:"Foundation"},
  {key:"panelBackground",setting:"theme_panel_background",label:"Main Panel Background",group:"Foundation"},
  {key:"cardBackground",setting:"theme_card_background",label:"Card Background",group:"Foundation"},
  {key:"border",setting:"theme_border",label:"Border Colour",group:"Foundation"},
  {key:"primary",setting:"theme_brand",label:"Primary Brand Colour",group:"Brand & identity"},
  {key:"secondary",setting:"theme_secondary",label:"Secondary Colour",group:"Brand & identity"},
  {key:"mainText",setting:"theme_main_text",label:"Main Text Colour",group:"Brand & identity"},
  {key:"mutedText",setting:"theme_muted_text",label:"Muted Text Colour",group:"Brand & identity"},
  {key:"rank",setting:"theme_rank",label:"Rank Colour",group:"Brand & identity"},
  {key:"allianceTag",setting:"theme_alliance_tag",label:"Alliance Tag Colour",group:"Brand & identity"},
  {key:"serverNumber",setting:"theme_server_number",label:"Server Number Colour",group:"Brand & identity"},
  {key:"navigationText",setting:"theme_navigation",label:"Navigation Text Colour",group:"Brand & identity"},
  {key:"footer",setting:"theme_footer",label:"Footer Colour",group:"Brand & identity"},
  {key:"button",setting:"theme_button",label:"Button Colour",group:"Interaction"},
  {key:"buttonText",setting:"theme_button_text",label:"Button Text Colour",group:"Interaction"},
  {key:"hover",setting:"theme_hover",label:"Hover Colour",group:"Interaction"},
  {key:"success",setting:"theme_success",label:"Success Colour",group:"Status"},
  {key:"warning",setting:"theme_warning",label:"Warning Colour",group:"Status"},
  {key:"danger",setting:"theme_danger",label:"Danger Colour",group:"Status"},
  {key:"siteName",setting:"theme_site_name",label:"Site Name Colour",group:"Wording"},
  {key:"loginHeading",setting:"theme_login_heading",label:"Login Heading Colour",group:"Wording"},
  {key:"footerWording",setting:"theme_footer_wording",label:"Footer Wording Colour",group:"Wording"}
];

const iceAndGold:ThemePalette={
  pageBackground:"#090e18",panelBackground:"#151d2e",cardBackground:"#0e1626",border:"#2b3850",
  primary:"#63b9e8",secondary:"#aebddd",mainText:"#eef3ff",mutedText:"#90a0bb",rank:"#d7a83e",
  allianceTag:"#63b9e8",serverNumber:"#63b9e8",navigationText:"#aebddd",footer:"#aebddd",
  button:"#3a8fc3",buttonText:"#ffffff",hover:"#63b9e8",success:"#51d88a",warning:"#f5c451",danger:"#ed8796",
  siteName:"#63b9e8",loginHeading:"#eef3ff",footerWording:"#aebddd"
};

const withPalette=(changes:Partial<ThemePalette>):ThemePalette=>({...iceAndGold,...changes});

export const THEME_PRESETS:ThemePreset[]=[
  {id:"ice-gold",name:"Ice & Gold",description:"Icy blue and warm gold on deep navy.",palette:iceAndGold},
  {id:"midnight",name:"Midnight",description:"Deep navy with rich indigo accents.",palette:withPalette({primary:"#6977f4",secondary:"#b5bdf5",rank:"#aeb8ff",allianceTag:"#8995ff",serverNumber:"#8995ff",navigationText:"#b5bdf5",footer:"#9ea8db",button:"#5865f2",hover:"#7f8aff",siteName:"#8995ff",footerWording:"#9ea8db"})},
  {id:"steel",name:"Steel",description:"Neutral slate and cool silver tones.",palette:withPalette({pageBackground:"#0b1017",panelBackground:"#18212c",cardBackground:"#101821",border:"#344252",primary:"#8aa4b8",secondary:"#c3d0da",rank:"#d6b873",allianceTag:"#9db5c7",serverNumber:"#9db5c7",navigationText:"#c3d0da",footer:"#a7b6c2",button:"#607d93",hover:"#9db5c7",siteName:"#9db5c7",footerWording:"#a7b6c2"})},
  {id:"forest",name:"Forest",description:"Dark evergreen with fresh green highlights.",palette:withPalette({pageBackground:"#07120e",panelBackground:"#10251d",cardBackground:"#0b1b15",border:"#28483a",primary:"#62c690",secondary:"#a9d8bd",rank:"#e0bd62",allianceTag:"#72d39e",serverNumber:"#72d39e",navigationText:"#a9d8bd",footer:"#91bda3",button:"#2f855a",hover:"#62c690",success:"#71df9e",siteName:"#72d39e",footerWording:"#91bda3"})},
  {id:"crimson",name:"Crimson",description:"Dark charcoal with confident red accents.",palette:withPalette({pageBackground:"#130a0d",panelBackground:"#28151b",cardBackground:"#1c0f14",border:"#53303a",primary:"#e1647a",secondary:"#efb0bb",rank:"#e2bd65",allianceTag:"#eb7d90",serverNumber:"#eb7d90",navigationText:"#efb0bb",footer:"#c99aa4",button:"#b8324b",hover:"#e1647a",danger:"#ff7188",siteName:"#eb7d90",footerWording:"#c99aa4"})}
];

export const DEFAULT_THEME=THEME_PRESETS[0];
export const validThemeColour=(value:unknown):value is string=>typeof value==="string"&&/^#[0-9a-fA-F]{6}$/.test(value);

export function resolveTheme(settings:Record<string,string>):ThemePalette{
  const palette={...DEFAULT_THEME.palette};
  for(const field of THEME_FIELDS){
    const value=settings[field.setting];
    if(validThemeColour(value))palette[field.key]=value;
  }
  return palette;
}

export function validPalette(value:unknown):value is ThemePalette{
  if(!value||typeof value!=="object")return false;
  return THEME_FIELDS.every(field=>validThemeColour((value as Record<string,unknown>)[field.key]));
}

export function presetById(id:string){return THEME_PRESETS.find(theme=>theme.id===id)||null;}

export function paletteSettings(palette:ThemePalette){
  return THEME_FIELDS.map(field=>({key:field.setting,value:palette[field.key]}));
}
