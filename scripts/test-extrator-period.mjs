import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("src/features/extrator-manager/lib/extratorPeriod.js", "utf8");
const period = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const meta = {
  padrao: "anual",
  opcoes: [{ id: "anual", label: "Anual" }, { id: "mensal", label: "Mensal" }],
  presets: {
    anual: {
      padrao: "ano_atual",
      opcoes: ["ano_atual", "ano_anterior", "ano_referencia"].map(id => ({ id, label: id === "ano_referencia" ? "Escolher ano" : id })),
    },
    mensal: { padrao: "mes_atual", opcoes: [{ id: "mes_atual", label: "Mes atual" }] },
  },
};

const defaults = period.buildDefaultPeriodState(meta);
assert.equal(defaults.periodType, "anual");
assert.equal(defaults.periodMode, "ano_atual");
assert.equal(defaults.yearReference, "");
assert.deepEqual(period.buildPeriodArgs(defaults), {});
const selected = { ...defaults, periodMode: "ano_referencia", yearReference: "2024" };
const request = period.serializeTaskForRequest("12_06_01_especie", selected);
assert.deepEqual(request, {
  base: "12_06_01_especie", period_type: "anual", period_mode: "ano_referencia", period_args: { ano: "2024" },
});
assert.deepEqual(period.hydratePeriodStateFromItem(request), selected);
assert.equal(period.hydratePeriodStateFromItem({ period_type: "anual", period_mode: "ano_referencia", ano: "2024" }).yearReference, "2024");
assert.equal(period.buildPeriodSummary(selected, meta), "Anual: Escolher ano (2024)");
assert.deepEqual(period.buildPeriodArgs({ ...selected, periodMode: "ano_atual" }), {});
assert.deepEqual(period.buildPeriodArgs({ ...selected, periodMode: "ano_anterior" }), {});
const movement = { padrao: "mensal", opcoes: [{ id: "mensal" }], presets: { mensal: meta.presets.mensal } };
const switched = period.derivePeriodState(selected, movement);
assert.equal(switched.periodType, "mensal");
assert.equal(switched.periodMode, "mes_atual");
assert.deepEqual(period.buildPeriodArgs(switched), {});
assert.deepEqual(period.buildPeriodArgs({ ...selected, periodMode: "mes_referencia", monthReference: "2026-10" }), { mes_referencia: "2026-10" });
assert.deepEqual(period.buildPeriodArgs({ ...selected, periodMode: "data_especifica", date: "2026-10-26" }), { data: "2026-10-26" });
assert.deepEqual(period.buildPeriodArgs({ ...selected, periodMode: "periodo_especifico", startDate: "2026-01-01", endDate: "2026-10-26" }), { data_inicial: "2026-01-01", data_final: "2026-10-26" });
assert.equal(period.derivePeriodState(selected, null).yearReference, "");
console.log("Extrator: annual selection, serialization, hydration, summary and existing period modes passed.");
