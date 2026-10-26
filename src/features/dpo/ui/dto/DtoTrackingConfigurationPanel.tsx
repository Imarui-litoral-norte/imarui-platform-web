"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Fingerprint, MapPin, Plus, RotateCcw, Route, Save, Search, Tag, UserMinus, UsersRound, X } from "lucide-react";
import { DtoBadge, DtoButton } from "@/features/dpo/ui/dto/DtoPrimitives";
import DtoEmployeeSelectionDialog from "@/features/dpo/ui/dto/DtoEmployeeSelectionDialog";
import { normalizeSearchText } from "@/features/dpo/lib/dtoFormatters";
import { extractTrackingNames } from "@/features/dpo/lib/dtoTracking";
import type {
  DtoConfigurationUpdate,
  DtoCollaboratorSource,
  DtoEnvironmentSource,
  DtoFormConfiguration,
  DtoTrackingConfiguration,
  DtoTrackingMode,
  DtoWorkforceFunction,
  WorkforceFilterCatalog,
} from "@/features/dpo/model/dtoTypes";
import { useFormManagerConfig } from "@/features/dpo/model/formManagerConfig";
import { Typography } from "@/shared/ui/typography";

function inferredFieldKey(
  configuration: DtoFormConfiguration,
  role: "COLLABORATOR" | "CONTEXT" | "DATE",
): string {
  const fields = configuration.fields.filter(
    (field) => field.role === role && field.observation_status === "OBSERVED",
  );
  return fields.length === 1 ? fields[0].key : "";
}

function inferredCollaboratorFieldKey(
  configuration: DtoFormConfiguration,
  source: DtoCollaboratorSource,
): string {
  const expected = source === "CPF" ? "cpf" : "mapa";
  const candidates = configuration.fields.filter(
    (field) =>
      field.observation_status === "OBSERVED" &&
      field.normalized_name.split(" ").includes(expected),
  );
  if (candidates.length === 1) return candidates[0].key;
  return source === "CPF" ? inferredFieldKey(configuration, "COLLABORATOR") : "";
}

function uniqueNames(values: string[]): string[] {
  const names = new Map<string, string>();
  values.forEach((value) => {
    const key = normalizeSearchText(value);
    if (key && !names.has(key)) names.set(key, value.trim());
  });
  return [...names.values()].sort((left, right) =>
    left.localeCompare(right, "pt-BR"),
  );
}

export default function DtoTrackingConfigurationPanel({
  configuration,
  onSave,
}: {
  configuration: DtoFormConfiguration;
  onSave: (update: DtoConfigurationUpdate) => Promise<unknown>;
}) {
  const { api } = useFormManagerConfig();
  const current = configuration.tracking;
  const [trackingMode, setTrackingMode] = useState<DtoTrackingMode>(
    current.mode || "COLLABORATOR",
  );
  const [environmentSource, setEnvironmentSource] = useState<DtoEnvironmentSource>(
    current.environment_source || "FIELD",
  );
  const [collaboratorSource, setCollaboratorSource] = useState<DtoCollaboratorSource>(
    current.collaborator_source || "CPF",
  );
  const [rosterFieldKey, setRosterFieldKey] = useState(
    (current.mode === "ENVIRONMENT" && current.environment_source === "FORM")
      ? ""
      : current.roster_field_key ||
        ((current.mode || "COLLABORATOR") === "ENVIRONMENT"
          ? inferredFieldKey(configuration, "CONTEXT")
          : inferredCollaboratorFieldKey(
              configuration,
              current.collaborator_source || "CPF",
            )),
  );
  const [dateFieldKey, setDateFieldKey] = useState(
    current.realization_date_field_key || inferredFieldKey(configuration, "DATE"),
  );
  const [intervalDays, setIntervalDays] = useState(
    current.interval_days ? String(current.interval_days) : "",
  );
  const [applicableFunctions, setApplicableFunctions] = useState(
    current.applicable_functions || [],
  );
  const [functionSearch, setFunctionSearch] = useState("");
  const [functionCatalog, setFunctionCatalog] = useState<DtoWorkforceFunction[]>([]);
  const [functionCatalogStatus, setFunctionCatalogStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [functionCatalogError, setFunctionCatalogError] = useState<string | null>(null);
  const [workforceCatalog, setWorkforceCatalog] = useState<WorkforceFilterCatalog | null>(null);
  const [applicantEmployeeKeys, setApplicantEmployeeKeys] = useState(
    current.applicant_employee_keys || [],
  );
  const [applicantPickerOpen, setApplicantPickerOpen] = useState(false);
  const [excludedEmployeeKeys, setExcludedEmployeeKeys] = useState(
    current.excluded_employee_keys || [],
  );
  const [exclusionPickerOpen, setExclusionPickerOpen] = useState(false);
  const [newEmployeeRuleEnabled, setNewEmployeeRuleEnabled] = useState(
    Boolean(
      current.new_employee_window_days &&
        current.new_employee_first_due_days,
    ),
  );
  const [newEmployeeWindowDays, setNewEmployeeWindowDays] = useState(
    current.new_employee_window_days
      ? String(current.new_employee_window_days)
      : "",
  );
  const [newEmployeeFirstDueDays, setNewEmployeeFirstDueDays] = useState(
    current.new_employee_first_due_days
      ? String(current.new_employee_first_due_days)
      : "",
  );
  const [excluded, setExcluded] = useState(current.excluded_collaborators);
  const [manual, setManual] = useState(current.manual_collaborators);
  const [manualName, setManualName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api.getTrackingContext(configuration.form_id, undefined, controller.signal),
      api.getWorkforceFilterCatalog(controller.signal),
    ]).then(([context, catalog]) => {
        setFunctionCatalog(context.available_functions || []);
        setWorkforceCatalog(catalog);
        setFunctionCatalogStatus("ready");
      })
      .catch((catalogError: unknown) => {
        if (catalogError instanceof Error && catalogError.name === "AbortError") return;
        setFunctionCatalogStatus("error");
        setFunctionCatalogError(
          catalogError instanceof Error
            ? catalogError.message
            : "Não foi possível consultar as funções do cadastro.",
        );
      });
    return () => controller.abort();
  }, [api, configuration.form_id]);

  const rosterField = configuration.fields.find(
    (field) => field.key === rosterFieldKey,
  );
  const observedNames = useMemo(
    () =>
      uniqueNames(
        (rosterField?.observed_values || []).flatMap((value) =>
          extractTrackingNames(value.display_value),
        ),
      ),
    [rosterField],
  );
  const parsedInterval = Number(intervalDays);
  const intervalValid =
    intervalDays !== "" &&
    Number.isInteger(parsedInterval) &&
    parsedInterval >= 1 &&
    parsedInterval <= 3660;
  const parsedNewEmployeeWindow = Number(newEmployeeWindowDays);
  const parsedNewEmployeeFirstDue = Number(newEmployeeFirstDueDays);
  const newEmployeeRuleValid = !newEmployeeRuleEnabled || (
    Number.isInteger(parsedNewEmployeeWindow) &&
    parsedNewEmployeeWindow >= 1 &&
    parsedNewEmployeeWindow <= 3660 &&
    Number.isInteger(parsedNewEmployeeFirstDue) &&
    parsedNewEmployeeFirstDue >= 1 &&
    parsedNewEmployeeFirstDue <= 3660
  );
  const fieldsDistinct = !rosterFieldKey || rosterFieldKey !== dateFieldKey;
  const isEnvironment = trackingMode === "ENVIRONMENT";
  const isFormEnvironment = isEnvironment && environmentSource === "FORM";
  const subject = isEnvironment ? "ambiente" : "colaborador";
  const subjects = isEnvironment ? "ambientes" : "colaboradores";
  const hasPopulationSource = isFormEnvironment
    ? manual.length === 1
    : isEnvironment
      ? Boolean(rosterFieldKey)
      : Boolean(rosterFieldKey && applicableFunctions.length);
  const functionOptions = useMemo(() => {
    const byKey = new Map<string, DtoWorkforceFunction>();
    functionCatalog.forEach((item) => {
      byKey.set(normalizeSearchText(item.name), item);
    });
    applicableFunctions.forEach((name) => {
      const key = normalizeSearchText(name);
      if (key && !byKey.has(key)) byKey.set(key, { name, employees: 0 });
    });
    const query = normalizeSearchText(functionSearch);
    return [...byKey.values()]
      .filter((item) => !query || normalizeSearchText(item.name).includes(query))
      .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  }, [applicableFunctions, functionCatalog, functionSearch]);
  const selectedEmployees = useMemo(() => {
    const selected = new Set(applicableFunctions.map(normalizeSearchText));
    return functionCatalog.reduce(
      (total, item) => total + (selected.has(normalizeSearchText(item.name)) ? item.employees : 0),
      0,
    );
  }, [applicableFunctions, functionCatalog]);
  const selectedApplicants = useMemo(() => {
    const selected = new Set(applicantEmployeeKeys);
    return (workforceCatalog?.employees || []).filter((employee) => selected.has(employee.key));
  }, [applicantEmployeeKeys, workforceCatalog?.employees]);
  const associatedEmployees = useMemo(() => {
    const functions = new Set(applicableFunctions.map(normalizeSearchText));
    return (workforceCatalog?.employees || []).filter((employee) =>
      employee.function && functions.has(normalizeSearchText(employee.function)),
    );
  }, [applicableFunctions, workforceCatalog?.employees]);
  const activeExclusionCount = associatedEmployees.filter((employee) => excludedEmployeeKeys.includes(employee.key)).length;
  const excludedEmployees = useMemo(() => {
    const employees = new Map((workforceCatalog?.employees || []).map((employee) => [employee.key, employee]));
    return excludedEmployeeKeys.map((key) => ({ key, name: employees.get(key)?.name || "Colaborador indisponível no cadastro" }));
  }, [excludedEmployeeKeys, workforceCatalog?.employees]);
  const currentIsFormEnvironment =
    current.mode === "ENVIRONMENT" && current.environment_source === "FORM";
  const currentConfigured = Boolean(
    current.realization_date_field_key &&
      current.interval_days &&
      (current.mode !== "COLLABORATOR" || (
        current.collaborator_source && current.applicable_functions?.length
      )) &&
      (currentIsFormEnvironment
        ? current.manual_collaborators.length === 1 && !current.roster_field_key
        : current.roster_field_key),
  );

  function changeTrackingMode(mode: DtoTrackingMode) {
    if (mode === trackingMode) return;
    setTrackingMode(mode);
    setEnvironmentSource("FIELD");
    setRosterFieldKey(
      mode === "ENVIRONMENT"
        ? inferredFieldKey(configuration, "CONTEXT")
        : inferredCollaboratorFieldKey(configuration, collaboratorSource),
    );
    setExcluded([]);
    setManual([]);
    setManualName("");
  }

  function changeCollaboratorSource(source: DtoCollaboratorSource) {
    if (source === collaboratorSource) return;
    setCollaboratorSource(source);
    setRosterFieldKey(inferredCollaboratorFieldKey(configuration, source));
  }

  function changeEnvironmentSource(source: DtoEnvironmentSource) {
    if (source === environmentSource) return;
    setEnvironmentSource(source);
    setRosterFieldKey(
      source === "FORM"
        ? ""
        : inferredFieldKey(configuration, "CONTEXT"),
    );
    setExcluded([]);
    setManual([]);
    setManualName("");
  }

  function toggleApplicableFunction(name: string) {
    const key = normalizeSearchText(name);
    setApplicableFunctions((values) =>
      values.some((value) => normalizeSearchText(value) === key)
        ? values.filter((value) => normalizeSearchText(value) !== key)
        : [...values, name],
    );
  }

  function toggleApplicant(key: string) {
    setApplicantEmployeeKeys((keys) => keys.includes(key)
      ? keys.filter((item) => item !== key)
      : [...keys, key]);
  }

  function toggleExcluded(name: string) {
    const key = normalizeSearchText(name);
    setExcluded((values) =>
      values.some((value) => normalizeSearchText(value) === key)
        ? values.filter((value) => normalizeSearchText(value) !== key)
        : [...values, name],
    );
    setManual((values) =>
      values.filter((value) => normalizeSearchText(value) !== key),
    );
  }

  function addManualSubject() {
    const name = manualName.trim();
    const key = normalizeSearchText(name);
    if (!key) return;
    if (isFormEnvironment && manual.length > 0) return;
    if (observedNames.some((value) => normalizeSearchText(value) === key)) {
      setManualName("");
      return;
    }
    setManual((values) =>
      values.some((value) => normalizeSearchText(value) === key)
        ? values
        : [...values, name],
    );
    setExcluded((values) =>
      values.filter((value) => normalizeSearchText(value) !== key),
    );
    setManualName("");
  }

  async function save(tracking: DtoTrackingConfiguration | null) {
    setSaving(true);
    setError(null);
    try {
      await onSave({ revision: configuration.revision, tracking });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar a forma de acompanhamento.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[24px] border border-[color:var(--shell-line-strong)] bg-[var(--shell-surface-muted)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <Typography variant="overline">Forma de acompanhamento</Typography>
          <Typography as="h3" variant="cardTitle" className="mt-2">
            Dimensão, periodicidade e população acompanhada
          </Typography>
          <Typography variant="supportingText" className="mt-2">
            Escolha se cada ciclo pertence a uma pessoa ou a um ambiente. No
            ambiente, você pode usar uma coluna com vários locais ou um único
            rótulo que representa todas as realizações do formulário.
          </Typography>
        </div>
        {currentConfigured ? (
          <DtoBadge tone="accent">
            {current.mode === "ENVIRONMENT"
              ? currentIsFormEnvironment
                ? "Ambiente geral"
                : "Por ambiente"
              : current.collaborator_source === "MAP"
                ? "Por colaborador · mapa"
                : "Por colaborador · CPF"}
          </DtoBadge>
        ) : (
          <DtoBadge>Configuração opcional</DtoBadge>
        )}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Dimensão do acompanhamento">
        <button
          type="button"
          role="radio"
          aria-checked={trackingMode === "COLLABORATOR"}
          onClick={() => changeTrackingMode("COLLABORATOR")}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
            trackingMode === "COLLABORATOR"
              ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
              : "border-[color:var(--shell-line)] bg-[var(--shell-surface)] hover:border-[color:var(--shell-line-strong)]"
          }`}
        >
          <UsersRound aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--shell-accent)]" />
          <span>
            <span className="block text-sm font-semibold text-[var(--shell-text)]">Por colaborador</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--shell-muted)]">
              Cada pessoa possui sua própria última realização e próximo prazo.
            </span>
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={trackingMode === "ENVIRONMENT"}
          onClick={() => changeTrackingMode("ENVIRONMENT")}
          className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
            trackingMode === "ENVIRONMENT"
              ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
              : "border-[color:var(--shell-line)] bg-[var(--shell-surface)] hover:border-[color:var(--shell-line-strong)]"
          }`}
        >
          <MapPin aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[var(--shell-accent)]" />
          <span>
            <span className="block text-sm font-semibold text-[var(--shell-text)]">Por ambiente</span>
            <span className="mt-1 block text-xs leading-5 text-[var(--shell-muted)]">
              Cada local possui um único ciclo, independentemente de quem realizou.
            </span>
          </span>
        </button>
      </div>

      {!isEnvironment ? (
        <fieldset className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
          <legend className="px-1 text-sm font-semibold text-[var(--shell-text)]">
            Como associar a realização aos colaboradores
          </legend>
          <div className="mt-2 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Chave do colaborador">
            <button
              type="button"
              role="radio"
              aria-checked={collaboratorSource === "CPF"}
              onClick={() => changeCollaboratorSource("CPF")}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                collaboratorSource === "CPF"
                  ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
                  : "border-[color:var(--shell-line)] hover:border-[color:var(--shell-line-strong)]"
              }`}
            >
              <Fingerprint aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--shell-accent)]" />
              <span>
                <span className="block text-sm font-semibold text-[var(--shell-text)]">CPF da realização</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--shell-muted)]">
                  O CPF identifica uma única pessoa; use uma resposta textual que preserve os 11 dígitos.
                  O acompanhamento exibe o nome do cadastro oficial.
                </span>
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={collaboratorSource === "MAP"}
              onClick={() => changeCollaboratorSource("MAP")}
              className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
                collaboratorSource === "MAP"
                  ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
                  : "border-[color:var(--shell-line)] hover:border-[color:var(--shell-line-strong)]"
              }`}
            >
              <Route aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--shell-accent)]" />
              <span>
                <span className="block text-sm font-semibold text-[var(--shell-text)]">Mapa e equipe escalada</span>
                <span className="mt-1 block text-xs leading-5 text-[var(--shell-muted)]">
                  Data e mapa localizam motorista e até dois ajudantes na view de equipe.
                </span>
              </span>
            </button>
          </div>
        </fieldset>
      ) : null}

      {!isEnvironment ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
            <div className="flex items-start gap-3">
              <Tag aria-hidden="true" className="mt-0.5 h-4 w-4 text-[var(--shell-accent)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--shell-text)]">
                  Funções aplicáveis
                </p>
                <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">
                  Somente funcionários com uma destas tags de <code>funcao</code> entram na população e na aderência.
                </p>
              </div>
            </div>
            <label className="relative mt-3 block">
              <span className="sr-only">Buscar função</span>
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--shell-muted)]" />
              <input
                value={functionSearch}
                onChange={(event) => setFunctionSearch(event.target.value)}
                placeholder="Buscar função"
                className="w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] py-2.5 pl-10 pr-3 text-sm text-[var(--shell-text)]"
              />
            </label>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
              {functionCatalogStatus === "loading" ? (
                <p className="text-sm text-[var(--shell-muted)]">Consultando funções do cadastro...</p>
              ) : functionCatalogStatus === "error" ? (
                <p role="alert" className="text-sm text-[var(--shell-danger)]">
                  {functionCatalogError}
                </p>
              ) : functionOptions.length ? (
                functionOptions.map((item) => {
                  const checked = applicableFunctions.some(
                    (value) => normalizeSearchText(value) === normalizeSearchText(item.name),
                  );
                  return (
                    <label
                      key={normalizeSearchText(item.name)}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--shell-line)] px-3 py-2 text-sm text-[var(--shell-text)]"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleApplicableFunction(item.name)}
                          className="h-4 w-4 shrink-0 accent-[var(--shell-accent)]"
                        />
                        <span className="min-w-0 break-words">{item.name}</span>
                      </span>
                      <span className="shrink-0 text-xs text-[var(--shell-muted)]">
                        {item.employees} pessoa(s)
                      </span>
                    </label>
                  );
                })
              ) : (
                <p className="text-sm text-[var(--shell-muted)]">
                  Nenhuma função corresponde à busca.
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-[var(--shell-muted)]">
              {applicableFunctions.length} função(ões) selecionada(s) · {selectedEmployees} pessoa(s) associada(s) · {activeExclusionCount} expurgada(s) · {selectedEmployees - activeExclusionCount} na visualização.
            </p>
          </section>

          <section className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
            <div className="flex items-start gap-3">
              <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 text-[var(--shell-accent)]" />
              <div className="min-w-0 flex-1">
                <label className="flex items-center gap-3 text-sm font-semibold text-[var(--shell-text)]">
                  <input
                    type="checkbox"
                    checked={newEmployeeRuleEnabled}
                    onChange={(event) => setNewEmployeeRuleEnabled(event.target.checked)}
                    className="h-4 w-4 accent-[var(--shell-accent)]"
                  />
                  Regra diferenciada para novos
                </label>
                <p className="mt-2 text-xs leading-5 text-[var(--shell-muted)]">
                  Usa <code>admissao</code> para identificar recém-admitidos e calcular o prazo da primeira realização. Após a primeira aplicação, passa a valer o intervalo normal.
                </p>
              </div>
            </div>
            {newEmployeeRuleEnabled ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[var(--shell-muted)]">
                  Considerar novo por
                  <span className="mt-1 block font-normal">Dias após a admissão</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={3660}
                    step={1}
                    value={newEmployeeWindowDays}
                    onChange={(event) => setNewEmployeeWindowDays(event.target.value)}
                    placeholder="Ex.: 30"
                    className="mt-2 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2.5 text-sm text-[var(--shell-text)]"
                  />
                </label>
                <label className="text-xs font-semibold text-[var(--shell-muted)]">
                  Prazo da primeira realização
                  <span className="mt-1 block font-normal">Dias após a admissão</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={3660}
                    step={1}
                    value={newEmployeeFirstDueDays}
                    onChange={(event) => setNewEmployeeFirstDueDays(event.target.value)}
                    placeholder="Ex.: 30"
                    className="mt-2 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2.5 text-sm text-[var(--shell-text)]"
                  />
                </label>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--shell-muted)]">
                Sem regra especial: quem nunca recebeu uma realização permanece em “Nunca realizado”.
              </p>
            )}
          </section>
        </div>
      ) : null}

      {isEnvironment ? (
        <fieldset className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
          <legend className="px-1 text-sm font-semibold text-[var(--shell-text)]">
            Como identificar o ambiente
          </legend>
          <div className="mt-2 grid gap-3 md:grid-cols-2" role="radiogroup" aria-label="Fonte do ambiente">
            <button
              type="button"
              role="radio"
              aria-checked={environmentSource === "FIELD"}
              onClick={() => changeEnvironmentSource("FIELD")}
              className={`rounded-xl border p-3 text-left transition ${
                environmentSource === "FIELD"
                  ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
                  : "border-[color:var(--shell-line)] hover:border-[color:var(--shell-line-strong)]"
              }`}
            >
              <span className="block text-sm font-semibold text-[var(--shell-text)]">Campo de ambiente no formulário</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--shell-muted)]">
                Use quando cada realização informa o local, como Oficina, Pátio ou Armazém.
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={environmentSource === "FORM"}
              onClick={() => changeEnvironmentSource("FORM")}
              className={`rounded-xl border p-3 text-left transition ${
                environmentSource === "FORM"
                  ? "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)]"
                  : "border-[color:var(--shell-line)] hover:border-[color:var(--shell-line-strong)]"
              }`}
            >
              <span className="block text-sm font-semibold text-[var(--shell-text)]">Ambiente geral do formulário</span>
              <span className="mt-1 block text-xs leading-5 text-[var(--shell-muted)]">
                Use quando todo registro vale para um único local e não existe uma coluna de ambiente.
              </span>
            </button>
          </div>
        </fieldset>
      ) : null}

      <div className={`mt-5 grid gap-4 ${isFormEnvironment ? "lg:grid-cols-2" : "lg:grid-cols-3"}`}>
        {!isFormEnvironment ? (
          <label className="text-xs font-semibold text-[var(--shell-muted)]">
            {isEnvironment
              ? "Pergunta/campo do ambiente"
              : collaboratorSource === "CPF"
                ? "Pergunta/campo que contém o CPF"
                : "Pergunta/campo que contém o mapa"}
          <select
            value={rosterFieldKey}
            onChange={(event) => {
              setRosterFieldKey(event.target.value);
              setExcluded([]);
            }}
            className="mt-2 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)]"
          >
            <option value="">Selecione um campo</option>
            {configuration.fields
              .filter((field) => field.observation_status === "OBSERVED")
              .map((field) => (
                <option key={field.key} value={field.key}>
                  {field.source_name}
                </option>
              ))}
          </select>
          </label>
        ) : null}

        <label className="text-xs font-semibold text-[var(--shell-muted)]">
          Campo da data de realização
          <select
            value={dateFieldKey}
            onChange={(event) => setDateFieldKey(event.target.value)}
            className="mt-2 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)]"
          >
            <option value="">Selecione um campo</option>
            {configuration.fields
              .filter((field) => field.observation_status === "OBSERVED")
              .map((field) => (
                <option key={field.key} value={field.key}>
                  {field.source_name}
                  {field.role === "DATE" ? " · data detectada" : ""}
                </option>
              ))}
          </select>
        </label>

        <label className="text-xs font-semibold text-[var(--shell-muted)]">
          Dias entre realizações
          <input
            inputMode="numeric"
            min={1}
            max={3660}
            step={1}
            type="number"
            value={intervalDays}
            onChange={(event) => setIntervalDays(event.target.value)}
            placeholder="Ex.: 30 ou 60"
            className="mt-2 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 py-2.5 text-sm text-[var(--shell-text)]"
          />
        </label>
      </div>

      {isEnvironment ? (
      <div className={`mt-5 grid gap-4 ${isFormEnvironment ? "max-w-2xl" : "xl:grid-cols-2"}`}>
        {!isFormEnvironment ? (
          <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
          <div className="flex items-start gap-3">
            <UserMinus aria-hidden="true" className="mt-0.5 h-4 w-4 text-[var(--shell-muted)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--shell-text)]">
                Desconsiderar {subjects}
              </p>
              <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">
                Use para locais que não pertencem ao escopo desta rotina.
              </p>
            </div>
          </div>
          <div className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
            {rosterFieldKey && observedNames.length ? (
              observedNames.map((name) => {
                const checked = excluded.some(
                  (value) => normalizeSearchText(value) === normalizeSearchText(name),
                );
                return (
                  <label
                    key={normalizeSearchText(name)}
                    className="flex items-center gap-3 rounded-xl border border-[color:var(--shell-line)] px-3 py-2 text-sm text-[var(--shell-text)]"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleExcluded(name)}
                      className="h-4 w-4 accent-[var(--shell-accent)]"
                    />
                    <span className="min-w-0 break-words">{name}</span>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-[var(--shell-muted)]">
                Selecione o campo de {subject} para listar os valores observados.
              </p>
            )}
          </div>
          </div>
        ) : null}

        <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--shell-text)]">
            {isFormEnvironment ? "Definir ambiente geral" : "Incluir ambiente sem registro"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">
            {isFormEnvironment
              ? "Informe um único rótulo. Todas as realizações deste formulário serão atribuídas a esse ambiente."
              : "Inclusões manuais aparecem como “Nunca realizado” até surgir uma aplicação."}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addManualSubject();
                }
              }}
              placeholder={isFormEnvironment ? "Ex.: Armazém" : "Nome do ambiente"}
              className="min-w-0 flex-1 rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2 text-sm text-[var(--shell-text)]"
            />
            <DtoButton size="sm" disabled={isFormEnvironment && manual.length > 0} onClick={addManualSubject}>
              <Plus aria-hidden="true" /> Adicionar
            </DtoButton>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {manual.length ? (
              manual.map((name) => (
                <span
                  key={normalizeSearchText(name)}
                  className="inline-flex items-center gap-1 rounded-full border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--shell-text)]"
                >
                    {name}
                  <button
                    type="button"
                    aria-label={`Remover ${name}`}
                    onClick={() =>
                      setManual((values) =>
                        values.filter(
                          (value) =>
                            normalizeSearchText(value) !== normalizeSearchText(name),
                        ),
                      )
                    }
                    className="rounded-full p-0.5 text-[var(--shell-muted)] hover:text-[var(--shell-text)]"
                  >
                    <X aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))
            ) : (
              <span className="text-xs text-[var(--shell-muted)]">
                {isFormEnvironment ? "Defina o ambiente que este formulário representa." : "Nenhuma inclusão manual."}
              </span>
            )}
          </div>
        </div>
      </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
          <p className="text-sm font-semibold text-[var(--shell-text)]">
            População do cadastro oficial
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">
            Os nomes, funções e admissões serão lidos de <code>diretorio.funcionarios</code>.
            O filtro acima define a população; não há inclusão ou associação manual por nome.
          </p>
        </div>
      )}

      {!isEnvironment ? (
        <section className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4" aria-label="Expurgos do acompanhamento">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserMinus aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--shell-accent)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--shell-text)]">Expurgos</p>
                <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">Retire do acompanhamento colaboradores de férias, afastados ou fora do escopo. Remova o expurgo para incluí-los novamente. As alterações são aplicadas ao salvar o acompanhamento.</p>
              </div>
            </div>
            <DtoButton size="sm" disabled={functionCatalogStatus !== "ready" || associatedEmployees.length === 0} onClick={() => setExclusionPickerOpen(true)}><Plus aria-hidden="true" /> Adicionar expurgo</DtoButton>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {excludedEmployees.length ? excludedEmployees.map((employee) => (
              <span key={employee.key} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--shell-text)]">
                {employee.name}
                <button type="button" aria-label={`Remover expurgo de ${employee.name}`} onClick={() => setExcludedEmployeeKeys((keys) => keys.filter((key) => key !== employee.key))} className="text-[var(--shell-muted)] hover:text-[var(--shell-danger)]"><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
              </span>
            )) : <span className="text-xs text-[var(--shell-muted)]">Nenhum colaborador expurgado.</span>}
          </div>
        </section>
      ) : null}
      <DtoEmployeeSelectionDialog
        open={exclusionPickerOpen && !isEnvironment}
        eyebrow="Expurgos"
        title="Selecionar colaboradores para expurgo"
        description="A lista contém os colaboradores das funções aplicáveis selecionadas na associação."
        employees={associatedEmployees}
        selectedKeys={excludedEmployeeKeys}
        onChange={setExcludedEmployeeKeys}
        onClose={() => setExclusionPickerOpen(false)}
        emptyLabel="Nenhum colaborador está associado às funções selecionadas."
      />

      <section className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <UsersRound aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--shell-accent)]" />
            <div>
            <p className="text-sm font-semibold text-[var(--shell-text)]">Aplicadores deste formulário</p>
              <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">Somente estas pessoas aparecem como responsáveis no Planejamento.</p>
            </div>
          </div>
          <DtoButton size="sm" onClick={() => setApplicantPickerOpen(true)}><Plus aria-hidden="true" /> Adicionar</DtoButton>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {selectedApplicants.length ? selectedApplicants.map((employee) => <span key={employee.key} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--shell-text)]">{employee.name}<button type="button" aria-label={`Remover ${employee.name}`} onClick={() => toggleApplicant(employee.key)} className="text-[var(--shell-muted)] hover:text-[var(--shell-danger)]"><X aria-hidden="true" className="h-3.5 w-3.5" /></button></span>) : <span className="text-xs text-[var(--shell-muted)]">Nenhum aplicador selecionado.</span>}
        </div>
      </section>

      <DtoEmployeeSelectionDialog
        open={applicantPickerOpen}
        eyebrow="Equipe aplicadora"
        title="Selecionar aplicadores"
        description="Use área, função e busca para montar a equipe responsável por este formulário."
        employees={workforceCatalog?.employees || []}
        selectedKeys={applicantEmployeeKeys}
        onChange={setApplicantEmployeeKeys}
        onClose={() => setApplicantPickerOpen(false)}
      />

      {intervalDays && !intervalValid ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          Informe um intervalo inteiro entre 1 e 3660 dias.
        </p>
      ) : null}
      {newEmployeeRuleEnabled && !newEmployeeRuleValid ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          Informe valores inteiros entre 1 e 3660 dias para a regra de novos.
        </p>
      ) : null}
      {!isEnvironment && applicableFunctions.length === 0 ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          Selecione ao menos uma função aplicável.
        </p>
      ) : null}
      {applicantEmployeeKeys.length === 0 ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          Selecione ao menos um aplicador para este formulário.
        </p>
      ) : null}
      {!fieldsDistinct ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          O campo de {subject} e o campo de data devem ser diferentes.
        </p>
      ) : null}
      {isFormEnvironment && manual.length !== 1 ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          Defina exatamente um ambiente geral para este formulário.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[var(--shell-danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <DtoButton
          disabled={saving}
          onClick={() => void save(null)}
        >
          <RotateCcw aria-hidden="true" /> Limpar acompanhamento
        </DtoButton>
        <DtoButton
          tone="accent"
          disabled={
            saving ||
            !hasPopulationSource ||
            !dateFieldKey ||
            !intervalValid ||
            !newEmployeeRuleValid ||
            applicantEmployeeKeys.length === 0 ||
            (!isFormEnvironment && !fieldsDistinct)
          }
          onClick={() =>
            void save({
              mode: trackingMode,
              environment_source: isEnvironment ? environmentSource : "FIELD",
              collaborator_source: collaboratorSource,
              roster_field_key: isFormEnvironment ? null : rosterFieldKey,
              realization_date_field_key: dateFieldKey,
              interval_days: parsedInterval,
              applicable_functions: isEnvironment ? [] : applicableFunctions,
              applicant_employee_keys: applicantEmployeeKeys,
              excluded_employee_keys: isEnvironment ? [] : excludedEmployeeKeys,
              new_employee_window_days:
                !isEnvironment && newEmployeeRuleEnabled
                  ? parsedNewEmployeeWindow
                  : null,
              new_employee_first_due_days:
                !isEnvironment && newEmployeeRuleEnabled
                  ? parsedNewEmployeeFirstDue
                  : null,
              excluded_collaborators:
                isEnvironment && !isFormEnvironment ? excluded : [],
              manual_collaborators: isEnvironment ? manual : [],
            })
          }
        >
          <Save aria-hidden="true" /> {saving ? "Salvando" : "Salvar acompanhamento"}
        </DtoButton>
      </div>
    </section>
  );
}
