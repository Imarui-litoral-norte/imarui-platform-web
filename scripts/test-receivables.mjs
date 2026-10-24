import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function load(file) {
  const source = fs.readFileSync(file, "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleRecord = { exports: {} };
  new Function("exports", "module", code)(moduleRecord.exports, moduleRecord);
  return moduleRecord.exports;
}
const { normalizeDashboard, normalizeDetail, createReceivablesApi, queryString } = load("src/features/receivables/api/receivablesApi.ts");
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
const controller = new AbortController();
let requested;
const api = createReceivablesApi(async (path, signal) => { requested = { path, signal }; return dashboard; });
await api.dashboard(query, controller.signal);
assert.equal(requested.signal, controller.signal);
assert.match(requested.path, /^\/api\/v1\/receivables\/titles\?/);
assert.equal(titleKey(title), "1:1:10:0");
assert.equal(date("2026-10-15"), "15/10/2026");
assert.equal(date(null), "—");
assert.throws(() => normalizeDetail({ selected: title, payments: [] }), /inválida/);
console.log("Receivables: contrato, codificação de filtros, consistência de totais e ausência de histórico verificados.");

