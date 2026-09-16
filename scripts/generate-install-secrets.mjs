import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
function secret(bytes=48){
  const b=randomBytes(bytes);
  let out="";
  for(const x of b) out+=alphabet[x%alphabet.length];
  return out;
}
function run(args,input){
  const r=spawnSync(process.platform==="win32"?"npx.cmd":"npx",["wrangler",...args],{stdio:["pipe","inherit","inherit"],input,encoding:"utf8"});
  if(r.status!==0) process.exit(r.status??1);
}

console.log("Generating private installation secrets…");
run(["secret","put","SETUP_KEY"],secret()+"\n");
run(["secret","put","AUTH_SECRET"],secret()+"\n");
console.log("✓ SETUP_KEY generated and stored in Cloudflare");
console.log("✓ AUTH_SECRET generated and stored in Cloudflare");
console.log("You do not need to record either secret.");
