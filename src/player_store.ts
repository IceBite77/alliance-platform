import type {PlayerActor} from "./player_access";

export interface PlayerStoreEnv { DB:D1Database }

export type StoredPlayer={
  id:number;
  display_name:string;
  rank:number;
  base_level:number|null;
  is_active:number;
  joined_at:string|null;
  left_at:string|null;
  birthday_month:number|null;
  birthday_day:number|null;
};

export const loadStoredPlayer=async(env:PlayerStoreEnv,id:number)=>
  await env.DB.prepare(`
    SELECT id,display_name,rank,base_level,is_active,joined_at,left_at,birthday_month,birthday_day
    FROM players WHERE id=? LIMIT 1
  `).bind(id).first<StoredPlayer>();

export const auditPlayer=async(env:PlayerStoreEnv,actor:PlayerActor,action:string,id:number,newValues:unknown,oldValues:unknown=null,metadata:unknown=null)=>
  env.DB.prepare(`
    INSERT INTO audit_log
      (public_id,actor_account_id,actor_display_name,action,entity_type,entity_id,source,old_values,new_values,metadata)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).bind(
    crypto.randomUUID(),actor.id,actor.display_name,action,"player",String(id),"players",
    oldValues===null?null:JSON.stringify(oldValues),
    newValues===null?null:JSON.stringify(newValues),
    metadata===null?null:JSON.stringify(metadata)
  ).run();

export const recordPlayerRankChange=async(env:PlayerStoreEnv,actor:PlayerActor,id:number,oldRank:number|null,newRank:number,note:string)=>
  env.DB.prepare(`
    INSERT INTO player_rank_history (player_id,old_rank,new_rank,changed_by_account_id,note)
    VALUES (?,?,?,?,?)
  `).bind(id,oldRank,newRank,actor.id,note).run();
