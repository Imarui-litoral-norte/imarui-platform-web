"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { computeDtoTracking } from "@/features/dpo/lib/dtoTracking";
import {
  computePlanningCalendarEntries,
  computePlanningOccurrences,
  monthCalendarDays,
  sameCalendarDay,
  type DtoPlanningCalendarEntry,
  type DtoPlanningOccurrenceStatus,
} from "@/features/dpo/lib/dtoPlanning";
import { formatDtoDate, formatDtoNumber, parseDtoDate } from "@/features/dpo/lib/dtoFormatters";
import type {
  DtoFormDetail,
  DtoPlanningItem,
  DtoPlanningPayload,
  DtoPlanningRecurrence,
  DtoTrackedSubject,
  DtoTrackingContext,
  WorkforceFilterCatalog,
} from "@/features/dpo/model/dtoTypes";
import { useFormManagerConfig } from "@/features/dpo/model/formManagerConfig";
import {
  DtoBadge,
  DtoButton,
  DtoMetricCard,
  DtoPanel,
  DtoStatePanel,
} from "@/features/dpo/ui/dto/DtoPrimitives";
import { Typography } from "@/shared/ui/typography";
import DtoEmployeeSelectionDialog, { type DtoEmployeeSelectionOption } from "@/features/dpo/ui/dto/DtoEmployeeSelectionDialog";
import { exportPlanningWeekPng, startOfPlanningWeek } from "@/features/dpo/lib/dtoPlanningExport";

const STATUS_LABELS: Record<DtoPlanningOccurrenceStatus, string> = {
  completed: "Realizado",
  pending: "Pendente",
  missed: "Não realizado",
  upcoming: "Programado",
};

const RECURRENCE_LABELS: Record<DtoPlanningRecurrence, string> = {
  ONCE: "Uma vez",
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
};

interface PlanningDraft {
  assigneeKey: string;
  targetKeys: string[];
  startDate: string;
  endDate: string;
  recurrence: DtoPlanningRecurrence;
  targetCount: number;
  targetsPerDay: number;
}

function localIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function initialDraft(targetDate?: Date): PlanningDraft {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const date = localIsoDate(targetDate || tomorrow);
  return {
    assigneeKey: "",
    targetKeys: [],
    startDate: date,
    endDate: date,
    recurrence: "ONCE",
    targetCount: 1,
    targetsPerDay: 1,
  };
}

function addDays(value: string, days: number): string {
  const date = parseDtoDate(value);
  if (!date) return value;
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function splitTargetsByDay(keys: string[], perDay: number): string[][] {
  const size = Math.max(1, Math.floor(perDay) || 1);
  return Array.from({ length: Math.ceil(keys.length / size) }, (_, index) =>
    keys.slice(index * size, (index + 1) * size),
  );
}

function dueLabel(subject: DtoTrackedSubject): string {
  if (subject.status === "never") return "Sem realização";
  if (subject.daysUntilDue === null) return "Pendente";
  if (subject.daysUntilDue < 0) return `${Math.abs(subject.daysUntilDue)} dia(s) em atraso`;
  if (subject.daysUntilDue === 0) return "Prazo vence hoje";
  return `${subject.daysUntilDue} dia(s) até o prazo`;
}

function occurrenceTone(status: DtoPlanningOccurrenceStatus) {
  if (status === "completed") return "accent" as const;
  if (status === "missed") return "danger" as const;
  return "default" as const;
}

function targetInitials(value: string): string {
  const words = value.trim().split(/\s+/).filter(Boolean);
  return words.length > 1
    ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
    : (words[0] || "?").slice(0, 2).toUpperCase();
}

function calendarTargetClass(status: DtoPlanningOccurrenceStatus): string {
  if (status === "completed") {
    return "border-[color:var(--shell-accent)] bg-[var(--shell-accent-soft)] text-[var(--shell-accent)]";
  }
  if (status === "missed") {
    return "border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] text-[var(--shell-danger)]";
  }
  if (status === "pending") return "border-amber-400/70 bg-amber-400/10 text-amber-300";
  return "border-[color:var(--shell-line-strong)] bg-[var(--shell-surface-muted)] text-[var(--shell-muted)]";
}

function consolidateCalendarTargets(entries: DtoPlanningCalendarEntry[]) {
  const priority: Record<DtoPlanningOccurrenceStatus, number> = {
    completed: 1,
    upcoming: 2,
    pending: 3,
    missed: 4,
  };
  const targets = new Map<string, DtoPlanningCalendarEntry>();
  entries.forEach((entry) => {
    const existing = targets.get(entry.targetKey);
    if (!existing || priority[entry.status] > priority[existing.status]) {
      targets.set(entry.targetKey, entry);
    }
  });
  return [...targets.values()];
}

const fieldClass =
  "mt-1.5 w-full rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2.5 text-sm text-[var(--shell-text)] outline-none focus:border-[color:var(--shell-accent)]";

export default function DtoPlanningPanel({ detail }: { detail: DtoFormDetail }) {
  const { api } = useFormManagerConfig();
  const [items, setItems] = useState<DtoPlanningItem[]>([]);
  const [catalog, setCatalog] = useState<WorkforceFilterCatalog | null>(null);
  const [context, setContext] = useState<DtoTrackingContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PlanningDraft>(initialDraft);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [applicantPickerOpen, setApplicantPickerOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportDate, setExportDate] = useState(() => localIsoDate(new Date()));
  const [activeDay, setActiveDay] = useState<Date | null>(null);
  const launchFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api.getPlanning(detail.form.id, controller.signal),
      api.getWorkforceFilterCatalog(controller.signal),
      api.getTrackingContext(detail.form.id, undefined, controller.signal),
    ]).then(([planning, workforceCatalog, trackingContext]) => {
      setItems(planning.items);
      setCatalog(workforceCatalog);
      setContext(trackingContext);
    }).catch((cause: unknown) => {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o planejamento.");
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [api, detail.form.id, detail.configuration.revision, reload]);

  const tracking = useMemo(() => computeDtoTracking(detail, context), [context, detail]);
  const collaboratorMode = tracking.mode === "COLLABORATOR";
  const employeeNamesByKey = useMemo(() => Object.fromEntries([
    ...(catalog?.employees || []),
    ...(context?.employees || []),
  ].map((employee) => [employee.key, employee.name])), [catalog, context]);
  const applicants = useMemo(() => {
    const configuredKeys = new Set(detail.configuration.tracking.applicant_employee_keys || []);
    return (catalog?.employees || []).filter((employee) => configuredKeys.has(employee.key));
  }, [catalog?.employees, detail.configuration.tracking.applicant_employee_keys]);
  const applicantByKey = useMemo(
    () => new Map(applicants.map((employee) => [employee.key, employee])),
    [applicants],
  );
  const occurrences = useMemo(() => computePlanningOccurrences({
    context,
    detail,
    items,
  }), [context, detail, items]);
  const calendarEntries = useMemo(() => computePlanningCalendarEntries({
    collaboratorMode,
    context,
    employeeNamesByKey,
    occurrences,
  }), [collaboratorMode, context, employeeNamesByKey, occurrences]);
  const calendarDays = useMemo(() => monthCalendarDays(month), [month]);
  const monthOccurrences = occurrences.filter((occurrence) =>
    occurrence.date.getFullYear() === month.getFullYear()
      && occurrence.date.getMonth() === month.getMonth(),
  );
  const monthCalendarTargets = calendarEntries.filter((entry) =>
    entry.occurrence.date.getFullYear() === month.getFullYear()
      && entry.occurrence.date.getMonth() === month.getMonth(),
  );
  const plannedTargetKeys = useMemo(() => new Set(
    calendarEntries
      .filter((entry) => entry.targetKind === "collaborator")
      .map((entry) => entry.targetKey),
  ), [calendarEntries]);
  const recommendations = tracking.subjects.filter((subject) =>
    (subject.status === "never" || subject.status === "overdue" || (subject.status === "dueSoon" || subject.status === "risk"))
      && !plannedTargetKeys.has(subject.key),
  ).slice(0, 16);
  const applicableTargets = tracking.subjects.filter((subject) =>
    subject.status === "never" || subject.status === "overdue" || (subject.status === "dueSoon" || subject.status === "risk"),
  );
  const catalogEmployeeByKey = useMemo(() => new Map((catalog?.employees || []).map((employee) => [employee.key, employee])), [catalog?.employees]);
  const targetOptions = useMemo<DtoEmployeeSelectionOption[]>(() => applicableTargets.map((subject) => {
    const employee = catalogEmployeeByKey.get(subject.key);
    return {
      key: subject.key,
      name: subject.name,
      function: subject.function,
      location: employee?.location || null,
      area: employee?.area || employee?.location || null,
      badgeLabel: dueLabel(subject),
      badgeTone: (subject.status === "dueSoon" || subject.status === "risk") ? "default" : "danger",
    };
  }), [applicableTargets, catalogEmployeeByKey]);
  const completed = monthOccurrences.filter((item) => item.status === "completed").length;
  const missed = monthOccurrences.filter((item) => item.status === "missed").length;
  const pending = monthOccurrences.filter((item) =>
    item.status === "pending" || item.status === "upcoming",
  ).length;
  const hasApplicantField = detail.configuration.fields.some((field) => field.role === "APPLIER");
  const activeDayEntries = activeDay
    ? consolidateCalendarTargets(calendarEntries.filter((entry) => sameCalendarDay(entry.occurrence.date, activeDay)))
    : [];

  function resetDraft() {
    setEditingId(null);
    setDraft(initialDraft());
  }

  function editItem(item: DtoPlanningItem) {
    setEditingId(item.id);
    setDraft({
      assigneeKey: item.assignee_employee_key,
      targetKeys: item.target_employee_keys,
      startDate: item.start_date,
      endDate: item.end_date,
      recurrence: item.recurrence,
      targetCount: item.target_count,
      targetsPerDay: Math.max(1, item.target_employee_keys.length),
    });
  }

  function recommendTarget(key: string) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date = localIsoDate(tomorrow);
    setEditingId(null);
    setDraft((current) => ({
      ...current,
      targetKeys: [key],
      startDate: date,
      endDate: date,
      recurrence: "ONCE",
      targetCount: 1,
    }));
    setTargetPickerOpen(true);
    requestAnimationFrame(() => launchFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const selectedApplicant = applicantByKey.get(draft.assigneeKey);
    if (!selectedApplicant || !draft.startDate || (collaboratorMode && draft.targetKeys.length === 0)) return;
    setSaving(true);
    setError(null);
    const environmentPayload: DtoPlanningPayload = {
      title: selectedApplicant.name,
      assignee_employee_key: draft.assigneeKey,
      target_employee_keys: [],
      start_date: draft.startDate,
      end_date: draft.recurrence === "ONCE" ? draft.startDate : draft.endDate,
      recurrence: draft.recurrence,
      target_count: draft.targetCount,
      notes: null,
    };
    try {
      if (editingId) {
        const saved = await api.updatePlanning(detail.form.id, editingId, collaboratorMode ? {
          ...environmentPayload,
          target_employee_keys: draft.targetKeys,
          end_date: draft.startDate,
          recurrence: "ONCE",
          target_count: draft.targetKeys.length,
        } : environmentPayload);
        setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
      } else if (collaboratorMode) {
        const groups = splitTargetsByDay(draft.targetKeys, draft.targetsPerDay);
        const lastTargetDate = addDays(draft.startDate, groups.length - 1);
        if (lastTargetDate > draft.endDate) {
          throw new Error("O período selecionado não comporta a quantidade de colaboradores por dia.");
        }
        const saved = await Promise.all(groups.map((targetKeys, index) => {
          const targetDate = addDays(draft.startDate, index);
          return api.createPlanning(detail.form.id, {
            ...environmentPayload,
            target_employee_keys: targetKeys,
            start_date: targetDate,
            end_date: targetDate,
            recurrence: "ONCE",
            target_count: targetKeys.length,
          });
        }));
        setItems((current) => [...current, ...saved]);
      } else {
        const saved = await api.createPlanning(detail.form.id, environmentPayload);
        setItems((current) => [...current, saved]);
      }
      resetDraft();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar o planejamento.");
    } finally {
      setSaving(false);
    }
  }

  async function removeItem(item: DtoPlanningItem) {
    if (!window.confirm(`Excluir o planejamento “${item.title}”?`)) return;
    setError(null);
    try {
      await api.deletePlanning(detail.form.id, item.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      if (editingId === item.id) resetDraft();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível excluir o planejamento.");
    }
  }

  if (loading) {
    return <DtoStatePanel title="Carregando os lançamentos" description="Consultando calendário, aplicadores e pendências do acompanhamento." />;
  }

  if (error && !catalog) {
    return (
      <DtoStatePanel
        tone="danger"
        title="Não foi possível carregar o planejamento"
        description={error}
        action={<DtoButton tone="danger" onClick={() => { setLoading(true); setError(null); setReload((value) => value + 1); }}><RefreshCw aria-hidden="true" /> Tentar novamente</DtoButton>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {!hasApplicantField ? (
        <DtoPanel className="border-[color:var(--shell-line-strong)] p-4 text-sm text-[var(--shell-muted)]">
          Para validar automaticamente o que foi realizado, marque na Configuração o campo do SAVI que identifica o <strong className="text-[var(--shell-text)]">aplicador</strong>. Os lançamentos podem ser planejados agora, mas ficarão pendentes até essa identificação.
        </DtoPanel>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] px-4 py-3 text-sm text-[var(--shell-danger)]">{error}</div>
      ) : null}

      <section aria-labelledby="planning-kpis-title">
        <h2 id="planning-kpis-title" className="sr-only">Indicadores do planejamento mensal</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <DtoMetricCard label="Realizações no mês" value={formatDtoNumber(monthOccurrences.length)} />
          <DtoMetricCard
            label={collaboratorMode ? "Colaboradores planejados" : "Aplicadores planejados"}
            value={formatDtoNumber(monthCalendarTargets.length)}
            hint="Itens diretos exibidos no calendário."
          />
          <DtoMetricCard label="Realizadas" tone="accent" value={formatDtoNumber(completed)} hint="Validadas nas realizações do SAVI." />
          <DtoMetricCard label="Pendentes" value={formatDtoNumber(pending)} />
          <DtoMetricCard label="Não realizadas" tone={missed ? "danger" : "default"} value={formatDtoNumber(missed)} />
        </div>
      </section>

      <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.75fr)]">
        <DtoPanel className="p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Typography variant="overline">Calendário de aplicação</Typography>
              <Typography as="h2" variant="cardTitle" className="mt-2 capitalize">
                {new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(month)}
              </Typography>
              <Typography variant="caption" className="mt-1">
                {collaboratorMode
                  ? "Cada bolinha representa um colaborador alvo para a data."
                  : "Cada bolinha representa um aplicador responsável pela data."}
              </Typography>
            </div>
            <div className="flex gap-2">
              <DtoButton size="sm" onClick={() => { setExportDate(localIsoDate(month)); setExportDialogOpen(true); }}><Download aria-hidden="true" /> Exportar</DtoButton>
              <DtoButton size="sm" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft aria-hidden="true" /></DtoButton>
              <DtoButton size="sm" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoje</DtoButton>
              <DtoButton size="sm" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight aria-hidden="true" /></DtoButton>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--shell-muted)]">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => <div key={label} className="py-2">{label}</div>)}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--shell-muted)]">
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[var(--shell-accent)]" /> Realizado</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-amber-400" /> Pendente</span>
            <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-[var(--shell-danger)]" /> Não realizado</span>
          </div>
          <div className="grid grid-cols-7 overflow-hidden rounded-2xl border border-[color:var(--shell-line)]">
            {calendarDays.map((day) => {
              const dayTargets = consolidateCalendarTargets(
                calendarEntries.filter((entry) => sameCalendarDay(entry.occurrence.date, day)),
              );
              const outside = day.getMonth() !== month.getMonth();
              const today = sameCalendarDay(day, new Date());
              return (
                <button key={localIsoDate(day)} type="button" onClick={() => setActiveDay(day)} className={`min-h-28 border-b border-r border-[color:var(--shell-line)] p-1.5 text-left transition hover:bg-[var(--shell-surface-muted)] sm:min-h-32 sm:p-2 ${outside ? "bg-[var(--shell-surface-muted)] opacity-55" : "bg-[var(--shell-surface)]"}`} aria-label={`Ver planejamento de ${formatDtoDate(day)}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${today ? "bg-[var(--shell-accent)] font-bold text-slate-950" : "text-[var(--shell-muted)]"}`}>{day.getDate()}</span>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {dayTargets.slice(0, 3).map((entry) => (
                      <span
                        key={entry.key}
                        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[9px] font-bold ${calendarTargetClass(entry.status)}`}
                        title={`${entry.targetName} · ${STATUS_LABELS[entry.status]} · ${entry.plan.title}`}
                      >
                        {targetInitials(entry.targetName)}
                      </span>
                    ))}
                    {dayTargets.length > 3 ? <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-1 text-[10px] font-semibold text-[var(--shell-muted)]">+{dayTargets.length - 3}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </DtoPanel>

        <DtoPanel ref={launchFormRef} className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Typography variant="overline">{editingId ? "Editar lançamento" : "Novo lançamento"}</Typography>
              <Typography as="h2" variant="cardTitle" className="mt-2">Planejar realizações</Typography>
            </div>
            {editingId ? <DtoButton size="sm" aria-label="Cancelar edição" onClick={resetDraft}><X aria-hidden="true" /></DtoButton> : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div>
              <span className="block text-xs font-semibold text-[var(--shell-muted)]">Responsável pela aplicação</span>
              <div className="mt-1.5 rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-3"><div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate text-sm text-[var(--shell-text)]">{applicantByKey.get(draft.assigneeKey)?.name || "Selecione um aplicador"}</span><DtoButton size="sm" type="button" onClick={() => setApplicantPickerOpen(true)} disabled={!applicants.length}><Users aria-hidden="true" /> Selecionar</DtoButton></div>{applicantByKey.get(draft.assigneeKey)?.function ? <p className="mt-2 text-xs text-[var(--shell-muted)]">{applicantByKey.get(draft.assigneeKey)?.function}</p> : null}</div>
              {!applicants.length ? <p className="mt-2 text-xs text-[var(--shell-danger)]">Configure ao menos um aplicador na aba Configuração para planejar realizações.</p> : null}
            </div>
            {collaboratorMode && tracking.configured ? (
              <div>
                <span className="block text-xs font-semibold text-[var(--shell-muted)]">Colaboradores alvo</span>
                <div className="mt-1.5 rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-3">
                  <div className="flex items-center justify-between gap-3"><span className="text-sm text-[var(--shell-text)]">{draft.targetKeys.length ? `${formatDtoNumber(draft.targetKeys.length)} selecionado(s)` : "Selecione os pendentes"}</span><DtoButton size="sm" type="button" onClick={() => setTargetPickerOpen(true)}><Users aria-hidden="true" /> Selecionar</DtoButton></div>
                  {draft.targetKeys.length > 0 ? <p className="mt-2 text-xs text-[var(--shell-muted)]">A lista contém apenas colaboradores sem realização, em atraso ou próximos do prazo.</p> : null}
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[var(--shell-muted)]">{draft.targetKeys.length > 1 ? "Início do período" : "Data alvo"}
                    <input className={fieldClass} type="date" required value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value, endDate: current.targetKeys.length > 1 ? current.endDate : event.target.value }))} />
                  </label>
                  {draft.targetKeys.length > 1 ? <label className="block text-xs font-semibold text-[var(--shell-muted)]">Final do período
                    <input className={fieldClass} type="date" min={draft.startDate} required value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} />
                  </label> : null}
                  {draft.targetKeys.length > 1 ? <label className="block text-xs font-semibold text-[var(--shell-muted)]">Quantos por dia
                    <input className={fieldClass} type="number" min={1} max={1000} required value={draft.targetsPerDay} onChange={(event) => setDraft((current) => ({ ...current, targetsPerDay: Number(event.target.value) }))} />
                  </label> : null}
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[var(--shell-muted)]">Recorrência
                  <select className={fieldClass} value={draft.recurrence} onChange={(event) => setDraft((current) => ({ ...current, recurrence: event.target.value as DtoPlanningRecurrence, endDate: event.target.value === "ONCE" ? current.startDate : current.endDate }))}>
                    {Object.entries(RECURRENCE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-[var(--shell-muted)]">Realizações por período
                  <input className={fieldClass} type="number" min={1} max={1000} required value={draft.targetCount} onChange={(event) => setDraft((current) => ({ ...current, targetCount: Number(event.target.value) }))} />
                </label>
                <label className="block text-xs font-semibold text-[var(--shell-muted)]">Data inicial
                  <input className={fieldClass} type="date" required value={draft.startDate} onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value, endDate: current.recurrence === "ONCE" ? event.target.value : current.endDate }))} />
                </label>
                {draft.recurrence !== "ONCE" ? <label className="block text-xs font-semibold text-[var(--shell-muted)]">Data final
                  <input className={fieldClass} type="date" min={draft.startDate} required value={draft.endDate} onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))} />
                </label> : null}
              </div>
            )}
            <DtoButton className="w-full" tone="accent" type="submit" disabled={saving || !applicantByKey.has(draft.assigneeKey) || (collaboratorMode && draft.targetKeys.length === 0)}>
              {saving ? <RefreshCw aria-hidden="true" className="animate-spin" /> : editingId ? <Pencil aria-hidden="true" /> : <Plus aria-hidden="true" />}
              {saving ? "Salvando" : editingId ? "Atualizar lançamento" : "Adicionar ao calendário"}
            </DtoButton>
          </form>
        </DtoPanel>
      </div>

      {collaboratorMode && tracking.configured && recommendations.length > 0 ? (
        <DtoPanel className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Sparkles aria-hidden="true" className="mt-1 h-5 w-5 text-[var(--shell-accent)]" />
            <div>
              <Typography variant="overline">Recomendação operacional</Typography>
              <Typography as="h2" variant="cardTitle" className="mt-2">Quem priorizar no próximo planejamento</Typography>
              <Typography variant="caption" className="mt-1">Sugestões determinísticas geradas por atraso, ausência de realização ou proximidade do prazo. A equipe decide a data e o aplicador conforme rota e cidade.</Typography>
            </div>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {recommendations.map((subject) => (
              <button key={subject.key} type="button" onClick={() => recommendTarget(subject.key)} className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-3 text-left hover:border-[color:var(--shell-accent)]">
                <span className="block truncate text-sm font-semibold text-[var(--shell-text)]">{subject.name}</span>
                <span className="mt-1 block truncate text-xs text-[var(--shell-muted)]">{subject.function || "Função não informada"}</span>
                <span className="mt-2 inline-block"><DtoBadge tone={(subject.status === "dueSoon" || subject.status === "risk") ? "default" : "danger"}>{subject.status === "never" ? "Nunca realizado" : subject.status === "overdue" ? "Em atraso" : "Prazo próximo"}</DtoBadge></span>
              </button>
            ))}
          </div>
        </DtoPanel>
      ) : null}

      <DtoEmployeeSelectionDialog open={applicantPickerOpen} mode="single" eyebrow="Aplicadores configurados" title="Selecionar responsável" description="A lista contém somente os aplicadores definidos para este formulário." employees={applicants} selectedKeys={draft.assigneeKey ? [draft.assigneeKey] : []} onChange={(keys) => setDraft((current) => ({ ...current, assigneeKey: keys[0] || "" }))} onClose={() => setApplicantPickerOpen(false)} emptyLabel="Nenhum aplicador corresponde aos filtros." />

      <DtoEmployeeSelectionDialog open={targetPickerOpen} eyebrow="Alvos pendentes" title="Selecionar colaboradores" description="Apenas pessoas sem realização, em atraso ou próximas do prazo." employees={targetOptions} selectedKeys={draft.targetKeys} onChange={(targetKeys) => setDraft((current) => ({ ...current, targetKeys }))} onClose={() => setTargetPickerOpen(false)} emptyLabel="Nenhum colaborador pendente atende aos filtros." />

      {exportDialogOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label="Exportar calendário"><DtoPanel className="w-full max-w-md p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><Typography variant="overline">Exportar planejamento</Typography><Typography as="h2" variant="cardTitle" className="mt-2">Escolher semana</Typography><Typography variant="caption" className="mt-1">A imagem PNG horizontal mostra o calendário na metade superior e o planejamento detalhado abaixo.</Typography></div><DtoButton size="sm" aria-label="Fechar exportação" onClick={() => setExportDialogOpen(false)}><X /></DtoButton></div><label className="mt-5 block text-xs font-semibold text-[var(--shell-muted)]">Data dentro da semana<input type="date" value={exportDate} onChange={(event) => setExportDate(event.target.value)} className={fieldClass} /></label><p className="mt-3 text-xs text-[var(--shell-muted)]">Período: {formatDtoDate(startOfPlanningWeek(parseDtoDate(exportDate) || new Date()))} a {formatDtoDate(addDays(localIsoDate(startOfPlanningWeek(parseDtoDate(exportDate) || new Date())), 6))}</p><DtoButton className="mt-5 w-full" tone="accent" onClick={() => { const selectedDate = parseDtoDate(exportDate) || new Date(); exportPlanningWeekPng({ entries: calendarEntries, formName: detail.form.name, weekStart: startOfPlanningWeek(selectedDate) }); setExportDialogOpen(false); }}><Download /> Baixar PNG</DtoButton></DtoPanel></div> : null}

      {activeDay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-label={`Planejamento de ${formatDtoDate(activeDay)}`}>
          <DtoPanel className="max-h-[85vh] w-full max-w-xl overflow-y-auto p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><Typography variant="overline">Planejamento do dia</Typography><Typography as="h2" variant="cardTitle" className="mt-2">{formatDtoDate(activeDay, { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</Typography><Typography variant="caption" className="mt-1">Cada item abaixo é uma realização planejada e sua validação no SAVI.</Typography></div><DtoButton size="sm" aria-label="Fechar planejamento do dia" onClick={() => setActiveDay(null)}><X aria-hidden="true" /></DtoButton></div>
            <div className="mt-5 space-y-2">{activeDayEntries.map((entry) => <div key={entry.key} className="rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><span className="block truncate text-sm font-semibold text-[var(--shell-text)]">{entry.targetName}</span><span className="mt-1 block truncate text-xs text-[var(--shell-muted)]">{collaboratorMode ? entry.plan.title : `Aplicador · ${entry.plan.title}`}</span></div><DtoBadge tone={occurrenceTone(entry.status)}>{STATUS_LABELS[entry.status]}</DtoBadge></div><div className="mt-3 flex justify-end gap-2"><DtoButton size="sm" aria-label={`Editar ${entry.plan.title}`} onClick={() => { editItem(entry.plan); setActiveDay(null); requestAnimationFrame(() => launchFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}><Pencil aria-hidden="true" /></DtoButton><DtoButton size="sm" tone="danger" aria-label={`Excluir ${entry.plan.title}`} onClick={() => void removeItem(entry.plan)}><Trash2 aria-hidden="true" /></DtoButton></div></div>)}{activeDayEntries.length === 0 ? <div className="rounded-xl border border-dashed border-[color:var(--shell-line-strong)] px-4 py-8 text-center text-sm text-[var(--shell-muted)]"><CalendarDays aria-hidden="true" className="mx-auto mb-3 h-6 w-6" />Nenhuma realização planejada nesta data.</div> : null}</div>
            <DtoButton className="mt-5 w-full" tone="accent" onClick={() => { const day = activeDay; setActiveDay(null); setEditingId(null); setDraft(initialDraft(day)); if (collaboratorMode) setTargetPickerOpen(true); requestAnimationFrame(() => launchFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })); }}><Plus aria-hidden="true" /> Adicionar realização planejada</DtoButton>
          </DtoPanel>
        </div>
      ) : null}
    </div>
  );
}
