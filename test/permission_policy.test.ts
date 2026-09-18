import {describe,expect,it} from "vitest";
import {evaluatePermissionPolicy} from "../src/permission_policy";

describe("permission policy",()=>{
  it("gives the Owner every permission",()=>{
    expect(evaluatePermissionPolicy({permissionKey:"system.transfer_owner",isOwner:true,isAdministrator:true,explicitlyDenied:true})).toBe(true);
  });

  it("gives Administrators platform permissions but not ownership transfer",()=>{
    expect(evaluatePermissionPolicy({permissionKey:"players.edit",isOwner:false,isAdministrator:true})).toBe(true);
    expect(evaluatePermissionPolicy({permissionKey:"system.transfer_owner",isOwner:false,isAdministrator:true})).toBe(false);
  });

  it("makes an explicit denial win for Leadership and members",()=>{
    expect(evaluatePermissionPolicy({permissionKey:"front.rankings.view",isOwner:false,isAdministrator:false,explicitlyDenied:true,explicitlyAllowed:true,groupAllowed:true})).toBe(false);
  });

  it("allows an explicit grant or Access Group grant",()=>{
    expect(evaluatePermissionPolicy({permissionKey:"front.rankings.view",isOwner:false,isAdministrator:false,explicitlyAllowed:true})).toBe(true);
    expect(evaluatePermissionPolicy({permissionKey:"front.rankings.view",isOwner:false,isAdministrator:false,groupAllowed:true})).toBe(true);
  });

  it("denies ordinary members when no permission was granted",()=>{
    expect(evaluatePermissionPolicy({permissionKey:"front.shield_drops.view",isOwner:false,isAdministrator:false})).toBe(false);
  });
});
