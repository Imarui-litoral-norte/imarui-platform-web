"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListFilter, X } from "lucide-react";
import { percent, shortDate } from "../lib/journeyAnalysis";
import { formatTeamAverage, teamReportRows, sortTeamReportRows, initialTeamReportFilters, type TeamReportFilters, type TeamReportSort, type TeamReportSortColumn } from "../lib/journeyTeamReport";
import type { Indicator, JourneyHistory } from "../model/types";
import { actionButtonClass, fieldClass, primaryButtonClass } from "./journeyControls";

const columns = "grid grid-cols-2 gap-x-3 gap-y-2 @2xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.8fr)_minmax(0,.7fr)_minmax(0,.55fr)_minmax(0,.8fr)_minmax(0,.65fr)]";

export default function JourneyTeamReport({ history, indicator, filters, onFiltersChange, sort, onSortChange }: {
  history: JourneyHistory; indicator: Indicator; filters: TeamReportFilters;
  onFiltersChange: (filters: TeamReportFilters) => void;
  sort: TeamReportSort; onSortChange: (sort: TeamReportSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(() => sortTeamReportRows(teamReportRows(history.team ?? [], filters), sort), [history.team, filters, sort]);
  const personLabel = history.role === "motorista" ? "Motorista" : "Ajudante";
  const unit = indicator === "tml" || indicator === "ti" ? "mm:ss" : "hh:mm";
  const headers: { column: TeamReportSortColumn; label: string; hint?: string }[] = [
    { column: "name", label: personLabel },
    { column: "dates", label: "Dias de saída", hint: "Ordena pela primeira data de saída no período" },
    { column: "attained", label: "Atingimento", hint: "Ordena pela quantidade atingida; em empate, pela quantidade avaliada" },
    { column: "adherence", label: "%" },
    { column: "average", label: `Média ${indicator.toUpperCase()} (${unit})` },
    { column: "journeyExceeded", label: "Estouros JL" },
  ];
  const activeCount = filters.excluded.length + filters.fleets.length + Number(filters.expurge !== "all") + Number(filters.view !== "all");
  const missingJourneys = rows.reduce((total, row) => total + row.journeyUnknown, 0);
  return <section className="@container min-w-0 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 sm:p-5" aria-label="Status das equipes para os educadores">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h3 className="font-semibold">Status das equipes · {indicator.toUpperCase()}</h3>
        <p className="mt-1 text-xs text-[var(--shell-muted)]">{shortDate(history.from)}/{history.from.slice(0, 4)}{history.to !== history.from ? ` a ${shortDate(history.to)}/${history.to.slice(0, 4)}` : ""} · {rows.length} {personLabel.toLowerCase()}{rows.length !== 1 ? "s" : ""} em exibição</p>
      </div>
      <button type="button" className={`${actionButtonClass} print:hidden`} aria-label="Filtrar status das equipes" onClick={() => setOpen(true)}>
        <ListFilter size={14} /> Filtros{activeCount > 0 && <span className="rounded-full bg-[var(--shell-accent)]/15 px-1.5 text-xs">{activeCount}</span>}
      </button>
    </div>
    {(filters.fleets.length > 0 || filters.expurge !== "all" || filters.view !== "all") && <p className="mt-2 break-words text-xs text-[var(--shell-muted)]">
      {filters.fleets.length > 0 && `Frota: ${filters.fleets.map(fleet => fleet || "Sem frota informada").join(", ")} · `}
      {filters.expurge === "expurged" ? "Somente com expurgo" : filters.expurge === "not_expurged" ? "Sem expurgo" : "Todos os expurgos"}
      {filters.view !== "all" && (filters.view === "not_attained" ? " · Com resultado não atingido" : " · Com estouro de jornada")}
    </p>}
    <div role="table" aria-label={`Status da equipe em ${indicator.toUpperCase()}`} className="mt-4 w-full min-w-0 text-xs">
      <div role="row" className={`${columns} border-b border-[color:var(--shell-line)] pb-2 font-medium text-[var(--shell-muted)]`}>
        {headers.map(({ column, label, hint }) => {
          const active = sort.column === column;
          const nextDirection = active && sort.direction === "asc" ? "desc" : "asc";
          const Icon = active ? sort.direction === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
          return <div role="columnheader" key={column} aria-sort={active ? sort.direction === "asc" ? "ascending" : "descending" : "none"} className="min-w-0">
            <button type="button" title={hint} aria-label={`Ordenar ${label} em ordem ${nextDirection === "asc" ? "crescente" : "decrescente"}`}
              onClick={() => onSortChange({ column, direction: nextDirection })}
              className={`flex min-w-0 max-w-full items-center gap-1 rounded py-1 text-left hover:text-[var(--shell-text)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--shell-accent)] ${active ? "text-[var(--shell-text)]" : ""}`}>
              <span className="min-w-0 break-words">{label}</span><Icon size={12} className="shrink-0" aria-hidden="true" />
            </button>
          </div>;
        })}
      </div>
      {rows.map(row => <div role="row" key={row.employeeCode} className={`${columns} items-center border-b border-[color:var(--shell-line)]/60 py-3 last:border-b-0`}>
        <div role="cell" className="min-w-0 break-words font-medium">{row.employeeName}</div>
        <div role="cell" className="flex min-w-0 flex-wrap gap-x-1 gap-y-1 tabular-nums">{row.dates.length ? row.dates.map((date, index) => <span key={date} className="whitespace-nowrap" title={date.split("-").reverse().join("/")}>{shortDate(date)}{index < row.dates.length - 1 ? "," : ""}</span>) : <span>—</span>}</div>
        <div role="cell" className="tabular-nums" title={`${row.counts.pending} em andamento · ${row.counts.unavailable} sem resultado`}>{row.counts.attained}/{row.counts.evaluated}</div>
        <div role="cell" className={`font-semibold tabular-nums ${row.counts.adherence === null ? "text-[var(--shell-muted)]" : row.counts.notAttained > 0 ? "text-rose-700 dark:text-rose-300" : "text-teal-700 dark:text-teal-300"}`}>{percent(row.counts.adherence)}</div>
        <div role="cell" className="tabular-nums" title={`Média de ${row.timeSamples} tempos encerrados válidos`}>{formatTeamAverage(row.averageSeconds, indicator)}</div>
        <div role="cell" className="tabular-nums" title={`${row.journeyKnown} jornadas com resultado oficial · ${row.journeyUnknown} sem resultado`}>{row.journeyKnown ? row.journeyExceeded : "—"}</div>
      </div>)}
    </div>
    {!history.team ? <p className="mt-4 text-xs text-[var(--shell-muted)]">Atualize o core-api do DEV para carregar os detalhes deste relatório.</p> : !rows.length && <p className="mt-4 text-sm text-[var(--shell-muted)]">Nenhum integrante para esta combinação de filtros.</p>}
    <p className="mt-3 text-xs leading-5 text-[var(--shell-muted)]">Atingimento e % consideram mapas com resultado encerrado avaliável. A média usa tempos encerrados válidos. Os estouros são resultados oficiais de JL{indicator === "tr" ? " no modo Ponto" : " no modo selecionado"}.</p>
    {missingJourneys > 0 && <p className="mt-1 text-xs text-[var(--shell-muted)]">{missingJourneys} jornada{missingJourneys !== 1 ? "s" : ""} sem resultado oficial: a contagem de estouros está parcial.</p>}
    {open && <ReportFilterDialog history={history} filters={filters} onApply={value => { onFiltersChange(value); setOpen(false); }} onClose={() => setOpen(false)} />}
  </section>;
}

function ReportFilterDialog({ history, filters, onApply, onClose }: {
  history: JourneyHistory; filters: TeamReportFilters; onApply: (filters: TeamReportFilters) => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [draft, setDraft] = useState(filters);
  const [search, setSearch] = useState("");
  const people = useMemo(() => [...new Map((history.team ?? []).map(row => [row.employeeCode, row.employeeName])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR")), [history.team]);
  const fleets = useMemo(() => [...new Set((history.team ?? []).map(row => row.fleet?.trim() ?? ""))].sort((a, b) => a.localeCompare(b, "pt-BR")), [history.team]);
  const term = search.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
  const visiblePeople = people.filter(([code, name]) => `${name} ${code}`.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR").includes(term));
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} aria-labelledby={id} onCancel={onClose} onClose={() => { if (!ref.current?.open) onClose(); }}
    className="m-auto max-h-[90vh] w-[min(94vw,42rem)] overflow-y-auto rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5 text-[var(--shell-text)] shadow-2xl backdrop:bg-slate-950/75">
    <form onSubmit={event => { event.preventDefault(); onApply(draft); }}>
      <div className="flex items-center justify-between gap-3"><h2 id={id} className="text-lg font-semibold">Filtros do status das equipes</h2>
        <button type="button" className={actionButtonClass} aria-label="Fechar filtros das equipes" onClick={onClose}><X size={16} /></button></div>
      <p className="mt-2 text-xs leading-5 text-[var(--shell-muted)]">Estes filtros alteram somente este bloco. Datas, busca e função seguem a seleção da página. O expurgo deste bloco é independente do filtro geral.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="text-sm">Visualização<select className={`${fieldClass} mt-1 w-full`} value={draft.view} onChange={event => setDraft({ ...draft, view: event.target.value as TeamReportFilters["view"] })}>
          <option value="all">Todos os integrantes</option><option value="not_attained">Com resultado não atingido</option><option value="journey_exceeded">Com estouro de jornada</option>
        </select></label>
        <label className="text-sm">Expurgos<select className={`${fieldClass} mt-1 w-full`} value={draft.expurge} onChange={event => setDraft({ ...draft, expurge: event.target.value as TeamReportFilters["expurge"] })}>
          <option value="all">Todos</option><option value="not_expurged">Sem expurgo</option><option value="expurged">Somente com expurgo</option>
        </select></label>
      </div>
      <fieldset className="mt-4"><legend className="text-sm font-medium">Frota</legend><p className="mt-1 text-xs text-[var(--shell-muted)]">Nenhuma marcada inclui todas. A seleção filtra os mapas antes de calcular os resultados de cada pessoa.</p>
        <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">{fleets.map(fleet => <label key={fleet} className="flex items-center gap-2 rounded-lg border border-[color:var(--shell-line)] px-3 py-2 text-sm">
          <input type="checkbox" checked={draft.fleets.includes(fleet)} onChange={event => setDraft({ ...draft, fleets: event.target.checked ? [...draft.fleets, fleet] : draft.fleets.filter(value => value !== fleet) })} />{fleet || "Sem frota informada"}</label>)}</div>
      </fieldset>
      <fieldset className="mt-4"><legend className="text-sm font-medium">Integrantes em exibição</legend>
        <input className={`${fieldClass} mt-2 w-full`} aria-label="Buscar integrante para exibição" placeholder="Buscar nome ou código" value={search} onChange={event => setSearch(event.target.value)} />
        <div className="my-2 flex flex-wrap gap-2"><button type="button" className={actionButtonClass} onClick={() => setDraft({ ...draft, excluded: [] })}>Exibir todos</button>
          <button type="button" className={actionButtonClass} onClick={() => setDraft({ ...draft, excluded: [...new Set([...draft.excluded, ...people.map(([code]) => code)])] })}>Ocultar todos</button></div>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[color:var(--shell-line)] p-2">{visiblePeople.map(([code, name]) => <label key={code} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm">
          <input type="checkbox" checked={!draft.excluded.includes(code)} onChange={event => setDraft({ ...draft, excluded: event.target.checked ? draft.excluded.filter(value => value !== code) : [...draft.excluded, code] })} /><span className="min-w-0 break-words">{name} <span className="text-xs text-[var(--shell-muted)]">#{code}</span></span></label>)}
          {!visiblePeople.length && <p className="p-2 text-xs text-[var(--shell-muted)]">Nenhum integrante encontrado.</p>}</div>
      </fieldset>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" className={actionButtonClass} onClick={() => setDraft(initialTeamReportFilters)}>Limpar filtros</button>
        <button type="button" className={actionButtonClass} onClick={onClose}>Cancelar</button><button type="submit" className={primaryButtonClass}>Aplicar filtros</button></div>
    </form>
  </dialog>;
}
