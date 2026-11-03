import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module, { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

// Render the real JSX without starting Next or generating a deployment build.
const sourceRoot = path.resolve("src");
const modules = new Map();
function loadSource(filename) {
  if (modules.has(filename)) return modules.get(filename).exports;
  const loaded = new Module(filename);
  modules.set(filename, loaded);
  const requireFromFile = createRequire(filename);
  loaded.require = (specifier) => {
    if (!specifier.startsWith("@/")) return requireFromFile(specifier);
    const target = path.join(sourceRoot, specifier.slice(2));
    const resolved = [target, ...[".js", ".jsx", ".ts", ".tsx"].map((ext) => target + ext)]
      .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    assert.ok(resolved, `Source module not found: ${specifier}`);
    return loadSource(resolved);
  };
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  });
  loaded._compile(outputText, filename);
  return loaded.exports;
}

const { default: Destinations } = loadSource(path.join(sourceRoot, "features/extrator-manager/ui/ExtratorDestinationsSection.jsx"));
const { buildDestinationDefaultForm, buildDestinationFormFromRule, serializeDestinationForm, normalizeDestinationListeners, toggleDestinationListenType } =
  loadSource(path.join(sourceRoot, "features/extrator-manager/lib/extratorDestinations.js"));
const noop = () => {};
const base = "12_06_01_especie";
const listenOptions = [
  { id: "todos", label: "Todas as atualizacoes" },
  { id: "anual", label: "Anual" },
  { id: "mensal", label: "Mensal" },
  { id: "periodo_especifico", label: "Periodo especifico" },
];
const meta = {
  base_options: [{ id: base, label: base }],
  listen_period_options_by_base: { [base]: listenOptions },
  listen_period_mode_options_by_base: { [base]: { anual: [
    { id: "ano_atual", label: "Ano atual" },
    { id: "ano_anterior", label: "Ano anterior" },
    { id: "ano_referencia", label: "Escolher ano" },
  ], mensal: [{ id: "mes_atual", label: "Mes atual" }, { id: "mes_anterior", label: "Mes anterior" }],
  periodo_especifico: [{ id: "semana_atual", label: "Semana atual" }, { id: "semana_anterior", label: "Semana anterior" }], } },
};
function render(form) {
  return renderToStaticMarkup(createElement(Destinations, {
    destinationForm: form,
    destinationsPayload: { destination_meta: meta },
    destinationFilters: { search: "", owner: "todos", base: "todos", period: "todos", enabled: "todos", source: "todos" },
    destinationBaseFilterOptions: meta.base_options,
    destinationOwnerFilterOptions: [], destinationPeriodFilterOptions: [], destinationSourceFilterOptions: [],
    destinationGroups: [], selectedDestinationListenOptions: listenOptions,
    isDestinationModalOpen: true, filterAllValue: "todos", status: "ready",
    formatCountLabel: (count) => String(count), formatDateTime: String,
    handleSaveDestinationRule: noop, openDestinationCreateModal: noop,
    setIsDestinationHelpOpen: noop, setIsDestinationModalOpen: noop,
    setDestinationForm: noop, setDestinationFilters: noop, setDestinationPage: noop,
    setDestinationPageSize: noop, resetDestinationFilters: noop, onRefresh: noop,
  }));
}

const created = buildDestinationDefaultForm(meta);
const existing = buildDestinationFormFromRule({
  id: "existing-rule", base, caminho: "D:\\Reports", enabled: true,
  listen_period_type: "todos", arquivo_template_mensal: "{mes_nome}",
});
for (const [form, title] of [[created, "Novo destino"], [existing, "Editar destino"]]) {
  const html = render(form);
  assert.ok(html.includes(title));
  assert.ok(html.includes("Arquivo anual"), `${title}: annual filename field missing`);
  assert.ok(html.includes("Pasta anual"), `${title}: annual folder field missing`);
  assert.ok(html.includes('value="anual"'), `${title}: annual listener option missing`);
  assert.ok(html.includes("Anual:"), `${title}: annual destination preview missing`);
}

const annualEdit = { ...existing, listenPeriodTypes: ["anual"], listenPeriodModesByType: { anual: ["ano_anterior"] },
  arquivoTemplateAnual: "{rotina}__{ano}", pastaTemplateAnual: "Anual\\{ano}" };
const html = render(annualEdit);
for (const text of ["Arquivo anual", "Pasta anual", "Ano atual", "Ano anterior", "Escolher ano", "Anual\\2026"]) {
  assert.ok(html.includes(text), `Annual edit form missing: ${text}`);
}
assert.ok(!html.includes("Arquivo mensal"), "An annual-only listener should show annual templates");
const saved = serializeDestinationForm(annualEdit, "fixture");
const reopened = buildDestinationFormFromRule(saved);
assert.equal(reopened.arquivoTemplateAnual, annualEdit.arquivoTemplateAnual);
assert.equal(reopened.pastaTemplateAnual, annualEdit.pastaTemplateAnual);
assert.deepEqual(reopened.listenPeriodModesByType, { anual: ["ano_anterior"] });
assert.ok(render(reopened).includes("Arquivo anual"));
console.log("Extrator UI: annual fields, listener, modes and preview render in create/edit, including existing rules and save/reopen.");

const legacy = buildDestinationFormFromRule({ listen_period_type: "mensal", listen_period_modes: ["mes_anterior"] });
assert.deepEqual(legacy.listenPeriodTypes, ["mensal"]);
assert.deepEqual(legacy.listenPeriodModesByType, { mensal: ["mes_anterior"] });
let multi = toggleDestinationListenType({ ...existing, ...legacy, base }, "periodo_especifico", true);
multi.listenPeriodModesByType.periodo_especifico = ["semana_atual"];
const multiHtml = render(multi);
for (const text of ["Arquivo mensal", "Arquivo por periodo", "Mensal:", "Periodo:", "Mes anterior", "Semana atual"]) {
  assert.ok(multiHtml.includes(text), `Multiple listeners missing: ${text}`);
}
assert.ok(!multiHtml.includes("Arquivo anual"));
assert.ok(!multiHtml.includes("Arquivo diario"));
const multiReopened = buildDestinationFormFromRule(serializeDestinationForm(multi, "fixture"));
assert.deepEqual(multiReopened.listenPeriodTypes, ["mensal", "periodo_especifico"]);
assert.deepEqual(multiReopened.listenPeriodModesByType, { mensal: ["mes_anterior"], periodo_especifico: ["semana_atual"] });
assert.deepEqual(normalizeDestinationListeners(multiReopened, meta).listenPeriodModesByType, multi.listenPeriodModesByType);
const removed = toggleDestinationListenType(multi, "periodo_especifico", false);
assert.deepEqual(removed.listenPeriodModesByType, { mensal: ["mes_anterior"] });
assert.deepEqual(toggleDestinationListenType(removed, "mensal", false), removed);
const all = toggleDestinationListenType(multi, "todos", true);
assert.deepEqual(all.listenPeriodTypes, ["todos"]);
assert.deepEqual(all.listenPeriodModesByType, {});
const changedBase = normalizeDestinationListeners({ ...multi, base: "other" }, { ...meta, listen_period_options_by_base: { other: [listenOptions[0], listenOptions[1]] } });
assert.deepEqual(changedBase.listenPeriodTypes, ["todos"]);
assert.deepEqual(changedBase.listenPeriodModesByType, {});
console.log("Extrator UI: multiple listeners, independent modes, templates, save/reopen, legacy editing and selection changes passed.");
