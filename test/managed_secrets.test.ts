import {describe,expect,it} from "vitest";
import {decryptManagedSecret,encryptManagedSecret} from "../src/managed_secrets";

const env=(secret:string)=>({DB:{} as D1Database,AUTH_SECRET:secret});

describe("managed secrets",()=>{
  it("encrypts without retaining plaintext and decrypts with the installation secret",async()=>{
    const value="sk-project-example-secret",encrypted=await encryptManagedSecret(env("installation-root"),value);
    expect(encrypted.ciphertext).not.toContain(value);
    expect(await decryptManagedSecret(env("installation-root"),encrypted.ciphertext,encrypted.iv)).toBe(value);
  });

  it("cannot decrypt with another installation secret",async()=>{
    const encrypted=await encryptManagedSecret(env("first-installation"),"private-value");
    await expect(decryptManagedSecret(env("different-installation"),encrypted.ciphertext,encrypted.iv)).rejects.toBeDefined();
  });
});
