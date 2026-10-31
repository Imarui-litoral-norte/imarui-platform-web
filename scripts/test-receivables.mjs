import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(file, imports = {}) {
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const moduleRecord = { exports: {} };
  new Function("exports", "module", "require", code)(moduleRecord.exports, moduleRecord, name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  });
  return moduleRecord.exports;
}
const { normalizeDashboard, normalizeDetail, createReceivablesApi, queryString, exportQueryString } = load("src/features/receivables/api/receivablesApi.ts");
const { initialQuery, date, titleKey } = load("src/features/receivables/lib/formatters.ts");
const query = initialQuery();
assert.equal(new URLSearchParams(queryString({ ...query, search: "A & B / ?=1" })).get("search"), "A & B / ?=1");
assert.equal(new URLSearchParams(queryString(query)).has("historyFrom"), false);
assert.throws(() => normalizeDashboard({}), /inválida/);
const title = { unit: 1, customer: 1, title: 10, installment: "0", customerName: "Cliente",
  pendingAmount: 10.10, dueOn: "2026-10-15", status: "DUE_TODAY", priority: "DUE_SOON",
  reasons: ["Vence hoje."], history: { status: "NO_HISTORY", events: 0, latePercent: null } };
const dashboard = { summary: { titles: 1, customers: 1, pendingAmount: 10.10, overdueTitles: 0,
  dueTodayTitles: 1, upcomingTitles: 0, unknownDueTitles: 0 }, items: [title],
  page: 0, size: 25, total: 1, totalPages: 1,
  metadata: { queriedAt: "2026-10-15T12:00:00Z", sourceUpdatedAt: null, policy: {}, portfolioCoverage: {}, warnings: [] },
  filters: { units: [1], sellers: [], supervisors: [] } };
assert.equal(normalizeDashboard(dashboard).items[0].history.latePercent, null);
assert.throws(() => normalizeDashboard({ ...dashboard, total: 2 }), /inválida/);
assert.throws(() => normalizeDashboard({ ...dashboard, items: [{ ...title, pendingAmount: NaN }] }), /inválida/);
assert.throws(() => normalizeDashboard({ ...dashboard, items: [{ ...title, priority: "CALCULATED_BY_UI" }] }), /inválida/);
const risk = { status: "AVAILABLE", model: "BEHAVIOURAL_V1", year: 2026, from: "2026-01-01", to: "2026-10-31",
  level: 3, score: 42, observedTitles: 10, lateTitles: 4, lateTitlePercent: 40, lateAmountPercent: 60,
  weightedDelayDays: 10, recentLateTitles: 3, openOverdueAmount: 50, maximumOpenDelayDays: 10,
  onTimeMedian: 100, highAmountTitles: 3, highAmountLatePercent: 100, otherAmountTitles: 7,
  otherAmountLatePercent: 14.29, exposureToOnTimeMedian: 3,
  components: [{ code: "FREQUENCY", points: 12, maximum: 30 }], reasons: ["4 de 10 títulos atrasaram."] };
assert.equal(normalizeDashboard({ ...dashboard, items: [{ ...title, risk }] }).items[0].risk.level, 3);
for (const invalid of [{ ...risk, level: 6 }, { ...risk, weightedDelayDays: NaN }, { ...risk, components: null }]) {
  assert.throws(() => normalizeDashboard({ ...dashboard, items: [{ ...title, risk: invalid }] }), /inválida/);
}
const React = await import("react");
const { renderToStaticMarkup } = await import("react-dom/server");
const { default: CustomerRisk } = load("src/features/receivables/ui/CustomerRisk.tsx", {
  "react/jsx-runtime": await import("react/jsx-runtime"),
  "../lib/formatters": load("src/features/receivables/lib/formatters.ts"), "./receivables.module.css": { default: {} },
});
const riskMarkup = renderToStaticMarkup(React.createElement(CustomerRisk, { risk }));
assert.match(riskMarkup, /Cliente risco 3\/5/);
assert.match(riskMarkup, /4 de 10 observados/);
assert.match(riskMarkup, /Frequência de atrasos: 12\/30 pontos/);
assert.match(renderToStaticMarkup(React.createElement(CustomerRisk, { risk: { ...risk, level: null, score: null, status: "INSUFFICIENT" } })), /Risco não estimado/);
assert.match(renderToStaticMarkup(React.createElement(CustomerRisk)), /servidor ainda não disponibiliza/);
const controller = new AbortController();
let requested;
const file = { blob: new Blob(["\uFEFFCliente;Saldo\r\nJosé;10,10\r\n"], { type: "text/csv" }), filename: "boletos-2026-10-30.csv" };
const api = createReceivablesApi(async (path, signal) => { requested = { path, signal }; return dashboard; },
  async (path, signal) => { requested = { path, signal }; return file; });
await api.dashboard(query, controller.signal);
assert.equal(requested.signal, controller.signal);
assert.match(requested.path, /^\/api\/v1\/receivables\/titles\?/);
const filtered = { ...query, search: "José & Cia; /?=", unit: "1", seller: "7", supervisor: "9",
  status: "OVERDUE", priority: "OVERDUE", dueFrom: "2026-10-01", dueTo: "2026-10-30",
  issuedFrom: "2026-09-01", issuedTo: "2026-09-30", historyFrom: "2026-01-01", historyTo: "2026-10-30",
  riskLevel: "3", sort: "RISK_DESC", page: 3, size: 100 };
assert.equal(await api.exportCsv(filtered, controller.signal), file);
assert.equal(requested.signal, controller.signal);
assert.match(requested.path, /^\/api\/v1\/receivables\/titles\/export\?/);
const exportParams = new URLSearchParams(requested.path.split("?")[1]);
for (const [key, value] of Object.entries(filtered)) {
  assert.equal(exportParams.get(key), ["page", "size"].includes(key) ? null : String(value));
}
assert.equal(exportQueryString(filtered), exportQueryString({ ...filtered, page: 0, size: 25 }));
assert.equal(titleKey(title), "1:1:10:0");
assert.equal(date("2026-10-15"), "15/10/2026");
assert.equal(date(null), "—");
assert.throws(() => normalizeDetail({ selected: title, payments: [] }), /inválida/);
let accessToken = "test-access";
let refreshCalls = 0;
let cleared = false;
const transport = load("src/views/spo/lib/receivablesTransport.ts", {
  "@/features/auth": { readAuthSession: () => accessToken ? { accessToken } : null,
    getOrCreateDeviceId: () => "test-device", clearAuthSession: () => { cleared = true; },
    authApi: { refresh: async () => { refreshCalls++; accessToken = "refreshed-access"; } } },
  "@/shared/network/gatewayUrl": { buildGatewayUrl: path => `https://example.test${path}` },
});
const originalFetch = globalThis.fetch;
try {
  const requests = [];
  globalThis.fetch = async (path, options) => {
    requests.push({ path, options });
    return requests.length === 1 ? new Response(null, { status: 401 }) : new Response(file.blob, { headers: {
      "Content-Type": "text/csv;charset=UTF-8", "Content-Disposition": `attachment; filename="${file.filename}"`,
    } });
  };
  const downloaded = await transport.receivablesDownload("/api/v1/receivables/titles/export?unit=1", controller.signal);
  assert.equal(downloaded.filename, file.filename);
  assert.equal(await downloaded.blob.text(), await file.blob.text());
  assert.equal(refreshCalls, 1);
  assert.equal(requests[1].path, requests[0].path);
  assert.equal(requests[1].options.headers.Authorization, "Bearer refreshed-access");
  assert.match(requests[1].options.headers.Accept, /text\/csv/);
  assert.equal(requests[1].options.signal, controller.signal);
  assert.equal(requests[1].options.cache, "no-store");
  for (const [status, message] of [[400, /Filtros inválidos/], [403, /Acesso negado/], [503, /Não foi possível consultar/]]) {
    globalThis.fetch = async () => new Response(null, { status });
    await assert.rejects(transport.receivablesDownload("/export", controller.signal), message);
  }
  globalThis.fetch = async () => new Response(null, { status: 404 });
  await assert.rejects(transport.receivablesDownload("/api/v1/receivables/titles/export", controller.signal), /exportação CSV não está disponível no servidor/);
  await assert.rejects(transport.receivablesRequest("/api/v1/receivables/titles/1/10/100/0?status=ALL", controller.signal), /Este título não está mais disponível/);
  await assert.rejects(transport.receivablesRequest("/api/v1/receivables/titles", controller.signal), /serviço de boletos não está disponível neste endereço/);
  globalThis.fetch = async () => new Response("{}", { headers: { "Content-Type": "application/json" } });
  await assert.rejects(transport.receivablesDownload("/export", controller.signal), /CSV válido/);
  globalThis.fetch = async () => new Response(null, { status: 401 });
  await assert.rejects(transport.receivablesDownload("/export", controller.signal), /sessão expirou/);
  assert.equal(cleared, true);
  accessToken = null;
  await assert.rejects(transport.receivablesDownload("/export", controller.signal), /Sessão autenticada não encontrada/);
} finally { globalThis.fetch = originalFetch; }
console.log("Receivables: contrato, filtros completos de exportação, download autenticado, refresh de sessão e erros verificados.");

