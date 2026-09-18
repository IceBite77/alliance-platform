export interface ManagedSecretEnv {
  DB:D1Database;
  AUTH_SECRET?:string;
}

const allowed=new Set(["OPENAI_API_KEY","DISCORD_CLIENT_ID","DISCORD_CLIENT_SECRET","DISCORD_BOT_TOKEN","SETUP_KEY"]);
const encoder=new TextEncoder(),decoder=new TextDecoder();
const bytesToBase64=(bytes:Uint8Array)=>{let value="";for(const byte of bytes)value+=String.fromCharCode(byte);return btoa(value)};
const base64ToBytes=(value:string)=>Uint8Array.from(atob(value),char=>char.charCodeAt(0));

async function cryptoKey(env:ManagedSecretEnv){
  if(!env.AUTH_SECRET)throw new Error("The installation encryption secret is not configured.");
  const digest=await crypto.subtle.digest("SHA-256",encoder.encode(`alliance-platform:managed-secrets:${env.AUTH_SECRET}`));
  return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);
}

export async function encryptManagedSecret(env:ManagedSecretEnv,value:string){
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await cryptoKey(env);
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,encoder.encode(value));
  return {ciphertext:bytesToBase64(new Uint8Array(encrypted)),iv:bytesToBase64(iv)};
}

export async function decryptManagedSecret(env:ManagedSecretEnv,ciphertext:string,iv:string){
  const key=await cryptoKey(env),plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:base64ToBytes(iv)},key,base64ToBytes(ciphertext));
  return decoder.decode(plain);
}

export async function hydrateManagedSecrets<T extends ManagedSecretEnv>(env:T):Promise<T>{
  if(!env.AUTH_SECRET)return env;
  try{
    const result=await env.DB.prepare("SELECT secret_key,ciphertext,iv FROM managed_secrets").all<{secret_key:string;ciphertext:string;iv:string}>();
    const overrides:Record<string,string>={};
    for(const row of result.results??[]){
      if(!allowed.has(row.secret_key))continue;
      try{overrides[row.secret_key]=await decryptManagedSecret(env,row.ciphertext,row.iv)}catch(error){console.error(`Could not decrypt managed secret ${row.secret_key}`,error)}
    }
    return Object.assign({},env,overrides);
  }catch{return env}
}

export function isManagedSecretKey(value:string){return allowed.has(value)}
