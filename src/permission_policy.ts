export type PermissionPolicyInput={
  permissionKey:string;
  isOwner:boolean;
  isAdministrator:boolean;
  explicitlyDenied?:boolean;
  explicitlyAllowed?:boolean;
  groupAllowed?:boolean;
};

export const OWNER_ONLY_PERMISSIONS=new Set(["system.transfer_owner"]);

export function evaluatePermissionPolicy(input:PermissionPolicyInput){
  if(input.isOwner)return true;
  if(input.isAdministrator)return !OWNER_ONLY_PERMISSIONS.has(input.permissionKey);
  if(input.explicitlyDenied)return false;
  if(input.explicitlyAllowed)return true;
  return Boolean(input.groupAllowed);
}
