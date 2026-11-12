"use client";
import { useEffect, useMemo, useState } from "react";
import { ListFilter, RefreshCw, Search, Settings2, X } from "lucide-react";
import type { EChartsOption } from "echarts";
import DtoEChart from "@/features/dpo/ui/dto/DtoEChart";
import {
  DtoBadge,
  DtoButton,
  DtoMetricCard,
  DtoPanel,
  DtoStatePanel,
} from "@/features/dpo/ui/dto/DtoPrimitives";
import {
  computeDtoTracking,
  computeDtoTrackingMonthSummary,
  computeDtoTrackingYear,
  getDtoTrackingRowBySubjectKey,
  getDtoTrackingYearDates,
  getDtoTrackingYears,
  resolveTrackingSnapshotPeriod,
} from "@/features/dpo/lib/dtoTracking";
import {
  formatDtoDate,
  formatDtoNumber,
  formatDtoPercentage,
  normalizeSearchText,
} from "@/features/dpo/lib/dtoFormatters";
import type {
  DtoFormDetail,
  DtoTrackingContext,
  DtoTrackingStatus,
  DtoTrackedSubject,
  DtoTrackingMonthCell,
  DtoTrackingMonthStatus,
  DtoTrackingYearRow,
  WorkforceFilterCatalog,
  WorkforceTrackingFilter,
} from "@/features/dpo/model/dtoTypes";
import { useFormManagerConfig } from "@/features/dpo/model/formManagerConfig";
import { Typography } from "@/shared/ui/typography";
const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
const STATUS_LABELS: Record<DtoTrackingMonthStatus, string> = {
  realized: "Realizado",
  risk: "Risco",
  covered: "Coberto",
  due: "Aviso",
  missed: "Vencido",
  notApplicable: "Não aplicável",
  future: "Sem obrigação no período",
  outOfSnapshot: "Fora do snapshot",
  unknown: "Histórico insuficiente",
};
const STATUS_COLORS: Record<DtoTrackingMonthStatus, string> = {
  realized: "#16a34a",
  risk: "#e67932",
  covered: "#16a34a",
  due: "#d99a18",
  missed: "#dc4f4f",
  notApplicable: "#64748b",
  future: "#94a3b8",
  outOfSnapshot: "#475569",
  unknown: "#8b5cf6",
};
const STATUS_ORDER: DtoTrackingMonthStatus[] = [
  "realized",
  "risk",
  "covered",
  "due",
  "missed",
  "notApplicable",
  "future",
  "outOfSnapshot",
  "unknown",
];
type TrackingFilters = {
  location: string;
  employeeKey: string;
  area: string;
  status: "" | DtoTrackingMonthStatus;
  workforceFilterId: string;
};
type ContextResult = {
  key: string;
  context: DtoTrackingContext | null;
  error: string | null;
};
type MatrixEvent = {
  componentType?: string;
  data?: [number, number, number];
  seriesType?: string;
  value?: string;
};
const EMPTY_FILTERS: TrackingFilters = {
  location: "",
  employeeKey: "",
  area: "",
  status: "",
  workforceFilterId: "",
};
function escapeHtml(value: string): string {
  return value.replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        character
      ] || character,
  );
}
function formatDates(dates: Date[]): string {
  return dates.length
    ? dates.map((date) => formatDtoDate(date)).join(", ")
    : "Nenhuma";
}
function cellDescription(cell: DtoTrackingMonthCell): string {
  if (cell.status === "outOfSnapshot")
    return "Período fora da janela carregada.";
  if (cell.status === "unknown")
    return "Sem histórico suficiente antes do início do snapshot.";
  if (
    cell.status === "covered" &&
    cell.coverageRealization &&
    cell.coverageEndDate
  )
    return `Coberto pela realização de ${formatDtoDate(cell.coverageRealization)} até ${formatDtoDate(cell.coverageEndDate)}.`;
  if ((cell.status === "due" || cell.status === "risk") && cell.dueDate)
    return `Prazo vence em ${formatDtoDate(cell.dueDate)}.`;
  if (cell.status === "missed" && cell.dueDate)
    return `Prazo venceu em ${formatDtoDate(cell.dueDate)} sem realização.`;
  return STATUS_LABELS[cell.status];
}
function FilterDialog({
  catalog,
  filters,
  onChange,
  onClose,
  rows,
  sharedFilters,
}: {
  catalog: WorkforceFilterCatalog | null;
  filters: TrackingFilters;
  onChange: (filters: TrackingFilters) => void;
  onClose: () => void;
  rows: DtoTrackingYearRow[];
  sharedFilters: WorkforceTrackingFilter[];
}) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) =>
      event.key === "Escape" && onClose();
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);
  const selectClass =
    "mt-2 h-11 w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 text-sm";
  return (
    <div
      role="presentation"
      onMouseDown={(event) => event.currentTarget === event.target && onClose()}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-[var(--shell-overlay)] p-0 backdrop-blur-sm sm:items-center sm:p-5"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tracking-filters-title"
        className="w-full rounded-t-[30px] border border-[color:var(--shell-line)] bg-[var(--shell-surface-strong)] p-5 shadow-2xl sm:max-w-2xl sm:rounded-[30px] sm:p-6"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <Typography variant="overline">Acompanhamento</Typography>
            <Typography
              id="tracking-filters-title"
              as="h2"
              variant="sectionTitle"
              className="mt-2"
            >
              Filtros
            </Typography>
          </div>
          <DtoButton
            size="icon-sm"
            aria-label="Fechar filtros"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </DtoButton>
        </header>
        <p className="mt-3 text-sm leading-6 text-[var(--shell-muted)]">
          Os filtros atualizam em conjunto os cartões, o gráfico mensal, a
          matriz histórica e a tabela. O status considera o mês selecionado.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold text-[var(--shell-text)]">
            Local
            <select
              value={filters.location}
              onChange={(event) =>
                onChange({ ...filters, location: event.target.value })
              }
              className={selectClass}
            >
              <option value="">Todos os locais</option>
              {(catalog?.locations || []).map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--shell-text)]">
            Colaborador
            <select
              value={filters.employeeKey}
              onChange={(event) =>
                onChange({ ...filters, employeeKey: event.target.value })
              }
              className={selectClass}
            >
              <option value="">Todos os colaboradores</option>
              {rows.map((row) => (
                <option key={row.subject.key} value={row.subject.key}>
                  {row.subject.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--shell-text)]">
            Setor
            <select
              value={filters.area}
              onChange={(event) =>
                onChange({ ...filters, area: event.target.value })
              }
              className={selectClass}
            >
              <option value="">Todos os setores</option>
              {(catalog?.areas || []).map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--shell-text)]">
            Status mensal
            <select
              value={filters.status}
              onChange={(event) =>
                onChange({
                  ...filters,
                  status: event.target.value as TrackingFilters["status"],
                })
              }
              className={selectClass}
            >
              <option value="">Todos</option>
              {STATUS_ORDER.filter(
                (status) =>
                  ![
                    "future",
                    "notApplicable",
                    "outOfSnapshot",
                    "unknown",
                  ].includes(status),
              ).map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-[var(--shell-text)] sm:col-span-2">
            Filtro público
            <select
              value={filters.workforceFilterId}
              onChange={(event) =>
                onChange({ ...filters, workforceFilterId: event.target.value })
              }
              className={selectClass}
            >
              <option value="">Nenhum filtro público</option>
              {sharedFilters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <footer className="mt-6 flex justify-end gap-2">
          <DtoButton onClick={() => onChange(EMPTY_FILTERS)}>
            Limpar filtros
          </DtoButton>
          <DtoButton tone="accent" onClick={onClose}>
            Aplicar filtros
          </DtoButton>
        </footer>
      </section>
    </div>
  );
}
function FilterChips({
  filters,
  rows,
  sharedFilters,
  onChange,
}: {
  filters: TrackingFilters;
  rows: DtoTrackingYearRow[];
  sharedFilters: WorkforceTrackingFilter[];
  onChange: (filters: TrackingFilters) => void;
}) {
  const labels: Array<[keyof TrackingFilters, string, string]> = [
    ["location", "Local", filters.location],
    [
      "employeeKey",
      "Colaborador",
      rows.find((row) => row.subject.key === filters.employeeKey)?.subject
        .name || "",
    ],
    ["area", "Setor", filters.area],
    ["status", "Status", filters.status ? STATUS_LABELS[filters.status] : ""],
    [
      "workforceFilterId",
      "Filtro público",
      sharedFilters.find((item) => item.id === filters.workforceFilterId)
        ?.name || "",
    ],
  ];
  const active = labels.filter(([, , value]) => Boolean(value));
  if (!active.length) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {active.map(([key, label, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange({ ...filters, [key]: "" })}
          className="rounded-full border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--shell-text)]"
        >
          {label}: {value} ×
        </button>
      ))}
      <button
        type="button"
        className="text-xs font-semibold text-[var(--shell-accent)]"
        onClick={() => onChange(EMPTY_FILTERS)}
      >
        Limpar filtros
      </button>
    </div>
  );
}
const DEADLINE_STYLES: Record<DtoTrackingStatus, { label: string; color: string; background: string }> = {
  current: { label: "No prazo", color: "#16a34a", background: "rgba(22,163,74,0.14)" },
  dueSoon: { label: "Aviso", color: "#d99a18", background: "rgba(217,154,24,0.14)" },
  risk: { label: "Risco", color: "#e67932", background: "rgba(230,121,50,0.14)" },
  overdue: { label: "Vencido", color: "#dc4f4f", background: "rgba(220,79,79,0.14)" },
  never: { label: "Sem realização / prazo desconhecido", color: "#94a3b8", background: "rgba(148,163,184,0.10)" },
};
function CurrentStatusTable({ rows, subjects }: { rows: DtoTrackingYearRow[]; subjects: DtoTrackedSubject[] }) {
  const currentByKey = new Map(subjects.map((subject) => [subject.key, subject]));
  return (
    <DtoPanel className="overflow-hidden p-5 sm:p-6">
      <Typography variant="overline">Situação atual detalhada</Typography>
      <Typography as="h2" variant="cardTitle" className="mt-2">
        População atual do acompanhamento
      </Typography>
      <p className="mt-3 text-xs text-[var(--shell-muted)]">
        No prazo: mais de 30 dias · Aviso: 11 a 30 dias · Risco: 0 a 10 dias · Vencido: prazo ultrapassado.
        Dias negativos indicam atraso. Referência: data de hoje.
      </p>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-[color:var(--shell-line)] text-xs uppercase tracking-wide text-[var(--shell-muted)]">
            <tr>
              <th className="pb-3 pr-4">Colaborador</th>
              <th className="pb-3 pr-4">Função</th>
              <th className="pb-3 pr-4">Admissão</th>
              <th className="pb-3 pr-4">Situação atual</th>
              <th className="pb-3 pr-4">Realizações</th>
              <th className="pb-3 pr-4">Última realização</th>
              <th className="pb-3 pr-4">Próximo prazo</th>
              <th className="pb-3">Dias para vencer</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const subject = currentByKey.get(row.subject.key) || row.subject;
              const status = DEADLINE_STYLES[subject.status];
              return <tr
                key={subject.key}
                style={{ backgroundColor: status.background, borderLeft: `4px solid ${status.color}` }}
                className="border-b border-[color:var(--shell-line)] last:border-0"
              >
                <td className="py-3 pr-4 font-semibold text-[var(--shell-text)]">
                  {subject.name}
                </td>
                <td className="py-3 pr-4">{subject.function || "—"}</td>
                <td className="py-3 pr-4">
                  {formatDtoDate(subject.admissionDate)}
                </td>
                <td className="py-3 pr-4">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                    {status.label}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  {formatDtoNumber(subject.applications)}
                </td>
                <td className="py-3 pr-4">
                  {formatDtoDate(subject.lastRealization)}
                </td>
                <td className="py-3 pr-4">
                  {formatDtoDate(subject.nextDueDate)}
                </td>
                <td className="py-3 font-semibold tabular-nums">
                  {subject.daysUntilDue === null ? "—" : formatDtoNumber(subject.daysUntilDue)}
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>
    </DtoPanel>
  );
}
export default function DtoTrackingPanel({
  detail,
  onConfigure,
}: {
  detail: DtoFormDetail;
  onConfigure: () => void;
}) {
  const { api } = useFormManagerConfig();
  const years = useMemo(() => getDtoTrackingYears(detail), [detail]);
  const snapshotPeriod = useMemo(
    () => resolveTrackingSnapshotPeriod(detail),
    [detail],
  );
  const sourceEnd = useMemo(
    () => snapshotPeriod.end || new Date(),
    [snapshotPeriod.end],
  );
  const [year, setYear] = useState(
    () => years.at(-1) || new Date().getFullYear(),
  );
  const [month, setMonth] = useState(() => sourceEnd.getMonth());
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<TrackingFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hoverInfo, setHoverInfo] = useState(
    "Passe o cursor sobre um mês ou colaborador para ver o resumo contextual.",
  );
  const [contextReload, setContextReload] = useState(0);
  const [contextResult, setContextResult] = useState<ContextResult | null>(
    null,
  );
  const [catalog, setCatalog] = useState<WorkforceFilterCatalog | null>(null);
  const [sharedFilters, setSharedFilters] = useState<WorkforceTrackingFilter[]>(
    [],
  );
  const needsContext = detail.configuration.tracking.mode === "COLLABORATOR";
  const contextKey = needsContext
    ? `${detail.form.id}:${detail.configuration.revision}:${filters.workforceFilterId}:${contextReload}`
    : null;
  useEffect(() => {
    if (years.includes(year)) return;
    const latest = years.at(-1) || sourceEnd.getFullYear();
    const timer = window.setTimeout(() => {
      setYear(latest);
      setMonth(latest === sourceEnd.getFullYear() ? sourceEnd.getMonth() : 11);
    });
    return () => window.clearTimeout(timer);
  }, [sourceEnd, year, years]);
  useEffect(() => {
    if (!contextKey) return;
    const controller = new AbortController();
    void api
      .getTrackingContext(
        detail.form.id,
        { workforceFilterId: filters.workforceFilterId || undefined },
        controller.signal,
      )
      .then((context) =>
        setContextResult({ key: contextKey, context, error: null }),
      )
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setContextResult({
          key: contextKey,
          context: null,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível consultar o cadastro.",
        });
      });
    return () => controller.abort();
  }, [api, contextKey, detail.form.id, filters.workforceFilterId]);
  useEffect(() => {
    if (!needsContext) return;
    const controller = new AbortController();
    void Promise.all([
      api.getWorkforceFilterCatalog(controller.signal),
      api.listWorkforceFilters(controller.signal),
    ])
      .then(([nextCatalog, nextFilters]) => {
        setCatalog(nextCatalog);
        setSharedFilters(nextFilters);
      })
      .catch(() => {
        setCatalog(null);
        setSharedFilters([]);
      });
    return () => controller.abort();
  }, [api, needsContext]);
  const context =
    contextResult?.key === contextKey ? contextResult.context : null;
  const tracking = useMemo(
    () => computeDtoTracking(detail, context),
    [detail, context],
  );
  const annual = useMemo(
    () => computeDtoTrackingYear(detail, context, year),
    [detail, context, year],
  );
  const filteredRows = useMemo(
    () =>
      annual.rows.filter((row) => {
        const query = normalizeSearchText(search);
        const cell = row.months[month];
        return (
          (!query ||
            normalizeSearchText(
              `${row.subject.name} ${row.subject.function || ""}`,
            ).includes(query)) &&
          (!filters.location || row.location === filters.location) &&
          (!filters.employeeKey || row.subject.key === filters.employeeKey) &&
          (!filters.area || row.area === filters.area) &&
          (!filters.status || cell.status === filters.status)
        );
      }),
    [annual.rows, filters, month, search],
  );
  const rowBySubjectKey = useMemo(
    () => new Map(filteredRows.map((row) => [row.subject.key, row])),
    [filteredRows],
  );
  const summary = useMemo(
    () => computeDtoTrackingMonthSummary(filteredRows, year, month),
    [filteredRows, year, month],
  );
  const subjectLabel =
    tracking.mode === "ENVIRONMENT" ? "ambientes" : "colaboradores";
  const historicalSubjectLabel =
    tracking.mode === "ENVIRONMENT"
      ? "ambientes no histórico"
      : "colaboradores no histórico";
  if (!tracking.configured)
    return (
      <DtoStatePanel
        title="Defina a forma de acompanhamento"
        description="Configure a periodicidade e a população para exibir a visão histórica."
        action={
          <DtoButton tone="accent" onClick={onConfigure}>
            <Settings2 aria-hidden="true" /> Configurar acompanhamento
          </DtoButton>
        }
      />
    );
  if (needsContext && contextKey !== contextResult?.key)
    return (
      <DtoStatePanel
        title="Consultando o cadastro de colaboradores"
        description="A população oficial e os vínculos das realizações estão sendo carregados."
      />
    );
  if (needsContext && contextResult?.error)
    return (
      <DtoStatePanel
        title="Não foi possível montar o acompanhamento"
        description={contextResult.error}
        action={
          <DtoButton onClick={() => setContextReload((value) => value + 1)}>
            <RefreshCw aria-hidden="true" /> Tentar novamente
          </DtoButton>
        }
      />
    );
  const pieOption: EChartsOption = {
    color: [
      STATUS_COLORS.realized,
      STATUS_COLORS.risk,
      STATUS_COLORS.covered,
      STATUS_COLORS.due,
      STATUS_COLORS.missed,
    ],
    tooltip: { trigger: "item" },
    legend: { bottom: 0, textStyle: { color: "#94a3b8" } },
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "43%"],
        data: [
          { name: "Realizados", value: summary.realized },
          { name: "Risco", value: summary.risk },
          { name: "Cobertos", value: summary.covered },
          { name: "Aviso", value: summary.due },
          { name: "Vencidos", value: summary.missed },
        ],
      },
    ],
  };
  const matrixOption: EChartsOption = {
    animation: false,
    tooltip: {
      position: "top",
      formatter: (raw) => {
        const params = raw as MatrixEvent;
        const point = params.data;
        if (!point) return "";
        const row = filteredRows[point[1]];
        const cell = row?.months[point[0]];
        if (!row || !cell) return "";
        return `<strong>${escapeHtml(row.subject.name)}</strong><br/>${MONTHS[cell.month]}/${cell.year}<br/><strong>${cell.historical && cell.status === "realized" ? "Realizado histórico" : STATUS_LABELS[cell.status]}</strong><br/>Realizações do mês: ${escapeHtml(formatDates(cell.realizations))}<br/>${escapeHtml(cellDescription(cell))}`;
      },
    },
    grid: { top: 20, right: 22, bottom: 70, left: 180 },
    xAxis: {
      type: "category",
      data: MONTHS,
      triggerEvent: true,
      axisLabel: { color: "#94a3b8" },
      splitArea: { show: true },
    },
    yAxis: {
      type: "category",
      data: filteredRows.map((row) => row.subject.key),
      triggerEvent: true,
      axisLabel: {
        color: "#94a3b8",
        width: 155,
        overflow: "truncate",
        formatter: (key: string) =>
          rowBySubjectKey.get(key)?.subject.name || key,
      },
      splitArea: { show: true },
    },
    visualMap: {
      show: false,
      pieces: [...STATUS_ORDER.map((status, index) => ({
        value: index,
        color: STATUS_COLORS[status],
      })), { value: STATUS_ORDER.length, color: "#8bd1a5" }],
    },
    dataZoom: [
      { type: "inside", yAxisIndex: 0 },
      { type: "slider", yAxisIndex: 0, right: 2, width: 12 },
    ],
    series: [
      {
        type: "heatmap",
        data: filteredRows.flatMap((row, rowIndex) =>
          row.months.map((cell, cellMonth) => [
            cellMonth,
            rowIndex,
            cell.historical && cell.status === "realized" ? STATUS_ORDER.length : STATUS_ORDER.indexOf(cell.status),
          ]),
        ),
        label: { show: false },
        emphasis: { itemStyle: { borderColor: "#f8fafc", borderWidth: 2 } },
        itemStyle: {
          borderColor: "#17212b",
          borderWidth: 2,
        },
      },
    ],
  };
  const onMatrixEvent = (raw: unknown) => {
    const params = raw as MatrixEvent;
    if (params.seriesType === "heatmap") setMonth(Number(params.data?.[0]));
    if (params.componentType === "xAxis") {
      const next = MONTHS.indexOf(params.value || "");
      if (next >= 0) setMonth(next);
    }
  };
  const onMatrixHover = (raw: unknown) => {
    const params = raw as MatrixEvent;
    if (params.componentType === "xAxis") {
      const index = MONTHS.indexOf(params.value || "");
      if (index < 0) return;
      const value = computeDtoTrackingMonthSummary(filteredRows, year, index);
      setHoverInfo(
        `${MONTHS[index]}/${year}: ${value.applicable} aplicáveis, ${value.realized} realizados, ${value.risk} em risco, ${value.covered} cobertos, ${value.due} em aviso, ${value.missed} pendentes e ${formatDtoPercentage(value.coveragePercentage)} de cobertura.`,
      );
      return;
    }
    if (params.componentType === "yAxis") {
      const row = getDtoTrackingRowBySubjectKey(
        filteredRows,
        String(params.value || ""),
      );
      if (!row) return;
      const isCurrentYear = year === new Date().getFullYear();
      const dates = getDtoTrackingYearDates(
        row,
        isCurrentYear
          ? snapshotPeriod.end || new Date()
          : new Date(year, 11, 31),
      );
      const dueLabel = isCurrentYear
        ? "Próximo vencimento conhecido"
        : "Último vencimento conhecido no ano";
      const dueDate = isCurrentYear ? dates.nextDueDate : dates.lastDueDate;
      setHoverInfo(
        `${row.subject.name} · ${row.subject.function || "Função não informada"} · ${row.location || "Local não informado"} · Setor: ${row.area || "não informado"} · Admissão: ${formatDtoDate(row.subject.admissionDate)} · ${row.realizations} realização(ões) no ano · Última realização no ano: ${formatDtoDate(dates.lastRealization)} · ${row.realizedMonths} meses realizados · ${row.coveredMonths} meses cobertos · ${row.pendingMonths} meses pendentes · ${dueLabel}: ${formatDtoDate(dueDate)}.`,
      );
    }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DtoBadge tone="accent">
          {tracking.mode === "ENVIRONMENT"
            ? "Acompanhamento por ambiente"
            : "Acompanhamento por colaborador"}
        </DtoBadge>
        <select
          aria-label="Ano do acompanhamento"
          value={year}
          onChange={(event) => {
            const nextYear = Number(event.target.value);
            setYear(nextYear);
            setMonth(
              nextYear === sourceEnd.getFullYear() ? sourceEnd.getMonth() : 11,
            );
          }}
          className="h-10 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 text-sm font-semibold text-[var(--shell-text)]"
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <DtoMetricCard
          label="Aplicáveis"
          value={formatDtoNumber(summary.applicable)}
        />
        <DtoMetricCard
          label="Realizados"
          tone="accent"
          value={formatDtoNumber(summary.realized)}
        />
        <DtoMetricCard
          label="Cobertos"
          tone="accent"
          value={formatDtoNumber(summary.covered)}
        />
        <DtoMetricCard
          label="Pendentes"
          tone={summary.missed ? "danger" : "default"}
          value={formatDtoNumber(summary.missed + summary.due + summary.risk)}
        />
        <DtoMetricCard
          label="Cobertura"
          tone="accent"
          value={formatDtoPercentage(summary.coveragePercentage)}
        />
      </section>
      <DtoPanel className="p-5 sm:p-6">
        <div className="space-y-4">
          {/* Cabeçalho */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="shrink-0">
              <Typography variant="overline">Recorte histórico</Typography>

              <Typography as="h2" variant="cardTitle" className="mt-2">
                {MONTHS[month]}/{year}
              </Typography>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center lg:w-auto">
              <label className="relative w-full sm:w-80">
                <span className="sr-only">Buscar colaborador</span>

                <Search
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--shell-muted)]"
                />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar colaborador"
                  className="w-full rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] py-2.5 pl-10 pr-3 text-sm text-[var(--shell-text)]"
                />
              </label>

              {tracking.mode === "COLLABORATOR" ? (
                <DtoButton
                  onClick={() => setFiltersOpen(true)}
                  className="shrink-0"
                >
                  <ListFilter aria-hidden="true" />
                  Filtros
                </DtoButton>
              ) : null}
            </div>
          </div>

          {/* Filtros + informação do recorte */}
          <div className="flex flex-col gap-3">
            <FilterChips
              filters={filters}
              rows={annual.rows}
              sharedFilters={sharedFilters}
              onChange={setFilters}
            />

            <p className="text-sm text-[var(--shell-muted)]">
              <strong className="text-[var(--shell-text)]">
                {formatDtoNumber(summary.applicable)} {subjectLabel} aplicáveis
              </strong>{" "}
              em {MONTHS[month]}/{year}, de {formatDtoNumber(filteredRows.length)}{" "}
              {historicalSubjectLabel}. O gráfico considera somente os aplicáveis
              no mês; a matriz preserva o histórico anual e a tabela abaixo
              representa a situação atual, calculada na data de hoje.
            </p>
          </div>
        </div>
      </DtoPanel>
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <DtoPanel className="p-5 sm:p-6">
          <Typography variant="overline">Cobertura mensal</Typography>
          <Typography as="h2" variant="cardTitle" className="mt-2">
            Situação em {MONTHS[month]}/{year}
          </Typography>
          <DtoEChart
            ariaLabel={`Situação da periodicidade em ${MONTHS[month]} de ${year}`}
            className="mt-3 h-80"
            option={pieOption}
          />
        </DtoPanel>
        <DtoPanel className="p-5 sm:p-6">
          <Typography variant="overline">Visão histórica</Typography>
          <Typography as="h2" variant="cardTitle" className="mt-2">
            Matriz anual de acompanhamento
          </Typography>
          <Typography variant="caption" className="mt-1">
            Clique em uma célula ou mês para alterar o período em foco.
          </Typography>
          <div className="mt-2 text-xs text-[var(--shell-muted)]"><span style={{ color: "#8bd1a5" }}>■</span> Realização histórica</div>
          <DtoEChart
            ariaLabel={`Matriz anual para ${year}`}
            className="mt-3 h-[40rem] min-h-96"
            option={matrixOption}
            onEvents={{ click: onMatrixEvent, mouseover: onMatrixHover }}
          />
          <aside
            role="status"
            className="mt-3 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--shell-muted)]"
          >
            {hoverInfo}
          </aside>
        </DtoPanel>
      </div>
      <CurrentStatusTable rows={filteredRows} subjects={tracking.subjects} />
      {filtersOpen ? (
        <FilterDialog
          catalog={catalog}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          rows={annual.rows}
          sharedFilters={sharedFilters}
        />
      ) : null}
    </div>
  );
}
