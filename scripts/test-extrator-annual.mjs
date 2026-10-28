import assert from "node:assert/strict";
import fs from "node:fs";

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const lib = (name) => fs.readFileSync(`src/features/extrator-manager/lib/${name}.js`, "utf8");
const periodUrl = moduleUrl(lib("extratorPeriod"));
const optionsUrl = moduleUrl(lib("extratorOptions"));
const period = await import(periodUrl);
const scheduler = await import(moduleUrl(lib("extratorScheduler")
  .replace('"@/features/extrator-manager/lib/extratorOptions"', JSON.stringify(optionsUrl))
  .replace('"@/features/extrator-manager/lib/extratorPeriod"', JSON.stringify(periodUrl))));
const destinations = await import(moduleUrl(lib("extratorDestinations")));

for (const mode of ["ano_atual", "ano_anterior", "ano_referencia"]) {
  const state = { periodType: "anual", periodMode: mode, yearReference: "2024" };
  const expectedArgs = mode === "ano_referencia" ? { ano: "2024" } : {};
  const payload = scheduler.serializeSchedulerForm({ ...scheduler.buildSchedulerDefaultForm({}), ...state }, "fixture");
  assert.equal(payload.period_type, "anual");
  assert.equal(payload.period_mode, mode);
  assert.deepEqual(payload.period_args, expectedArgs);
  const hydrated = scheduler.buildSchedulerFormFromRule(payload);
  assert.equal(hydrated.periodType, "anual");
  assert.equal(hydrated.periodMode, mode);
  assert.deepEqual(period.buildPeriodArgs(hydrated), expectedArgs);
  const batchItem = { base: "03_11_40", period_type: "anual", period_mode: mode, ano: "2024" };
  assert.deepEqual(period.serializeTaskForRequest(batchItem.base, period.hydratePeriodStateFromItem(batchItem)).period_args, expectedArgs);
}

const form = destinations.buildDestinationDefaultForm({});
assert.equal(form.arquivoTemplateAnual, "{ano}");
assert.equal(form.pastaTemplateAnual, "{ano}");
const payload = destinations.serializeDestinationForm({ ...form, caminho: "D:\\Reports", listenPeriodType: "anual", listenPeriodModes: ["ano_anterior"] }, "fixture");
const hydrated = destinations.buildDestinationFormFromRule(payload);
assert.equal(hydrated.listenPeriodType, "anual");
assert.deepEqual(hydrated.listenPeriodModes, ["ano_anterior"]);
assert.equal(hydrated.arquivoTemplateAnual, "{ano}");
assert.equal(destinations.buildDestinationPreviewPath(hydrated, "anual"), "D:\\Reports\\2026\\2026.csv");
assert.equal(destinations.buildDestinationPreviewPath({ ...hydrated, pastaTemplateAnual: "", arquivoTemplateAnual: "{data_inicial}__{data_final}" }, "anual"), "D:\\Reports\\01_01_2026__31_12_2026.csv");
assert.equal(destinations.buildDestinationPreviewPath({ ...hydrated, pastaTemplateAnual: "", arquivoTemplateAnual: "{ano}" }, "anual"), "D:\\Reports\\2026.csv");
assert.equal(destinations.buildDestinationPreviewPath(hydrated, "mensal"), "D:\\Reports\\2026\\marco.csv");
assert.equal(destinations.buildDestinationPreviewPath({ ...hydrated, pastaTemplateAnual: "Anual\\{ano}" }, "anual"), "D:\\Reports\\Anual\\2026\\2026.csv");
console.log("Extrator: annual scheduler, batches, destination editing, listeners and full-year previews passed.");
