export const PLATFORM_SCOPE = "00000000-0000-0000-0000-000000000001";
export function uuid(value) {
  const id = String(value || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Informe um UUID válido.");
  return id.toLowerCase();
}
function roleId(value) { const id=Number(value); if(!Number.isSafeInteger(id)||id<=0)throw new Error("Informe um ID de perfil válido.");return id; }
function change(reason, version) {
  if (!String(reason || "").trim()) throw new Error("Informe o motivo da alteração.");
  if (version !== undefined && (!Number.isSafeInteger(version) || version < 0)) throw new Error("Atualize os dados antes de alterar esta versão.");
  return {reason:reason.trim(),correlationId:crypto.randomUUID(),...(version === undefined ? {} : {version})};
}
function versionOf(value) { if(!Number.isSafeInteger(value?.version)||value.version<0)throw new Error("Atualize os dados para obter a versão atual.");return value.version; }
const ROOT="/api/iam";
const AUTHZ=`${ROOT}/api/v1/authorization/admin`;
export function createIiamApi(request) {
  const send=(path,method="GET",body,signal)=>request(path,{method,body,signal,authenticated:true});
  const scoped=(scope)=>`scopeId=${encodeURIComponent(uuid(scope))}&page=0&size=100`;
  async function pages(path,scope,extra="") {
    const items=[];
    for(let page=0;page<100;page+=1){
      const result=await send(`${path}?${scoped(scope).replace("page=0",`page=${page}`)}${extra}`);
      items.push(...(result.items||[]));
      if(items.length>=result.total || !result.items?.length)return {...result,items};
    }
    throw new Error("A consulta excedeu o limite da interface. Refine o escopo.");
  }
  return {
    applications:()=>send(`${ROOT}/api/v1/admin/identity-applications`),
    identity:(id)=>send(`${ROOT}/api/v1/identities/${uuid(id)}`),
    tenant:(id)=>send(`${ROOT}/api/v1/tenants/${uuid(id)}`),
    createTenant:(code,name)=>send(`${ROOT}/api/v1/admin/tenants`,"POST",{code,name}),
    tenantAction:(id,action)=>{if(!["activate","disable","reactivate"].includes(action))throw new Error("Ação inválida.");return send(`${ROOT}/api/v1/admin/tenants/${uuid(id)}/${action}`,"POST");},
    approve:(applicationId,tenantId,affiliation,identityKind)=>send(`${ROOT}/api/v1/admin/identity-applications/${uuid(applicationId)}/approve`,"POST",{tenantId:uuid(tenantId),affiliation,identityKind}),
    reject:(applicationId,reason)=>{if(!reason?.trim())throw new Error("Informe o motivo da rejeição.");return send(`${ROOT}/api/v1/admin/identity-applications/${uuid(applicationId)}/reject`,"POST",{reason:reason.trim()});},
    invitation:(identityId)=>send(`${ROOT}/authentication/admin/identities/${uuid(identityId)}/invitation`,"POST"),
    identityAction:(id,action)=>{if(!["disable","reactivate"].includes(action))throw new Error("Ação inválida.");return send(`${ROOT}/api/v1/admin/identities/${uuid(id)}/${action}`,"POST");},
    sessions:()=>send(`${ROOT}/authentication/sessions`),
    endSession:(sid)=>send(`${ROOT}/authentication/sessions/${uuid(sid)}`,"DELETE"),
    adminSessions:()=>send(`${ROOT}/authentication/admin/sessions?page=0&size=100`),
    endAdminSession:(id)=>send(`${ROOT}/authentication/admin/sessions/${roleId(id)}/logout`,"PATCH"),
    changePassword:(currentPassword,newPassword)=>send(`${ROOT}/authentication/password`,"POST",{currentPassword,newPassword}),
    roles:(scope)=>pages(`${AUTHZ}/roles`,scope),
    permissions:(scope)=>pages(`${AUTHZ}/catalog/permissions`,scope),
    assignments:(scope)=>pages(`${AUTHZ}/assignments`,scope),
    denies:(scope)=>pages(`${AUTHZ}/denies`,scope,"&active=true"),
    rolePermissions:(id)=>send(`${AUTHZ}/roles/${roleId(id)}/permissions`),
    createRole:(name,ownership,ownerScopeId,ownerTenantId,permissions,reason)=>send(`${AUTHZ}/roles`,"POST",{name,ownership,ownerScopeId:ownership==="SCOPE"?uuid(ownerScopeId):null,ownerTenantId:ownership==="TENANT"?uuid(ownerTenantId):null,permissions,...change(reason)}),
    saveRolePermissions:(role,permissions,reason)=>send(`${AUTHZ}/roles/${roleId(role.id)}/permissions`,"PUT",{permissions,...change(reason,versionOf(role))}),
    roleLifecycle:(role,status,reason)=>send(`${AUTHZ}/roles/${roleId(role.id)}/lifecycle`,"POST",{status,...change(reason,versionOf(role))}),
    deleteRole:(role,reason)=>send(`${AUTHZ}/roles/${roleId(role.id)}`,"DELETE",change(reason,versionOf(role))),
    assign:(identityId,id,scopeId,reason)=>send(`${AUTHZ}/assignments`,"POST",{identityId:uuid(identityId),roleId:roleId(id),scopeId:uuid(scopeId),...change(reason)}),
    revokeAssignment:(assignment,reason)=>send(`${AUTHZ}/assignments/${uuid(assignment.id)}/revoke`,"POST",change(reason,versionOf(assignment))),
    deny:(identityId,permission,scopeId,reason)=>send(`${AUTHZ}/denies`,"POST",{identityId:uuid(identityId),permission,scopeId:uuid(scopeId),...change(reason)}),
    revokeDeny:(deny,reason)=>send(`${AUTHZ}/denies/${uuid(deny.id)}/revoke`,"POST",change(reason,versionOf(deny))),
  };
}
