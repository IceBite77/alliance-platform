import {playerActor,playerPermitted,playerSameOrigin,type PlayerActor} from "./player_access";

export interface BrandingAccessEnv {
  DB:D1Database;
  APP_URL:string;
}

export type BrandingActor=PlayerActor;

export const brandingActor=async(request:Request,env:BrandingAccessEnv)=>{
  const actor=await playerActor(request,env);
  if(!actor)return null;
  return await playerPermitted(env,actor,"settings.branding")?actor:null;
};

export const brandingAuthorised=async(request:Request,env:BrandingAccessEnv)=>{
  const actor=await brandingActor(request,env);
  if(!actor)return {actor:null,response:Response.redirect(new URL("/login",request.url),302)};
  if(request.method!=="GET"&&!playerSameOrigin(request,env))return {actor:null,response:new Response("Forbidden",{status:403})};
  return {actor,response:null};
};
