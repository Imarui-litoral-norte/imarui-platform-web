"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Save, Search, TriangleAlert } from "lucide-react";
import type {
  DtoAnswerSemantic,
  DtoConfigurationUpdate,
  DtoFieldConfiguration,
  DtoFieldRole,
  DtoFormConfiguration,
} from "@/features/dpo/model/dtoTypes";
import { formatDtoNumber, formatDtoPercentage, normalizeSearchText } from "@/features/dpo/lib/dtoFormatters";
import { DtoBadge, DtoButton, DtoPanel } from "@/features/dpo/ui/dto/DtoPrimitives";
import { Typography } from "@/shared/ui/typography";
import DtoTrackingConfigurationPanel from "@/features/dpo/ui/dto/DtoTrackingConfigurationPanel";
import DtoWorkforceFilterManager from "@/features/dpo/ui/dto/DtoWorkforceFilterManager";

const ROLE_LABELS: Record<DtoFieldRole, string> = {
  EVALUATION: "Pergunta avaliativa",
  COLLABORATOR: "Colaborador",
  APPLIER: "Aplicador/gestor",
  DATE: "Data",
  CONTEXT: "Contexto",
  IGNORE: "Ignorar",
};
const SEMANTIC_LABELS: Record<Exclude<DtoAnswerSemantic, "BLANK">, string> = {
  POSITIVE: "Positiva",
  NEGATIVE: "Negativa",
  IGNORED: "Desconsiderar",
  UNMAPPED: "Não parametrizada",
};
type CatalogFilter = "all" | "evaluation" | "metadata" | "historical" | "unmapped" | "warning";

function FieldEditor({
  configuration,
  field,
  onSave,
}: {
  configuration: DtoFormConfiguration;
  field: DtoFieldConfiguration;
  onSave: (update: DtoConfigurationUpdate) => Promise<unknown>;
}) {
  const [role, setRole] = useState<DtoFieldRole>(field.role);
  const [mappings, setMappings] = useState<Record<string, Exclude<DtoAnswerSemantic, "BLANK">>>(
    field.answer_mappings as Record<string, Exclude<DtoAnswerSemantic, "BLANK">>,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    let positive = 0;
    let negative = 0;
    let ignored = 0;
    let unmapped = 0;
    if (role === "EVALUATION") {
      field.observed_values.forEach((value) => {
        const semantic = mappings[value.normalized_value] || "UNMAPPED";
        if (semantic === "POSITIVE") positive += value.count;
        else if (semantic === "NEGATIVE") negative += value.count;
        else if (semantic === "IGNORED") ignored += value.count;
        else unmapped += value.count;
      });
    }
    const answered = positive + negative;
    return { positive, negative, ignored, unmapped, adherence: answered ? (positive / answered) * 100 : null };
  }, [field.observed_values, mappings, role]);

  async function submit(update: DtoConfigurationUpdate) {
    setSaving(true);
    setError(null);
    try {
      await onSave(update);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a parametrização.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="break-words text-sm font-semibold leading-6 text-[var(--shell-text)]">{field.source_name}</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <DtoBadge tone={field.configuration_source === "MANUAL" ? "accent" : "default"}>{field.configuration_source === "MANUAL" ? "Manual" : "Automática"}</DtoBadge>
            <DtoBadge>{field.observation_status === "OBSERVED" ? "Observado agora" : "Não observado na última sincronização"}</DtoBadge>
            {field.warnings.length ? <DtoBadge tone="danger">Requer parametrização</DtoBadge> : null}
          </div>
        </div>
        <label className="min-w-48 text-xs font-semibold text-[var(--shell-muted)]">
          Papel do campo
          <select value={role} onChange={(event) => setRole(event.target.value as DtoFieldRole)} className="mt-2 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 py-2 text-sm text-[var(--shell-text)]">
            {(Object.keys(ROLE_LABELS) as DtoFieldRole[]).map((value) => <option key={value} value={value}>{ROLE_LABELS[value]}</option>)}
          </select>
        </label>
      </div>

      {role === "EVALUATION" ? (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Valores detectados</p>
          {field.observed_values.length ? field.observed_values.map((value) => (
            <div key={value.normalized_value} className="grid items-center gap-2 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(180px,0.7fr)]">
              <span className="break-words text-sm font-semibold text-[var(--shell-text)]">{value.display_value}</span>
              <span className="text-xs text-[var(--shell-muted)]">{formatDtoNumber(value.count)} ocorrência(s)</span>
              <select
                aria-label={`Significado de ${value.display_value}`}
                value={mappings[value.normalized_value] || "UNMAPPED"}
                onChange={(event) => setMappings((current) => ({ ...current, [value.normalized_value]: event.target.value as Exclude<DtoAnswerSemantic, "BLANK"> }))}
                className="rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2 text-sm text-[var(--shell-text)]"
              >
                {(Object.keys(SEMANTIC_LABELS) as Array<Exclude<DtoAnswerSemantic, "BLANK">>).map((semantic) => <option key={semantic} value={semantic}>{SEMANTIC_LABELS[semantic]}</option>)}
              </select>
            </div>
          )) : <p className="text-sm text-[var(--shell-muted)]">Nenhum valor foi observado na última sincronização.</p>}

          <div className="grid gap-2 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-3 text-xs sm:grid-cols-5">
            <span>Positivas: <strong>{preview.positive}</strong></span>
            <span>Negativas: <strong>{preview.negative}</strong></span>
            <span>Ignoradas: <strong>{preview.ignored}</strong></span>
            <span>Não parametrizadas: <strong>{preview.unmapped}</strong></span>
            <span>Aderência: <strong>{formatDtoPercentage(preview.adherence)}</strong></span>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-[var(--shell-danger)]">{error}</p> : null}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {field.configuration_source === "MANUAL" ? (
          <DtoButton disabled={saving} onClick={() => void submit({ revision: configuration.revision, reset_fields: [field.key] })}>
            <RotateCcw aria-hidden="true" /> Restaurar detecção automática
          </DtoButton>
        ) : null}
        <DtoButton tone="accent" disabled={saving} onClick={() => void submit({
          revision: configuration.revision,
          fields: [{ field_key: field.key, role, answer_mappings: role === "EVALUATION" ? mappings : {} }],
        })}>
          <Save aria-hidden="true" /> {saving ? "Salvando" : "Salvar campo"}
        </DtoButton>
      </div>
    </article>
  );
}

export default function DtoConfigurationPanel({
  configuration,
  initialNeedsAttention = false,
  onSave,
}: {
  configuration: DtoFormConfiguration;
  initialNeedsAttention?: boolean;
  onSave: (update: DtoConfigurationUpdate) => Promise<unknown>;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>(initialNeedsAttention ? "warning" : "all");
  const fields = useMemo(() => {
    const query = normalizeSearchText(search);
    return configuration.fields.filter((field) => {
      if (query && !normalizeSearchText(field.source_name).includes(query)) return false;
      if (filter === "evaluation" && field.role !== "EVALUATION") return false;
      if (filter === "metadata" && ["EVALUATION", "IGNORE"].includes(field.role)) return false;
      if (filter === "historical" && field.observation_status !== "NOT_OBSERVED") return false;
      if (filter === "unmapped" && !field.observed_values.some((value) => value.semantic === "UNMAPPED")) return false;
      if (filter === "warning" && !field.warnings.length) return false;
      return true;
    });
  }, [configuration.fields, filter, search]);

  return (
    <div className="space-y-4">
      <DtoTrackingConfigurationPanel
        key={`${configuration.form_id}:${configuration.revision}`}
        configuration={configuration}
        onSave={onSave}
      />
      <DtoWorkforceFilterManager />
      <DtoPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography variant="overline">Parametrização do formulário</Typography>
          <Typography as="h2" variant="sectionTitle" className="mt-2">Catálogo de campos e respostas</Typography>
          <Typography variant="supportingText" className="mt-2 max-w-3xl">
            A configuração manual sempre vence a inferência automática. Valores não parametrizados ficam fora dos indicadores até uma decisão da gestão.
          </Typography>
        </div>
        <div className="flex flex-wrap gap-2">
          <DtoBadge>Revisão {configuration.revision}</DtoBadge>
          {configuration.fields_requiring_configuration ? <DtoBadge tone="danger"><TriangleAlert aria-hidden="true" className="mr-1 h-3.5 w-3.5" />{configuration.fields_requiring_configuration} campo(s) pendente(s)</DtoBadge> : <DtoBadge tone="accent">Sem pendências</DtoBadge>}
        </div>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(260px,1.4fr)]">
        <label className="relative">
          <span className="sr-only">Buscar campo</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--shell-muted)]" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pergunta ou campo" className="w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] py-3 pl-10 pr-3 text-sm text-[var(--shell-text)]" />
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Filtros do catálogo">
          {([
            ["all", "Todos"], ["evaluation", "Perguntas"], ["metadata", "Metadados"],
            ["historical", "Não observados"], ["unmapped", "Não parametrizados"], ["warning", "Com alerta"],
          ] as Array<[CatalogFilter, string]>).map(([value, label]) => (
            <DtoButton key={value} size="sm" tone={filter === value ? "accent" : "default"} onClick={() => setFilter(value)}>{label}</DtoButton>
          ))}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {fields.length ? fields.map((field) => (
          <FieldEditor key={`${configuration.revision}-${field.key}`} configuration={configuration} field={field} onSave={onSave} />
        )) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--shell-line-strong)] px-4 py-8 text-center text-sm text-[var(--shell-muted)]">Nenhum campo corresponde aos filtros atuais.</div>
        )}
      </div>
      </DtoPanel>
    </div>
  );
}
