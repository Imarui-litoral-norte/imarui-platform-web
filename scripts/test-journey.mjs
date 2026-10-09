import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);

function evaluate(relativePath, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(process.cwd(), relativePath), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX },
    fileName: relativePath,
  }).outputText;
  const moduleRecord = { exports: {} };
  new Function("exports", "module", "require", code)(moduleRecord.exports, moduleRecord,
    (specifier) => {
      if (specifier in dependencies) return dependencies[specifier];
      throw new Error(`Dependência inesperada: ${specifier}`);
    });
  return moduleRecord.exports;
}

const lib = evaluate("src/features/journey-manager/lib/journeyPresentation.ts");
const analysis = evaluate("src/features/journey-manager/lib/journeyAnalysis.ts");
const teamReport = evaluate("src/features/journey-manager/lib/journeyTeamReport.ts", { "./journeyAnalysis": analysis });
const timeline = evaluate("src/features/journey-manager/lib/journeyTimeline.ts", {
  "./journeyPresentation": lib,
});
const api = evaluate("src/features/journey-manager/api/journeyApi.ts", {
  "@/features/auth": {},
  "@/shared/network/gatewayUrl": {},
});
const details = evaluate("src/features/journey-manager/ui/JourneyDetails.tsx", {
  "../lib/journeyPresentation": lib,
  "react/jsx-runtime": nodeRequire("react/jsx-runtime"),
});
const { renderToStaticMarkup } = nodeRequire("react-dom/server");
const { jsx } = nodeRequire("react/jsx-runtime");

const query = { indicator: "tml", from: "2026-09-28", to: "2026-09-29", mode: "ponto",
  map: "", employeeCode: "", role: "all", expurge: "all" };
assert.equal(api.buildJourneyPath(query), "/api/v1/journey/tml?from=2026-09-28&to=2026-09-29&expurge=all&mode=ponto");
assert.ok(!api.buildJourneyPath({ ...query, indicator: "tr" }).includes("mode="));
assert.ok(api.buildJourneyPath({ ...query, map: " 10 ", role: "ajudante", expurge: "expurged" }).includes("map=10"));
assert.throws(() => api.normalizeJourneyResponse({ from: "2026-09-28", items: [] }), /inválida/);
assert.throws(() => api.normalizeJourneyResponse({ from: "2026-09-28", to: "2026-09-28", snapshotAt: null, items: [{}] }), /Linha/);

const context = (map, employeeCode, role = "motorista") => ({ date: "2026-09-28", map, mapOrigin: "LIVE", employeeCode, role, employeeName: `#${employeeCode}` });
const result = { seconds: 90001, targetSeconds: 36000, lifecycleStatus: "EM_ANDAMENTO",
  targetStatus: "ESTOURADO", achieved: null, secondsDifference: 54001, temporalOrderAnomaly: false };
const item = (map, employeeCode, role = "motorista", expurged = false) => ({
  context: context(map, employeeCode, role), snapshotAt: "2026-09-28T18:00:00",
  tr: result, expurge: { present: expurged, flags: { recharge: map === 11 } },
});
const rows = [item(10, 100), item(10, 200, "ajudante", true), item(11, 100)];
assert.throws(() => api.normalizeJourneyResponse({ from: "2026-09-28", to: "2026-09-28", snapshotAt: null, items: rows }, "tml"), /Linha/);
const normalized = api.normalizeJourneyResponse({ from: "2026-09-28", to: "2026-09-28", snapshotAt: null, items: rows });
assert.equal(normalized.items[1].expurge.present, true);
assert.equal(normalized.items[1].tr.achieved, null);
assert.equal(normalized.items[1].tr.targetStatus, "ESTOURADO");
assert.equal(normalized.items[1].tr.lifecycleStatus, "EM_ANDAMENTO");
const groups = lib.groupByMap(rows);
assert.equal(groups.length, 2);
assert.deepEqual(groups[0].items.map((row) => row.context.employeeCode), [100, 200]);
assert.equal(groups[1].items[0].context.employeeCode, 100);
assert.equal(lib.mapTrFact(groups[0]), rows[0]);
const mixedCrew = [item(20, 300, "motorista", true), item(20, 301, "ajudante"), item(20, 302, "ajudante")];
const trGroup = lib.groupByMap(mixedCrew);
assert.equal(trGroup.length, 1);
assert.equal(lib.mapTrFact(trGroup[0]).tr.seconds, 90001);
assert.deepEqual(trGroup[0].items.map((row) => row.expurge.present), [true, false, false]);
assert.equal("expurge" in trGroup[0], false);
assert.equal(trGroup[0].items.length, 3);
const metricHtml = renderToStaticMarkup(jsx(details.JourneyDetails, {
  indicator: "tr", item: mixedCrew[0], now: Date.parse("2026-09-28T18:00:10"), showExpurge: false,
}));
assert.ok(metricHtml.includes("TR do mapa"));
assert.ok(metricHtml.includes("Meta · último snapshot"));
assert.ok(!metricHtml.includes("Expurgo:"));
assert.deepEqual(mixedCrew.map((row) =>
  renderToStaticMarkup(jsx(details.ExpurgeContext, { item: row })).includes("Expurgo: sim")),
  [true, false, false]);
const tmlHtml = renderToStaticMarkup(jsx(details.JourneyDetails, {
  indicator: "tml", item: { ...item(21, 321), tml: result, loadChecklist: null,
    maintenanceChecklist: null }, now: Date.parse("2026-09-28T18:00:10"),
}));
assert.ok(tmlHtml.includes("Pendente/ausente"));
assert.ok(tmlHtml.includes("TML permanece"));
const jlRow = { ...item(22, 322), jl: result, tml: result, ti: result,
  physicalClose: result, financialClose: result };
const jlMarkup = (mode) => renderToStaticMarkup(jsx(details.JourneyDetails, {
  indicator: "jl", item: { ...jlRow, mode }, now: Date.parse("2026-09-28T18:00:10"),
}));
assert.ok(jlMarkup("ponto").includes("Ponto · Jornada Laboral"));
assert.ok(jlMarkup("mpd").includes("MPD · Jornada Operacional"));
assert.equal(lib.formatDuration(90001), "25h 00m 01s");
assert.equal(lib.formatDuration(360001), "100h 00m 01s");
assert.equal(lib.formatDuration(1800), "0h 30m 00s");
assert.equal(lib.formatDuration(33600), "9h 20m 00s");
assert.equal(lib.formatDuration(null), "—");
assert.equal(lib.outcomeLabel(null), "Sem resultado");
assert.equal(lib.statusLabel("EM_ANDAMENTO"), "Em andamento");
assert.equal(lib.statusLabel("FINALIZADO"), "Finalizado");
assert.equal(lib.statusLabel("ATINGIDO"), "Dentro da meta");
assert.equal(lib.statusLabel("ESTOURADO"), "Meta excedida");
assert.equal(lib.statusLabel("SEM_PONTO_FINAL"), "Sem ponto final");
assert.equal(lib.statusLabel("FUTURO_STATUS"), "FUTURO_STATUS");
assert.equal(lib.statusLabel(null), "—");
assert.equal(lib.checklistPending(null), true);
assert.equal(lib.checklistPending({ count: 0 }), true);
assert.equal(lib.checklistPending({ count: 1 }), false);
assert.equal(lib.liveSeconds(result, "2026-09-28T18:00:00.000Z", Date.parse("2026-09-28T18:00:10.000Z")), 90011);
assert.equal(lib.liveSeconds({ ...result, lifecycleStatus: "FINALIZADO" }, "2026-09-28T18:00:00.000Z", Date.parse("2026-09-28T18:00:10.000Z")), 90001);
assert.equal(lib.liveSeconds({ ...result, seconds: null }, "2026-09-28T18:00:00.000Z", Date.now()), null);
assert.equal(lib.hasLiveRows(rows, "tr"), true);
assert.equal(lib.shouldPollJourney(rows, "tr", "visible"), true);
assert.equal(lib.shouldPollJourney(rows, "tr", "hidden"), false);
const finalizedRows = rows.map((row) => ({ ...row, tr: { ...row.tr, lifecycleStatus: "FINALIZADO" } }));
assert.equal(lib.hasLiveRows(finalizedRows, "tr"), false);
assert.equal(lib.shouldPollJourney(finalizedRows, "tr", "visible"), false);
assert.equal(lib.shouldPollJourney([], "tr", "visible"), false);
const tiRows = [{ ...item(12, 120), ti: { ...result, lifecycleStatus: null },
  physicalClose: { ...result, lifecycleStatus: "EM_ANDAMENTO" },
  financialClose: { ...result, lifecycleStatus: null } }];
assert.equal(lib.hasLiveRows(tiRows, "ti"), true);
const dated = lib.groupByMap([
  item(30, 300),
  { ...item(31, 301), context: { ...context(31, 301), date: "2026-09-27" } },
  { ...item(32, 302), context: { ...context(32, 302), mapOrigin: "HISTORICO" } },
]);
assert.equal(lib.filterMapGroups(dated, "all", "2026-09-28").length, 3);
assert.deepEqual(lib.filterMapGroups(dated, "d0", "2026-09-28").map((group) => group.map), [30]);
assert.deepEqual(lib.filterMapGroups(dated, "earlier", "2026-09-28").map((group) => group.map), [31]);
const searchCrew = lib.groupByMap([
  { ...item(50, 500), context: { ...context(50, 500), employeeName: "João da Silva", vehicle: 17, plate: "ABC1234" } },
  { ...item(50, 501, "ajudante"), context: { ...context(50, 501, "ajudante"), employeeName: "Maria Souza", vehicle: 17 } },
  item(51, 510),
]);
assert.deepEqual(lib.searchMapGroups(searchCrew, "joao").map((group) => group.map), [50]);
assert.deepEqual(lib.searchMapGroups(searchCrew, "maria").map((group) => group.map), [50]);
assert.deepEqual(lib.searchMapGroups(searchCrew, "ABC1234").map((group) => group.map), [50]);
assert.deepEqual(lib.searchMapGroups(searchCrew, "51").map((group) => group.map), [51]);
assert.equal(lib.searchMapGroups(searchCrew, "sem correspondência").length, 0);
const manyMaps = lib.groupByMap(Array.from({ length: 106 }, (_, index) => item(1000 + index, 2000 + index)));
for (const size of [25, 50, 75, 100]) {
  const first = lib.paginateMapGroups(manyMaps, 1, size);
  assert.equal(first.groups.length, size);
  assert.equal(first.totalPages, Math.ceil(106 / size));
  assert.equal(first.start, 1);
  assert.equal(first.end, size);
  assert.equal(lib.paginateMapGroups(manyMaps, first.totalPages, size).end, 106);
}
assert.equal(lib.paginateMapGroups(manyMaps, 999, 25).page, 5);
assert.equal(lib.paginateMapGroups([], 1, 25).start, 0);
assert.equal(api.buildJourneyPath({ ...query, indicator: "jl", mode: "mpd" }).includes("mode=mpd"), true);
assert.equal(api.buildJourneyPath({ ...query, indicator: "jl", mode: "ponto" }).includes("mode=ponto"), true);
const rowTime = Date.parse("2026-09-28T08:15:00Z");
const tmlRow = { ...item(40, 400), snapshotAt: "2026-09-28T08:15:00Z",
  startedAt: "2026-09-28T08:00:00Z", entryAt: "2026-09-28T08:00:00Z",
  mapDepartureAt: null, endedAt: null,
  tml: { ...result, seconds: 900, targetSeconds: 1800, targetStatus: "DENTRO_DA_META" },
  loadChecklist: { effectiveStartedAt: "2026-09-28T08:05:00Z",
    effectiveEndedAt: "2026-09-28T08:10:00Z" }, maintenanceChecklist: null };
const openTml = timeline.timelineView(tmlRow, "tml", rowTime);
assert.equal(openTml.progress, 50);
assert.equal(openTml.closed, false);
assert.equal(openTml.exceeded, false);
assert.equal(Math.round(openTml.segments[0].left), 17);
assert.equal(Math.round(openTml.segments[0].width), 17);
assert.equal(timeline.timelineView({ ...tmlRow, tml: { ...tmlRow.tml, seconds: 1900 } }, "tml", rowTime).exceeded, true);
assert.equal(timeline.timelineView({ ...tmlRow, tml: { ...tmlRow.tml, targetSeconds: null } }, "tml", rowTime).progress, 50);
const closedTml = timeline.timelineView({ ...tmlRow,
  mapDepartureAt: "2026-09-28T08:20:00Z",
  tml: { ...tmlRow.tml, seconds: 1200, lifecycleStatus: "FINALIZADO", achieved: true } }, "tml", rowTime);
assert.equal(closedTml.closed, true);
assert.equal(closedTml.finalTone, "positive");
assert.equal(closedTml.progress, 100);
assert.equal(timeline.formatClockDuration(90001), "25:00");
assert.equal(timeline.formatClockDuration(null), "--:--");
const crew = lib.groupByMap([item(41, 401, "ajudante"), item(41, 400, "motorista")])[0];
assert.equal(timeline.mapDriver(crew).context.employeeCode, 400);
assert.equal(timeline.mapHelperCount(crew), 1);
assert.equal(timeline.mapRepresentative(crew, "tml").context.employeeCode, 400);
assert.equal(timeline.mapDriver(lib.groupByMap([item(42, 402, "ajudante")])[0]), undefined);
const tiRow = { ...item(43, 403), vehicleEntryAt: "2026-09-28T17:00:00Z",
  physicalCloseAt: "2026-09-28T17:10:00Z", financialCloseAt: "2026-09-28T17:20:00Z",
  pointExitAt: "2026-09-28T17:30:00Z", ti: { ...result, seconds: 1800,
    targetSeconds: 1800, lifecycleStatus: "FINALIZADO" } };
assert.deepEqual(timeline.timelineView(tiRow, "ti", rowTime).segments.map((part) => part.kind),
  ["physical", "financial"]);
const jlTimelineRow = { ...item(44, 404), mode: "ponto", startedAt: "2026-09-28T08:00:00Z",
  endedAt: "2026-09-28T18:00:00Z", mapDepartureAt: "2026-09-28T08:30:00Z",
  mapReturnAt: "2026-09-28T17:30:00Z", pointExitAt: "2026-09-28T18:00:00Z",
  jl: { ...result, seconds: 36000, targetSeconds: 37200, lifecycleStatus: "FINALIZADO" } };
assert.deepEqual(timeline.timelineView(jlTimelineRow, "jl", rowTime).segments.map((part) => part.kind),
  ["tml", "tr", "ti"]);
console.log("Journey contract and presentation checks passed");

const counts = (attained, notAttained, pending = 0, unavailable = 0) => ({
  total: attained + notAttained + pending + unavailable, attained, notAttained, pending, unavailable,
  evaluated: attained + notAttained, adherence: attained + notAttained ? attained * 100 / (attained + notAttained) : null,
  distinctMaps: attained + notAttained + pending + unavailable, expurged: 0, anomalies: 0,
});
const history = (from, to, days = [], previous = []) => ({ from, to, contextFrom: from, contextTo: to,
  asOf: "2026-10-07", snapshotAt: null, population: "MAP", role: "motorista", hasLiveOrigin: false,
  summary: analysis.sumCounts(days.filter(d => d.date >= from && d.date <= to).map(d => d.counts)),
  daily: days, collaborators: [], previousYearDaily: previous });
assert.equal(analysis.weekStart("2026-09-30"), "2026-09-28");
assert.equal(analysis.weekStart("2026-01-01"), "2025-12-29");
assert.equal(analysis.weekStart("2026-10-04"), "2026-09-28");
assert.equal(analysis.addDays("2024-02-28", 1), "2024-02-29");
assert.equal(analysis.addDays("2024-02-29", 1), "2024-03-01");
assert.equal(analysis.monthEnd("2024-02-01"), "2024-02-29");
assert.equal(analysis.sumCounts([counts(1, 0), counts(0, 9)]).adherence, 10);
assert.equal(analysis.sumCounts([counts(0, 0, 3, 2)]).adherence, null);
const boundary = analysis.weeklyPoints(history("2026-09-30", "2026-09-30", [
  { date: "2026-09-28", counts: counts(1, 0) }, { date: "2026-09-29", counts: counts(0, 1) },
]));
assert.equal(boundary.granular, true);
assert.deepEqual(boundary.points.map(p => p.key), ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"]);
assert.equal(boundary.points[1].accumulated, 50);
assert.equal(boundary.points[2].counts.adherence, null);
assert.equal(boundary.points[2].selected, true);
const threeWeeks = analysis.weeklyPoints(history("2026-09-28", "2026-10-17"));
assert.equal(threeWeeks.points.length, 18);
assert.equal(threeWeeks.granular, true);
const month = analysis.weeklyPoints(history("2026-09-01", "2026-09-30"));
assert.equal(month.granular, false);
assert.equal(month.points.length, 5);
const sixWeeks = analysis.weeklyPoints(history("2026-08-01", "2026-08-31"));
assert.equal(sixWeeks.points.length, 6); // Preserve both boundary fragments rather than lose days.
const fullYearDays = analysis.dateRange("2026-01-01", "2026-12-31").map(date => ({ date, counts: counts(1, 0) }));
const yearWeekly = analysis.weeklyPoints(history("2026-01-01", "2026-12-31", fullYearDays));
assert.equal(yearWeekly.granular, false);
const coveredDays = yearWeekly.points.flatMap(p => analysis.dateRange(p.from, p.to));
assert.equal(new Set(coveredDays).size, coveredDays.length);
assert.equal(coveredDays.length, fullYearDays.filter(d => analysis.calendarDate(d.date).getUTCDay() !== 0).length);
const yearMonthly = analysis.monthlyPoints(history("2026-01-01", "2026-12-31", fullYearDays));
assert.equal(yearMonthly.granular, false);
assert.equal(yearMonthly.points.length, 12);
assert.equal(analysis.sumCounts(yearMonthly.points.map(p => p.counts)).total, 365);
const oneMonth = analysis.monthlyPoints(history("2026-10-06", "2026-10-06", [{ date: "2026-10-06", counts: counts(2, 2) }]));
assert.equal(oneMonth.granular, true);
assert.equal(oneMonth.points.length, 31);
assert.equal(oneMonth.points[5].counts.adherence, 50);
assert.equal(oneMonth.points[7].counts.adherence, null);
const comparison = analysis.annualComparison(history("2026-10-06", "2026-10-06", [
  { date: "2026-10-06", counts: counts(2, 2) }], [
  { date: "2025-10-06", counts: counts(1, 3) }, { date: "2025-10-08", counts: counts(20, 0) }]));
assert.equal(comparison[0].to, "2026-10-07");
assert.equal(comparison[0].previousTo, "2025-10-07");
assert.equal(comparison[0].previous.adherence, 25);
const leap = analysis.annualComparison({ ...history("2024-02-29", "2024-02-29"), asOf: "2024-02-29" });
assert.equal(leap[0].previousTo, "2023-02-28");
const historyPath = api.buildJourneyHistoryPath({ ...query, indicator: "tr" }, "ajudante", "João", "earlier", false);
assert.ok(historyPath.startsWith("/api/v1/journey/history/tr?"));
assert.ok(historyPath.includes("populationRole=ajudante"));
assert.ok(!historyPath.includes("&role="));
assert.ok(api.buildJourneyHistoryPath({ ...query, role: "motorista" }, "ajudante", "", "all").includes("role=motorista"));
assert.ok(historyPath.includes("includePrevious=false"));
assert.ok(!historyPath.includes("mode="));
assert.equal(api.normalizeJourneyHistory(history("2026-10-06", "2026-10-06")).summary.adherence, null);
assert.throws(() => api.normalizeJourneyHistory({ ...history("2026-10-06", "2026-10-06"), summary: { ...counts(0, 0), adherence: 0 } }), /inválida/);
assert.throws(() => api.normalizeJourneyHistory({ ...history("2026-10-06", "2026-10-06"), summary: { ...counts(1, 0), attained: -1 } }), /inválida/);
console.log("Journey analytical calendar, weighted aggregation and history contract checks passed");

const observation = (map, code, fleet, date, attained, expurgePresent, seconds, journeyExceeded, departed = true) => ({
  map, employeeCode: code, employeeName: `Motorista ${code}`, role: "motorista", fleet, date,
  departureDate: departed ? date : null, expurgePresent, seconds, journeyExceeded, counts: counts(attained ? 1 : 0, attained ? 0 : 1),
});
const team = [
  observation(1, 100, "A", "2026-10-03", true, false, 1200, true),
  observation(2, 100, "B", "2026-10-05", false, true, 1800, false),
  observation(3, 100, "A", "2026-10-05", false, null, null, null),
  observation(4, 101, null, "2026-10-06", true, false, 0, false, false),
];
const report = teamReport.teamReportRows(team, teamReport.initialTeamReportFilters);
assert.deepEqual(report[0].dates, ["2026-10-03", "2026-10-05"]); // One date for multiple exits.
assert.equal(report[0].counts.evaluated, 3);
assert.equal(report[0].counts.attained, 1);
assert.equal(report[0].averageSeconds, 1500);
assert.equal(report[0].journeyExceeded, 1); // Does not mirror TR failures (two).
assert.equal(report[0].journeyUnknown, 1);
assert.equal(report[1].averageSeconds, 0);
assert.deepEqual(report[1].dates, []); // No departure, no fabricated date.
const filtered = teamReport.teamReportRows(team, { ...teamReport.initialTeamReportFilters, fleets: ["A"], expurge: "not_expurged" });
assert.equal(filtered[0].counts.evaluated, 1);
assert.equal(filtered[0].counts.adherence, 100);
assert.equal(filtered[0].averageSeconds, 1200);
assert.equal(teamReport.teamReportRows(team, { ...teamReport.initialTeamReportFilters, excluded: [100] }).length, 1);
assert.equal(teamReport.teamReportRows(team, { ...teamReport.initialTeamReportFilters, excluded: [100, 101] }).length, 0);
assert.equal(teamReport.teamReportRows(team, { ...teamReport.initialTeamReportFilters, fleets: [""] })[0].employeeCode, 101);
assert.equal(teamReport.teamReportRows(team, { ...teamReport.initialTeamReportFilters, view: "journey_exceeded" }).length, 1);
assert.equal(teamReport.teamReportRows(team, { ...teamReport.initialTeamReportFilters, expurge: "expurged" })[0].counts.attained, 0);
assert.equal(teamReport.formatTeamAverage(2254, "tml"), "37:34");
assert.equal(teamReport.formatTeamAverage(45420, "jl"), "12:37");
assert.equal(teamReport.formatTeamAverage(90000, "jl"), "25:00");
assert.equal(teamReport.formatTeamAverage(null, "ti"), "—");
assert.equal(api.normalizeJourneyHistory({ ...history("2026-10-03", "2026-10-06"), team }).team.length, 4);
assert.throws(() => api.normalizeJourneyHistory({ ...history("2026-10-03", "2026-10-06"), team: [{ ...team[0], seconds: -1 }] }), /inválida/);
assert.throws(() => api.normalizeJourneyHistory({ ...history("2026-10-03", "2026-10-06"), team: [{ ...team[0], journeyExceeded: "sim" }] }), /inválida/);
console.log("Journey educators report: fleet/expurge filters, dates, means, JL coverage and contract checks passed");
