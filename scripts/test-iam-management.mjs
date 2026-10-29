import assert from "node:assert/strict";
import fs from "node:fs";
const moduleOf = async (path) =>
  import(
    `data:text/javascript;base64,${Buffer.from(fs.readFileSync(path, "utf8")).toString("base64")}`
  );
const { createIiamApi, PLATFORM_SCOPE } = await moduleOf(
  "src/features/iam/api/iiamApi.js",
);
const { filterRows, availableActions, dateOf, errorOf } = await moduleOf(
  "src/features/iam/model/management.js",
);
const identity = "11111111-1111-4111-8111-111111111111",
  id = "22222222-2222-4222-8222-222222222222";
let calls = [];
const api = createIiamApi(async (path, options) => {
  calls.push({ path, ...options });
  return { items: [], total: 0 };
});
const last = () => calls.at(-1),
  url = () => new URL(last().path, "https://test.invalid");
await api.application(id);
assert.equal(last().path, `/api/iam/api/v1/admin/identity-applications/${id}`);
await api.identityAction(id, "activate");
assert.equal(last().method, "POST");
assert.match(last().path, /\/activate$/);
await api.renameIdentity(identity, "  titular  ");
assert.equal(last().method, "PATCH");
assert.deepEqual(last().body, { nickname: "titular" });
await api.renameTenant(id, "  Empresa  ");
assert.deepEqual(last().body, { name: "Empresa" });
await api.adminSessions(3, 20);
assert.equal(url().searchParams.get("page"), "3");
assert.equal(url().searchParams.get("size"), "20");
await api.refreshTokens(1);
assert.equal(
  last().path,
  "/api/iam/authentication/admin/refresh-tokens?page=1&size=20",
);
await api.revokeRefreshToken(7);
assert.equal(last().method, "PATCH");
assert.match(last().path, /refresh-tokens\/7\/revoke$/);
await api.availableRoles(PLATFORM_SCOPE);
assert.match(url().pathname, /roles\/available$/);
await api.assignments(PLATFORM_SCOPE, identity, true);
assert.equal(url().searchParams.get("identityId"), identity);
assert.equal(url().searchParams.get("inherited"), "true");
await api.denies(PLATFORM_SCOPE);
assert.equal(
  url().searchParams.has("active"),
  false,
  "Do not hide revoked denial history",
);
await api.createScope(" equipe ", " Equipe ", PLATFORM_SCOPE, "Criação");
assert.equal(last().body.code, "EQUIPE");
assert.equal(last().body.name, "Equipe");
await api.saveScope(
  { id, version: 4 },
  "Equipe",
  "DISABLED",
  PLATFORM_SCOPE,
  "Reorganização",
);
assert.equal(last().method, "PATCH");
assert.equal(last().body.version, 4);
await api.deleteScope({ id, version: 4 }, "Remoção");
assert.equal(last().method, "DELETE");
assert.equal(last().body.version, 4);
await api.saveRole(
  { id: 7, version: 5 },
  "Operador",
  "ACTIVE",
  ["READ"],
  "Revisão",
);
assert.equal(last().method, "PATCH");
assert.equal(last().body.version, 5);
assert.deepEqual(last().body.permissions, ["READ"]);
await api.denyRole(7, "module.read", PLATFORM_SCOPE, "Negação");
assert.equal(last().body.roleId, 7);
assert.equal(last().body.identityId, undefined);
await api.delegate(identity, "READ", PLATFORM_SCOPE, true, "Delegação");
assert.equal(last().body.redelegable, true);
await api.revokeDelegation({ id, version: 3 }, "Revogação");
assert.equal(last().body.version, 3);
assert.match(last().path, /delegations\/.+\/revoke$/);
await api.effective(identity, PLATFORM_SCOPE);
assert.match(url().pathname, /effective-permissions$/);
assert.equal(url().searchParams.get("identityId"), identity);
await api.explain(identity, "module.read&admin=true", PLATFORM_SCOPE);
assert.equal(url().searchParams.get("permission"), "module.read&admin=true");
assert.equal(url().searchParams.has("admin"), false);
await api.audit(PLATFORM_SCOPE, {
  event: "ROLE_UPDATED",
  correlationId: id,
  page: 2,
});
assert.match(url().pathname, /\/authorization\/admin\/audit$/);
assert.equal(url().searchParams.get("correlationId"), id);
assert.equal(url().searchParams.get("page"), "2");
await api.enrollOwner("core-api", "core-api", "Catálogo");
assert.equal(last().body.serviceCode, "core-api");
assert.match(last().path, /catalog\/owners$/);
await api.revisions("core-api", 2);
assert.match(last().path, /owners\/core-api\/revisions\?page=2/);
await api.initialAuthority("READ", PLATFORM_SCOPE, "Governança");
assert.equal(last().body.rootScopeId, PLATFORM_SCOPE);
await api.enrollClient(
  {
    service: "core-api",
    operations: ["PDP_DECIDE"],
    scopeRoots: [PLATFORM_SCOPE],
    publicKey: "public-key",
    expiresAt: "2026-11-01T00:00:00Z",
  },
  "Integração",
);
assert.deepEqual(last().body.scopeRoots, [PLATFORM_SCOPE]);
await api.configureClient(
  { serviceCode: "core-api", version: 9 },
  false,
  ["PDP_DECIDE"],
  [PLATFORM_SCOPE],
  "Suspensão",
);
assert.equal(last().method, "PATCH");
assert.equal(last().body.version, 9);
assert.equal(last().body.enabled, false);
await api.rotateClientKey(
  "core-api",
  "public-key",
  "2026-11-01T00:00:00Z",
  "Rotação",
);
assert.match(last().path, /core-api\/keys$/);
await api.revokeClientKey("core-api", id, "Revogação");
assert.match(last().path, /keys\/.+\/revoke$/);
await api.bindClientResource(
  "core-api",
  "REPORT",
  "report-1",
  PLATFORM_SCOPE,
  "Vínculo",
);
assert.equal(last().body.resourceId, "report-1");
await api.initiateTransfer(
  identity,
  PLATFORM_SCOPE,
  "test-password",
  "Transferência",
);
assert.equal(last().body.recipientId, identity);
assert.equal(last().body.password, "test-password");
await api.confirmTransfer(id, "recipient-password");
assert.deepEqual(last().body, { password: "recipient-password" });
assert(calls.every((call) => call.authenticated === true));
assert.throws(
  () => api.audit(PLATFORM_SCOPE, { correlationId: "invalid" }),
  /UUID/,
);
assert.throws(() => api.adminSessions(-1), /Paginação/);
assert.throws(() => api.refreshTokens(0, 101), /Paginação/);
assert.throws(
  () => api.saveScope({ id }, "Name", "ACTIVE", null, "Reason"),
  /versão/,
);
assert.throws(() => api.client("../../unexpected"), /serviço/);
assert.throws(
  () => api.delegate(identity, "READ", PLATFORM_SCOPE, false, " "),
  /motivo/,
);
assert.throws(
  () => api.createScope("CODE", "Name", null, "x".repeat(501)),
  /500/,
);
const records = [
  { name: "João da Silva", active: true },
  { name: "Maria", active: false },
];
assert.deepEqual(
  filterRows(records, "joao", "ACTIVE", (r) => r.name),
  [records[0]],
);
assert.deepEqual(filterRows(records, "", "INACTIVE"), [records[1]]);
assert.deepEqual(filterRows(records, "missing", ""), []);
assert.deepEqual(availableActions("PENDING"), ["activate"]);
assert.deepEqual(availableActions("DISABLED"), ["reactivate"]);
assert.equal(dateOf("bad-date"), "—");
assert.match(dateOf("2026-10-29T12:00:00Z"), /09:00/);
assert.match(errorOf({ status: 409 }), /Atualize/);
assert.match(errorOf({ status: 403 }), /contexto/);
let pageCalls = 0;
const pagination = createIiamApi(async (path) => {
  pageCalls++;
  return Number(new URL(path, "https://test").searchParams.get("page")) === 0
    ? { items: Array.from({ length: 100 }, (_, id) => ({ id })), total: 101 }
    : { items: [{ id: 101 }], total: 101 };
});
assert.equal(
  (await pagination.availableRoles(PLATFORM_SCOPE)).items.length,
  101,
);
assert.equal(pageCalls, 2);
let finish,
  reads = 0;
const deduplicated = createIiamApi(() => {
  reads++;
  return new Promise((resolve) => {
    finish = resolve;
  });
});
const readOne = deduplicated.identity(identity),
  readTwo = deduplicated.identity(identity);
assert.equal(
  readOne,
  readTwo,
  "Visible references share only the in-flight identity lookup",
);
await Promise.resolve();
assert.equal(reads, 1);
finish({ id: identity, status: "PENDING" });
await readOne;
const readAfterChange = deduplicated.identity(identity);
await Promise.resolve();
assert.equal(
  reads,
  2,
  "Completed identity data must not remain cached across lifecycle changes",
);
finish({ id: identity, status: "ACTIVE" });
assert.equal((await readAfterChange).status, "ACTIVE");
console.log(
  "IIAM management: administrative endpoint contracts, scope boundaries, history, versions, delegation, diagnosis, audit, technical clients, ROOT and human-facing filters verified.",
);
