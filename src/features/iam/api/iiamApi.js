export const PLATFORM_SCOPE = "00000000-0000-0000-0000-000000000001";
export function uuid(value) {
  const id = String(value || "").trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new Error("Informe um UUID válido.");
  return id.toLowerCase();
}
function roleId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new Error("Informe um ID de perfil válido.");
  return id;
}
function change(reason, version) {
  if (!String(reason || "").trim())
    throw new Error("Informe o motivo da alteração.");
  if (reason.trim().length > 500)
    throw new Error("O motivo deve ter até 500 caracteres.");
  if (version !== undefined && (!Number.isSafeInteger(version) || version < 0))
    throw new Error("Atualize os dados antes de alterar esta versão.");
  return {
    reason: reason.trim(),
    correlationId: crypto.randomUUID(),
    ...(version === undefined ? {} : { version }),
  };
}
function versionOf(value) {
  if (!Number.isSafeInteger(value?.version) || value.version < 0)
    throw new Error("Atualize os dados para obter a versão atual.");
  return value.version;
}
const ROOT = "/api/iam";
const AUTHZ = `${ROOT}/api/v1/authorization/admin`;
function query(values) {
  return new URLSearchParams(
    Object.entries(values)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();
}
function serviceCode(value) {
  if (!/^[a-z][a-z0-9-]{1,49}$/.test(value))
    throw new Error("Informe um código de serviço válido.");
  return encodeURIComponent(value);
}
function pageQuery(page = 0, size = 20) {
  if (
    !Number.isSafeInteger(page) ||
    page < 0 ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 100
  )
    throw new Error("Paginação inválida.");
  return { page, size };
}
export function createIiamApi(request) {
  const send = (path, method = "GET", body, signal) =>
    request(path, { method, body, signal, authenticated: true });
  const identityReads = new Map();
  function identity(id) {
    const key = uuid(id);
    if (!identityReads.has(key)) {
      const pending = Promise.resolve()
        .then(() => send(`${ROOT}/api/v1/identities/${key}`))
        .finally(() => identityReads.delete(key));
      identityReads.set(key, pending);
    }
    return identityReads.get(key);
  }
  const scoped = (scope) =>
    `scopeId=${encodeURIComponent(uuid(scope))}&page=0&size=100`;
  async function pages(path, scope, extra = "") {
    const items = [];
    for (let page = 0; page < 100; page += 1) {
      const result = await send(
        `${path}?${scoped(scope).replace("page=0", `page=${page}`)}${extra}`,
      );
      items.push(...(result.items || []));
      if (items.length >= result.total || !result.items?.length)
        return { ...result, items };
    }
    throw new Error(
      "A consulta excedeu o limite da interface. Refine o escopo.",
    );
  }
  return {
    applications: () => send(`${ROOT}/api/v1/admin/identity-applications`),
    application: (id) =>
      send(`${ROOT}/api/v1/admin/identity-applications/${uuid(id)}`),
    identity,
    renameIdentity: (id, nickname) =>
      send(`${ROOT}/api/v1/identities/${uuid(id)}/nickname`, "PATCH", {
        nickname: nickname.trim(),
      }),
    tenant: (id) => send(`${ROOT}/api/v1/tenants/${uuid(id)}`),
    renameTenant: (id, name) =>
      send(`${ROOT}/api/v1/admin/tenants/${uuid(id)}/name`, "PATCH", {
        name: name.trim(),
      }),
    createTenant: (code, name) =>
      send(`${ROOT}/api/v1/admin/tenants`, "POST", { code, name }),
    tenantAction: (id, action) => {
      if (!["activate", "disable", "reactivate"].includes(action))
        throw new Error("Ação inválida.");
      return send(`${ROOT}/api/v1/admin/tenants/${uuid(id)}/${action}`, "POST");
    },
    approve: (applicationId, tenantId, affiliation, identityKind) =>
      send(
        `${ROOT}/api/v1/admin/identity-applications/${uuid(applicationId)}/approve`,
        "POST",
        { tenantId: uuid(tenantId), affiliation, identityKind },
      ),
    reject: (applicationId, reason) => {
      if (!reason?.trim()) throw new Error("Informe o motivo da rejeição.");
      return send(
        `${ROOT}/api/v1/admin/identity-applications/${uuid(applicationId)}/reject`,
        "POST",
        { reason: reason.trim() },
      );
    },
    invitation: (identityId) =>
      send(
        `${ROOT}/authentication/admin/identities/${uuid(identityId)}/invitation`,
        "POST",
      ),
    identityAction: (id, action) => {
      if (!["activate", "disable", "reactivate"].includes(action))
        throw new Error("Ação inválida.");
      return send(
        `${ROOT}/api/v1/admin/identities/${uuid(id)}/${action}`,
        "POST",
      );
    },
    sessions: () => send(`${ROOT}/authentication/sessions`),
    endSession: (sid) =>
      send(`${ROOT}/authentication/sessions/${uuid(sid)}`, "DELETE"),
    adminSessions: (page = 0, size = 20) =>
      send(
        `${ROOT}/authentication/admin/sessions?${query(pageQuery(page, size))}`,
      ),
    endAdminSession: (id) =>
      send(
        `${ROOT}/authentication/admin/sessions/${roleId(id)}/logout`,
        "PATCH",
      ),
    refreshTokens: (page = 0, size = 20) =>
      send(
        `${ROOT}/authentication/admin/refresh-tokens?${query(pageQuery(page, size))}`,
      ),
    revokeRefreshToken: (id) =>
      send(
        `${ROOT}/authentication/admin/refresh-tokens/${roleId(id)}/revoke`,
        "PATCH",
      ),
    changePassword: (currentPassword, newPassword) =>
      send(`${ROOT}/authentication/password`, "POST", {
        currentPassword,
        newPassword,
      }),
    roles: (scope) => pages(`${AUTHZ}/roles`, scope),
    permissions: (scope) => pages(`${AUTHZ}/catalog/permissions`, scope),
    availableRoles: (scope) => pages(`${AUTHZ}/roles/available`, scope),
    assignments: (scope, identityId, inherited = false) =>
      pages(
        `${AUTHZ}/assignments`,
        scope,
        `&${query({ identityId: identityId ? uuid(identityId) : undefined, inherited })}`,
      ),
    denies: (scope) => pages(`${AUTHZ}/denies`, scope),
    delegations: (scope) => pages(`${AUTHZ}/delegations`, scope),
    scopes: (scope) => pages(`${AUTHZ}/scopes`, scope),
    scope: (id) => send(`${AUTHZ}/scopes/${uuid(id)}`),
    ancestors: (id) => pages(`${AUTHZ}/scopes/${uuid(id)}/ancestors`, id),
    createScope: (code, name, parentId, reason) =>
      send(`${AUTHZ}/scopes`, "POST", {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        parentId: parentId ? uuid(parentId) : null,
        ...change(reason),
      }),
    saveScope: (scope, name, status, parentId, reason) =>
      send(`${AUTHZ}/scopes/${uuid(scope.id)}`, "PATCH", {
        name: name.trim(),
        status,
        parentId: parentId ? uuid(parentId) : null,
        ...change(reason, versionOf(scope)),
      }),
    deleteScope: (scope, reason) =>
      send(
        `${AUTHZ}/scopes/${uuid(scope.id)}`,
        "DELETE",
        change(reason, versionOf(scope)),
      ),
    effective: (identityId, scope) =>
      pages(
        `${AUTHZ}/effective-permissions`,
        scope,
        `&identityId=${uuid(identityId)}`,
      ),
    explain: (identityId, permission, scopeId) =>
      send(
        `${AUTHZ}/decisions/explain?${query({ identityId: uuid(identityId), permission, scopeId: uuid(scopeId) })}`,
      ),
    audit: (scopeId, { event, correlationId, page = 0, size = 20 } = {}) =>
      send(
        `${AUTHZ}/audit?${query({ scopeId: uuid(scopeId), event, correlationId: correlationId ? uuid(correlationId) : undefined, ...pageQuery(page, size) })}`,
      ),
    rolePermissions: (id) => send(`${AUTHZ}/roles/${roleId(id)}/permissions`),
    createRole: (
      name,
      ownership,
      ownerScopeId,
      ownerTenantId,
      permissions,
      reason,
    ) =>
      send(`${AUTHZ}/roles`, "POST", {
        name,
        ownership,
        ownerScopeId: ownership === "SCOPE" ? uuid(ownerScopeId) : null,
        ownerTenantId: ownership === "TENANT" ? uuid(ownerTenantId) : null,
        permissions,
        ...change(reason),
      }),
    saveRolePermissions: (role, permissions, reason) =>
      send(`${AUTHZ}/roles/${roleId(role.id)}/permissions`, "PUT", {
        permissions,
        ...change(reason, versionOf(role)),
      }),
    role: (id) => send(`${AUTHZ}/roles/${roleId(id)}`),
    saveRole: (role, name, status, permissions, reason) =>
      send(`${AUTHZ}/roles/${roleId(role.id)}`, "PATCH", {
        name: name.trim(),
        status,
        permissions,
        ...change(reason, versionOf(role)),
      }),
    roleLifecycle: (role, status, reason) =>
      send(`${AUTHZ}/roles/${roleId(role.id)}/lifecycle`, "POST", {
        status,
        ...change(reason, versionOf(role)),
      }),
    deleteRole: (role, reason) =>
      send(
        `${AUTHZ}/roles/${roleId(role.id)}`,
        "DELETE",
        change(reason, versionOf(role)),
      ),
    assign: (identityId, id, scopeId, reason) =>
      send(`${AUTHZ}/assignments`, "POST", {
        identityId: uuid(identityId),
        roleId: roleId(id),
        scopeId: uuid(scopeId),
        ...change(reason),
      }),
    revokeAssignment: (assignment, reason) =>
      send(
        `${AUTHZ}/assignments/${uuid(assignment.id)}/revoke`,
        "POST",
        change(reason, versionOf(assignment)),
      ),
    deny: (identityId, permission, scopeId, reason) =>
      send(`${AUTHZ}/denies`, "POST", {
        identityId: uuid(identityId),
        permission,
        scopeId: uuid(scopeId),
        ...change(reason),
      }),
    denyRole: (id, permission, scopeId, reason) =>
      send(`${AUTHZ}/denies`, "POST", {
        roleId: roleId(id),
        permission,
        scopeId: uuid(scopeId),
        ...change(reason),
      }),
    revokeDeny: (deny, reason) =>
      send(
        `${AUTHZ}/denies/${uuid(deny.id)}/revoke`,
        "POST",
        change(reason, versionOf(deny)),
      ),
    delegate: (identityId, permission, scopeId, redelegable, reason) =>
      send(`${AUTHZ}/delegations`, "POST", {
        identityId: uuid(identityId),
        permission,
        scopeId: uuid(scopeId),
        redelegable,
        ...change(reason),
      }),
    revokeDelegation: (delegation, reason) =>
      send(
        `${AUTHZ}/delegations/${uuid(delegation.id)}/revoke`,
        "POST",
        change(reason, versionOf(delegation)),
      ),
    owners: (page = 0) =>
      send(`${AUTHZ}/catalog/owners?${query(pageQuery(page))}`),
    enrollOwner: (service, namespace, reason) =>
      send(`${AUTHZ}/catalog/owners`, "POST", {
        serviceCode: serviceCode(service),
        namespace: serviceCode(namespace),
        ...change(reason),
      }),
    revisions: (service, page = 0) =>
      send(
        `${AUTHZ}/catalog/owners/${serviceCode(service)}/revisions?${query(pageQuery(page))}`,
      ),
    manifest: (service, version) =>
      send(
        `${AUTHZ}/catalog/owners/${serviceCode(service)}/revisions/${version}`,
      ),
    initialAuthority: (permission, rootScopeId, reason) =>
      send(`${AUTHZ}/catalog/initial-authority`, "POST", {
        permission,
        rootScopeId: uuid(rootScopeId),
        ...change(reason),
      }),
    clients: (page = 0) =>
      send(`${AUTHZ}/service-clients?${query(pageQuery(page))}`),
    client: (service) =>
      send(`${AUTHZ}/service-clients/${serviceCode(service)}`),
    enrollClient: (values, reason) =>
      send(`${AUTHZ}/service-clients`, "POST", {
        service: serviceCode(values.service),
        operations: values.operations,
        scopeRoots: values.scopeRoots.map(uuid),
        publicKey: values.publicKey,
        expiresAt: values.expiresAt,
        ...change(reason),
      }),
    configureClient: (client, enabled, operations, scopeRoots, reason) =>
      send(
        `${AUTHZ}/service-clients/${serviceCode(client.serviceCode)}`,
        "PATCH",
        {
          enabled,
          operations,
          scopeRoots: scopeRoots.map(uuid),
          ...change(reason, versionOf(client)),
        },
      ),
    rotateClientKey: (service, publicKey, expiresAt, reason) =>
      send(`${AUTHZ}/service-clients/${serviceCode(service)}/keys`, "POST", {
        publicKey,
        expiresAt,
        ...change(reason),
      }),
    revokeClientKey: (service, key, reason) =>
      send(
        `${AUTHZ}/service-clients/${serviceCode(service)}/keys/${uuid(key)}/revoke`,
        "POST",
        change(reason),
      ),
    bindClientResource: (service, type, resourceId, scopeId, reason) =>
      send(
        `${AUTHZ}/service-clients/${serviceCode(service)}/resources`,
        "POST",
        { type, resourceId, scopeId: uuid(scopeId), ...change(reason) },
      ),
    transfer: (id) => send(`${AUTHZ}/root/transfers/${uuid(id)}`),
    initiateTransfer: (recipientId, scopeId, password, reason) =>
      send(`${AUTHZ}/root/transfers`, "POST", {
        recipientId: uuid(recipientId),
        scopeId: uuid(scopeId),
        password,
        ...change(reason),
      }),
    confirmTransfer: (id, password) =>
      send(`${AUTHZ}/root/transfers/${uuid(id)}/confirm`, "POST", { password }),
  };
}
