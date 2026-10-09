"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, ListChecks, ListFilter, RefreshCw, Search, X } from "lucide-react";
import { journeyApi } from "../api/journeyApi";
import { filterMapGroups, formatDateTime, groupByMap, hasLiveRows, paginateMapGroups,
  searchMapGroups, shouldPollJourney,
  type LiveScope } from "../lib/journeyPresentation";
import type { AnalysisRole, Indicator, JourneyItem, JourneyQuery, PeriodResponse } from "../model/types";
import JourneyAnalysis from "./JourneyAnalysis";
import { useJourneyHistory } from "./useJourneyHistory";
import { JourneyMapDialog, JourneyMapRow } from "./JourneyMapRow";
import { actionButtonClass, fieldClass, primaryButtonClass } from "./journeyControls";
import { initialTeamReportFilters, initialTeamReportSort, type TeamReportFilters, type TeamReportSort } from "../lib/journeyTeamReport";

const tabs: { id: Indicator; label: string; description: string }[] = [
  { id: "tml", label: "TML", description: "Tempo de matinal e liberação" },
  { id: "tr", label: "TR", description: "Tempo de rota do mapa" },
  { id: "ti", label: "TI", description: "Tempo interno, PFIS e PFIN" },
  { id: "jl", label: "JL", description: "Jornada operacional ou laboral" },
];

function localDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function displayDate(value: string): string {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const initialQuery = (): JourneyQuery => ({
  indicator: "tml", from: localDate(), to: localDate(), mode: "ponto",
  map: "", employeeCode: "", role: "all", expurge: "all",
});

export default function JourneyManager() {
  const [draft, setDraft] = useState<JourneyQuery>(initialQuery);
  const [query, setQuery] = useState<JourneyQuery>(draft);
  const [data, setData] = useState<PeriodResponse<JourneyItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [scope, setScope] = useState<LiveScope>("all");
  const [draftScope, setDraftScope] = useState<LiveScope>("all");
  const [activeDialog, setActiveDialog] = useState<"calendar" | "filters" | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [dateMode, setDateMode] = useState<"day" | "period">("day");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"accompaniment" | "analysis">("accompaniment");
  const [analysisRole, setAnalysisRole] = useState<AnalysisRole>("motorista");
  const [reportFilters, setReportFilters] = useState<TeamReportFilters>(initialTeamReportFilters);
  const [reportSort, setReportSort] = useState<TeamReportSort>(initialTeamReportSort);
  const effectiveRole = query.role === "all" ? analysisRole : query.role;
  const analysis = useJourneyHistory(view === "analysis", query, effectiveRole, search, scope);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedMapKey, setSelectedMapKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const requestRef = useRef<AbortController | null>(null);
  const lastSuccessRef = useRef(0);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(clock);
  }, []);

  const loadSnapshot = useCallback(async (requestedQuery: JourneyQuery, silent: boolean) => {
    if (requestRef.current) return;
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await journeyApi.get(requestedQuery, controller.signal);
      if (controller.signal.aborted) return;
      setData(response);
      setError(null);
      setRefreshNotice(null);
      lastSuccessRef.current = Date.now();
    } catch (failure) {
      if (controller.signal.aborted || failure instanceof Error && failure.name === "AbortError") return;
      const message = failure instanceof Error ? failure.message : "Não foi possível carregar a Jornada.";
      if (silent) setRefreshNotice(`Atualização não concluída: ${message}`);
      else setError(message);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (silent) setRefreshing(false);
        else setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (view !== "accompaniment") return;
    let active = true;
    requestRef.current?.abort();
    requestRef.current = null;
    queueMicrotask(() => { if (active) void loadSnapshot(query, false); });
    return () => {
      active = false;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [query, view, loadSnapshot]);

  const groups = useMemo(() => groupByMap(data?.items ?? []), [data]);
  const today = localDate();
  const scopedGroups = useMemo(() => filterMapGroups(groups, scope, today), [groups, scope, today]);
  const visibleGroups = useMemo(() => searchMapGroups(scopedGroups, search), [scopedGroups, search]);
  const pagination = useMemo(() => paginateMapGroups(visibleGroups, page, pageSize), [visibleGroups, page, pageSize]);
  const selectedGroup = visibleGroups.find((group) => group.key === selectedMapKey);
  const visibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);
  const pageItems = useMemo(() => pagination.groups.flatMap((group) => group.items), [pagination]);
  const live = hasLiveRows(pageItems, query.indicator);
  const hasExplicitLiveOrigin = view === "analysis" ? !!analysis.data?.hasLiveOrigin : groups.some((group) => group.mapOrigin === "LIVE");
  const selectedTab = tabs.find((tab) => tab.id === query.indicator) ?? tabs[0];
  const dateLabel = query.from === query.to ? displayDate(query.from) :
    `${displayDate(query.from)} – ${displayDate(query.to)}`;

  useEffect(() => {
    if (!live || view !== "accompaniment") return;
    const tick = () => {
      if (!requestRef.current && shouldPollJourney(pageItems, query.indicator, document.visibilityState)) {
        setRefreshing(true);
        void loadSnapshot(query, true);
      }
    };
    const interval = window.setInterval(tick, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible" && Date.now() - lastSuccessRef.current >= 60_000) tick();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [live, pageItems, query, view, loadSnapshot]);

  function setField<K extends keyof JourneyQuery>(key: K, value: JourneyQuery[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function startLoad() {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(true);
    setRefreshing(false);
    setError(null);
    setData(null);
    setRefreshNotice(null);
    setScope("all");
    setPage(1);
    setSelectedMapKey(null);
  }

  function reload() {
    if (view === "analysis") { analysis.reload(); return; }
    if (requestRef.current) return;
    if (!data) { setLoading(true); setError(null); }
    else setRefreshing(true);
    void loadSnapshot(query, data !== null);
  }

  function selectView(next: typeof view) {
    if (view === next) return;
    setSelectedMapKey(null);
    if (next === "accompaniment") { setLoading(true); setError(null); }
    setView(next);
  }

  function selectTab(tab: Indicator) {
    if (tab === query.indicator) return;
    startLoad();
    setSearch("");
    setDraft((current) => ({ ...current, indicator: tab }));
    setQuery((current) => ({ ...current, indicator: tab }));
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    selectTab(tabs[next].id);
    document.getElementById(`journey-tab-${tabs[next].id}`)?.focus();
  }

  function openDialog(kind: "calendar" | "filters") {
    setDraft(query);
    setDraftScope(scope);
    setDateMode(query.from === query.to ? "day" : "period");
    setDialogError(null);
    setActiveDialog(kind);
  }

  function applyDate(from: string, periodEnd: string) {
    const to = dateMode === "day" ? from : periodEnd;
    if (!from || !to || to < from) { setDialogError("A data final deve ser igual ou posterior à inicial."); return; }
    setActiveDialog(null);
    startLoad();
    setQuery({ ...query, from, to });
  }

  function applyFilters() {
    setActiveDialog(null);
    startLoad();
    setScope(draftScope);
    setQuery({ ...query, mode: draft.mode, map: draft.map,
      employeeCode: draft.employeeCode, role: draft.role, expurge: draft.expurge });
  }

  const activeLoading = view === "analysis" ? analysis.loading : loading;
  const activeRefreshing = view === "analysis" ? analysis.refreshing : refreshing;
  const activeError = view === "analysis" ? analysis.error : error;
  const activeNotice = view === "analysis" ? analysis.notice : refreshNotice;
  const activeSnapshot = view === "analysis" ? analysis.data?.snapshotAt : data?.snapshotAt;
  const countLabel = view === "analysis" ? (analysis.data ? `${analysis.data.summary.distinctMaps} mapas · ${analysis.data.summary.total} observações` : "Análise ainda não carregada") :
    (data ? `${visibleGroups.length} mapa${visibleGroups.length === 1 ? "" : "s"} · ${visibleItems.length} linha${visibleItems.length === 1 ? "" : "s"} de equipe` : "Mapas ainda não carregados");

  return <main className="space-y-5 text-[var(--shell-text)]">
    <header className="rounded-[26px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--shell-accent)]">DPO · Entrega · Bloco 1.0</p>
      <h1 className="mt-2 font-serif text-3xl">Gerenciador de Jornada</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--shell-muted)]">Acompanhe os indicadores oficiais por mapa e equipe. O período permite consultar dias anteriores sem alterar o cálculo das procedures.</p>
    </header>

    <div role="tablist" aria-label="Indicadores de Jornada" className="flex flex-wrap gap-2">
      {tabs.map((tab, index) => <button key={tab.id} id={`journey-tab-${tab.id}`}
        type="button" role="tab" aria-selected={query.indicator === tab.id}
        aria-controls="journey-panel" tabIndex={query.indicator === tab.id ? 0 : -1}
        onClick={() => selectTab(tab.id)} onKeyDown={(event) => onTabKey(event, index)}
        className={`rounded-full px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--shell-accent)] ${query.indicator === tab.id ? "bg-[var(--shell-accent)] text-[var(--shell-contrast-ink)]" : "border border-[color:var(--shell-line)] bg-[var(--shell-surface)] text-[var(--shell-text)]"}`}>
        {tab.label}</button>)}
    </div>

    <section role="tabpanel" id="journey-panel" aria-labelledby={`journey-tab-${query.indicator}`} className="space-y-5">
      <div className="rounded-[26px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{selectedTab.label}</h2><p className="text-sm text-[var(--shell-muted)]">{selectedTab.description}</p></div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-xl border border-[color:var(--shell-line)] p-1" aria-label="Visualização do indicador">
              <button type="button" className={view === "accompaniment" ? primaryButtonClass : actionButtonClass} aria-pressed={view === "accompaniment"} onClick={() => selectView("accompaniment")}><ListChecks size={16} /> Acompanhamento</button>
              <button type="button" className={view === "analysis" ? primaryButtonClass : actionButtonClass} aria-pressed={view === "analysis"} onClick={() => selectView("analysis")}><BarChart3 size={16} /> Análise</button>
            </div>
            <button type="button" className={actionButtonClass} onClick={reload} disabled={activeLoading || activeRefreshing} aria-label="Atualizar dados da Jornada"><RefreshCw size={16} /> {activeRefreshing ? "Atualizando" : "Atualizar"}</button>
          </div>
        </div>
      </div>

      {activeLoading && <p role="status" className="rounded-2xl border border-[color:var(--shell-line)] p-6">Carregando {view === "analysis" ? "análise" : "dados"} de Jornada…</p>}
      {activeError && <div role="alert" className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm"><p>{activeError}</p><button type="button" className={`${actionButtonClass} mt-3`} onClick={reload}>Tentar novamente</button></div>}
      {activeNotice && <p role="status" className="text-xs text-[var(--shell-muted)]">{activeNotice} Os dados anteriores continuam visíveis.</p>}
      <div className="grid items-center gap-3 lg:grid-cols-[auto_minmax(20rem,1fr)_auto]">
        <div role="status" className="text-sm text-[var(--shell-muted)]">
          {countLabel}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:justify-center">
          <button type="button" className={actionButtonClass} onClick={() => openDialog("calendar")}
            aria-label={`Selecionar dia ou período. Seleção atual: ${dateLabel}`} title={dateLabel}>
            <CalendarDays size={16} /> <span className="hidden sm:inline">{dateLabel}</span>
          </button>
          <label className="relative min-w-40 flex-1 lg:max-w-xl">
            <span className="sr-only">Buscar mapa, motorista, ajudante ou veículo</span>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--shell-muted)]" />
            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Buscar mapa, equipe ou veículo" className={`${fieldClass} pl-9`} />
          </label>
          <button type="button" className={actionButtonClass} onClick={() => openDialog("filters")} aria-label="Abrir filtros"><ListFilter size={16} /> <span className="hidden sm:inline">Filtros</span></button>
        </div>
        <span className="text-sm text-[var(--shell-muted)] lg:text-right">{activeRefreshing ? "Atualizando snapshot… · " : ""}Snapshot: {formatDateTime(activeSnapshot)}</span>
      </div>
      {view === "analysis" && !analysis.loading && analysis.data && <JourneyAnalysis history={analysis.data}
        indicator={query.indicator} role={effectiveRole} onRoleChange={setAnalysisRole} roleLocked={query.role !== "all"}
        reportFilters={reportFilters} onReportFiltersChange={setReportFilters} reportSort={reportSort} onReportSortChange={setReportSort} />}
      {view === "accompaniment" && !loading && !error && data && <>
        {visibleGroups.length === 0 ? <p className="rounded-2xl border border-dashed border-[color:var(--shell-line)] p-8 text-center text-sm">Nenhum mapa encontrado no período e filtros selecionados.</p> :
          <div className="space-y-3">{pagination.groups.map((group) =>
            <JourneyMapRow key={group.key} group={group} indicator={query.indicator} now={now}
              onOpen={() => setSelectedMapKey(group.key)} />)}</div>}
        {visibleGroups.length > 0 && <nav aria-label="Paginação dos mapas" className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--shell-line)] pt-4 text-sm">
          <span className="text-[var(--shell-muted)]">Exibindo {pagination.start}–{pagination.end} de {visibleGroups.length} mapa{visibleGroups.length === 1 ? "" : "s"}</span>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[var(--shell-muted)]">Por página
              <select className={`${fieldClass} w-auto`} value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                {[25, 50, 75, 100].map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>
            <button type="button" className={`${actionButtonClass} w-9 px-0`} onClick={() => setPage(pagination.page - 1)} disabled={pagination.page === 1} aria-label="Página anterior"><ChevronLeft size={18} /></button>
            <span className="min-w-20 text-center tabular-nums">{pagination.page} de {pagination.totalPages}</span>
            <button type="button" className={`${actionButtonClass} w-9 px-0`} onClick={() => setPage(pagination.page + 1)} disabled={pagination.page === pagination.totalPages} aria-label="Próxima página"><ChevronRight size={18} /></button>
          </div>
        </nav>}
      </>}
      {selectedGroup && <JourneyMapDialog key={`${query.indicator}:${selectedGroup.key}`}
        group={selectedGroup} indicator={query.indicator} now={now}
        onClose={() => setSelectedMapKey(null)} />}
      {activeDialog === "calendar" && <JourneyQueryDialog title="Selecionar data" onClose={() => setActiveDialog(null)}>
        <p className="text-sm text-[var(--shell-muted)]">Escolha um dia específico ou um período para consultar os mapas.</p>
        <form className="mt-5 space-y-5" onSubmit={(event) => {
          event.preventDefault();
          const values = new FormData(event.currentTarget);
          applyDate(String(values.get("from") ?? ""), String(values.get("to") ?? ""));
        }}>
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-2 font-semibold">Tipo de consulta</legend>
            <label className="inline-flex items-center gap-2"><input type="radio" name="journey-date-mode" checked={dateMode === "day"} onChange={() => setDateMode("day")} /> Dia específico</label>
            <label className="inline-flex items-center gap-2"><input type="radio" name="journey-date-mode" checked={dateMode === "period"} onChange={() => setDateMode("period")} /> Período</label>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">{dateMode === "day" ? "Data" : "De"}
              <input type="date" name="from" required className={`${fieldClass} mt-1`} value={draft.from} onChange={(event) => setField("from", event.target.value)} />
            </label>
            {dateMode === "period" && <label className="text-sm">Até
              <input type="date" name="to" required min={draft.from} className={`${fieldClass} mt-1`} value={draft.to} onChange={(event) => setField("to", event.target.value)} />
            </label>}
          </div>
          {dialogError && <p role="alert" className="text-sm text-[var(--shell-danger)]">{dialogError}</p>}
          <div className="flex justify-end gap-2 border-t border-[color:var(--shell-line)] pt-4">
            <button type="button" className={actionButtonClass} onClick={() => setActiveDialog(null)}>Cancelar</button>
            <button type="submit" className={primaryButtonClass}>Aplicar data</button>
          </div>
        </form>
      </JourneyQueryDialog>}
      {activeDialog === "filters" && <JourneyQueryDialog title="Filtros da Jornada" onClose={() => setActiveDialog(null)}>
        <p className="text-sm text-[var(--shell-muted)]">Refine os mapas e a equipe do período selecionado.</p>
        <form className="mt-5 space-y-5" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            {query.indicator !== "tr" && <label className="text-sm">Modo
              <select className={`${fieldClass} mt-1`} value={draft.mode} onChange={(event) => setField("mode", event.target.value as JourneyQuery["mode"])}>
                <option value="ponto">Ponto {query.indicator === "jl" ? "· jornada laboral" : ""}</option>
                <option value="mpd">MPD {query.indicator === "jl" ? "· jornada operacional" : ""}</option>
              </select>
            </label>}
            <label className="text-sm">Mapa
              <input type="number" min="1" inputMode="numeric" placeholder="Todos" className={`${fieldClass} mt-1`} value={draft.map} onChange={(event) => setField("map", event.target.value)} />
            </label>
            <label className="text-sm">Código do colaborador
              <input type="number" min="1" inputMode="numeric" placeholder="Todos" className={`${fieldClass} mt-1`} value={draft.employeeCode} onChange={(event) => setField("employeeCode", event.target.value)} />
            </label>
            <label className="text-sm">Função
              <select className={`${fieldClass} mt-1`} value={draft.role} onChange={(event) => setField("role", event.target.value as JourneyQuery["role"])}>
                <option value="all">Todos</option><option value="motorista">Motoristas</option><option value="ajudante">Ajudantes</option>
              </select>
            </label>
            <label className="text-sm">Expurgo
              <select className={`${fieldClass} mt-1`} value={draft.expurge} onChange={(event) => setField("expurge", event.target.value as JourneyQuery["expurge"])}>
                <option value="all">Todos</option><option value="not_expurged">Não expurgados</option><option value="expurged">Expurgados</option>
              </select>
            </label>
            {(hasExplicitLiveOrigin || scope !== "all") && <label className="text-sm">Recorte dos mapas
              <select className={`${fieldClass} mt-1`} value={draftScope} onChange={(event) => setDraftScope(event.target.value as LiveScope)}>
                <option value="all">Todos os mapas</option>
                <option value="d0">D0 · LIVE de hoje no período</option>
                <option value="earlier">Pendentes anteriores · LIVE no período</option>
              </select>
            </label>}
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-[color:var(--shell-line)] pt-4">
            <button type="button" className={actionButtonClass} onClick={() => { setDraft({ ...query, map: "", employeeCode: "", role: "all", expurge: "all" }); setDraftScope("all"); }}>Limpar filtros</button>
            <button type="button" className={actionButtonClass} onClick={() => setActiveDialog(null)}>Cancelar</button>
            <button type="submit" className={primaryButtonClass}>Aplicar filtros</button>
          </div>
        </form>
      </JourneyQueryDialog>}
    </section>
  </main>;
}

function JourneyQueryDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  return <dialog ref={dialogRef} onClose={() => { if (!dialogRef.current?.open) onClose(); }}
    aria-labelledby="journey-query-dialog-title"
    className="m-auto max-h-[90vh] w-[min(94vw,36rem)] overflow-y-auto rounded-[24px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 text-[var(--shell-text)] shadow-2xl backdrop:bg-slate-950/75 sm:p-6">
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 id="journey-query-dialog-title" className="text-xl font-semibold">{title}</h2>
      <button type="button" className={`${actionButtonClass} w-9 px-0`} onClick={() => dialogRef.current?.close()} aria-label="Fechar"><X size={18} /></button>
    </div>
    {children}
  </dialog>;
}
