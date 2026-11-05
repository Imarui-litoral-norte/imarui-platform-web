"use client";

import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, ListFilter, ArrowUp, ArrowDown, X } from "lucide-react";
import { journeyApi } from "../api/journeyApi";
import { auditHours, auditOutcome, auditColumns } from "../lib/journeyAudit";
import { formatDateTime } from "../lib/journeyPresentation";
import type { AnalysisRole, Indicator, JourneyAudit, JourneyAuditTableQuery, JourneyQuery } from "../model/types";
import JourneyAuditColumnFilter from "./JourneyAuditColumnFilter";
import { actionButtonClass, fieldClass } from "./journeyControls";

const indicators: Indicator[] = ["tml", "tr", "ti", "jl"];
export default function JourneyMapAudit({ query, role, search, scope, refreshToken }: {
  query: JourneyQuery; role: AnalysisRole; search: string; scope: string; refreshToken?: string | null;
}) {
  const [table, setTable] = useState<JourneyAuditTableQuery>({ filters: {}, sortBy: "date", sortDirection: "desc" });
  const [openColumn, setOpenColumn] = useState<{ key: string; anchor: { left: number; top: number; theme: CSSProperties } } | null>(null);
  const [auditFilter, setAuditFilter] = useState("all");
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  const [revision, setRevision] = useState(0), [expanded, setExpanded] = useState<string | null>(null);
  const key = JSON.stringify([query, role, search.trim(), scope, page, pageSize, auditFilter, table, revision, refreshToken]);
  const [state, setState] = useState<{ key: string; data: JourneyAudit | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void journeyApi.audit(query, role, search, scope, page, pageSize, controller.signal, auditFilter, table)
        .then(data => { if (!controller.signal.aborted) setState({ key, data, error: null }); })
        .catch((error: unknown) => { if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : "Falha ao carregar a auditoria." }); });
    }, 300);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, query, role, search, scope, page, pageSize, auditFilter, table]);
  const data = state.key === key ? state.data : null, loading = state.key !== key;
  const first = data?.totalElements ? (data.page - 1) * data.pageSize + 1 : 0;
  function changeFilter(column: string, values: string[] | undefined) {
    setTable(previous => { const filters = { ...previous.filters }; if (values === undefined) delete filters[column]; else filters[column] = values; return { ...previous, filters }; });
    setPage(1); setExpanded(null); setOpenColumn(null);
  }
  function closeMenu() {
    const key = openColumn?.key; setOpenColumn(null);
    if (key) window.requestAnimationFrame(() => document.getElementById(`audit-column-${key}`)?.focus());
  }
  return <section aria-labelledby="journey-audit-title" className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="journey-audit-title" className="text-lg font-semibold">Auditoria dos mapas · {query.indicator.toUpperCase()}</h2>
        <p className="mt-1 max-w-5xl text-xs leading-5 text-[var(--shell-muted)]">Um snapshot por data e mapa, usando o período, a busca, os filtros e a população da análise ({role === "motorista" ? "motoristas" : "ajudantes"}). Os tempos são oficiais, em horas decimais. Variações entre participantes aparecem como intervalo; abra a equipe para conferir os valores individuais.</p>
      </div>
      <button type="button" className={actionButtonClass} onClick={() => setRevision(n => n + 1)} disabled={loading} aria-label="Atualizar auditoria dos mapas"><RefreshCw size={15} /> Atualizar lista</button>
    </div>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium">Base da auditoria
        <select aria-label="Base da auditoria" className={`${fieldClass} mt-1 w-auto max-w-full`} value={auditFilter}
          onChange={event => { setAuditFilter(event.target.value); setPage(1); setExpanded(null); setTable({ filters: {}, sortBy: "date", sortDirection: "desc" }); }}>
          <option value="evaluated_not_expurged">Base efetiva · avaliados e sem expurgo</option>
          <option value="not_expurged">Sem expurgo · todos os estados</option>
          <option value="all">Mesma base dos indicadores e gráficos</option>
        </select>
      </label>
      <p className="max-w-3xl text-xs leading-5 text-[var(--shell-muted)]">{auditFilter === "evaluated_not_expurged"
        ? "Somente atingidos e não atingidos, fechados e avaliáveis, com ausência de expurgo confirmada. São a base do indicador sem expurgo; em andamento e sem resultado ficam de fora."
        : auditFilter === "not_expurged" ? "Somente participantes sem expurgo confirmado, incluindo os que ainda não têm resultado fechado."
        : "Usa os mesmos mapas e participantes dos cartões e gráficos, incluindo os estados em andamento e sem resultado. A paginação não altera essa base."}
        {auditFilter !== "all" && " O filtro de expurgo desta lista é independente do filtro dos gráficos."}
      </p>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-[var(--shell-muted)]">Use o filtro de cada cabeçalho para pesquisar e selecionar valores de todos os mapas do recorte.</span>
      {Object.entries(table.filters).map(([column, values]) => <button key={column} type="button" className={actionButtonClass} onClick={() => changeFilter(column, undefined)} aria-label={`Remover filtro de ${auditColumns.find(c => c.key === column)?.label}`}>
        {auditColumns.find(c => c.key === column)?.label}: {values.length ? `${values.length} ${values.length === 1 ? "valor" : "valores"}` : "nenhum valor"} <X size={12} /></button>)}
      {Object.keys(table.filters).length > 0 && <button type="button" className={actionButtonClass} onClick={() => { setTable(previous => ({ ...previous, filters: {} })); setPage(1); setExpanded(null); }}>Limpar filtros das colunas</button>}
    </div>
    {loading ? <p role="status" className="py-8 text-sm text-[var(--shell-muted)]">Carregando mapas da auditoria…</p> : state.error ?
      <p role="alert" className="mt-4 rounded-xl border border-[color:var(--shell-line)] p-4 text-sm text-[var(--shell-danger)]">{state.error}</p> : data && <>
      <div className="my-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--shell-muted)]">
        <span>{data.totalElements} de {data.unfilteredTotal} mapas · {data.summary.total} observações · {data.summary.evaluated} resultados avaliados</span>
        <span>{data.summary.attained} atingidos · {data.summary.notAttained} não atingidos · {data.summary.pending} em andamento · {data.summary.unavailable} sem resultado</span>
        <span>Snapshot: {formatDateTime(data.snapshotAt)}</span>
      </div>
      <div role="region" aria-label="Tabela de auditoria dos mapas" tabIndex={0} className="max-h-[38rem] overflow-auto rounded-xl border border-[color:var(--shell-line)]"><table className="w-full min-w-[1300px] text-left text-xs tabular-nums">
        <thead className="sticky top-0 z-10 bg-[var(--shell-surface)]"><tr className="border-b border-[color:var(--shell-line)] text-[var(--shell-muted)]">
          {auditColumns.map(column => <th key={column.key} scope="col" className="px-3 py-3 font-semibold" aria-sort={table.sortBy === column.key ? table.sortDirection === "asc" ? "ascending" : "descending" : "none"}>
            <button id={`audit-column-${column.key}`} type="button" className="inline-flex items-center gap-2 rounded-lg py-1 text-left hover:text-[var(--shell-accent)] focus-visible:outline-2 focus-visible:outline-[var(--shell-accent)]"
              aria-label={`Filtrar coluna ${column.label}`} aria-haspopup="dialog" aria-expanded={openColumn?.key === column.key}
              onClick={event => { const rect = event.currentTarget.getBoundingClientRect(); const style = getComputedStyle(event.currentTarget);
                const theme = Object.fromEntries(["--shell-surface", "--shell-surface-muted", "--shell-text", "--shell-muted", "--shell-line", "--shell-line-strong", "--shell-accent", "--shell-accent-soft", "--shell-contrast-ink"].map(name => [name, style.getPropertyValue(name)])) as CSSProperties;
                setOpenColumn({ key: column.key, anchor: { theme, left: Math.max(8, Math.min(rect.left, window.innerWidth - 348)), top: Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - 510)) } }); }}>
              {column.label}<ListFilter size={14} className={table.filters[column.key] !== undefined ? "text-[var(--shell-accent)]" : "opacity-60"} />
              {table.sortBy === column.key && (table.sortDirection === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
            </button>
          </th>)}
        </tr></thead>
        <tbody>{data.items.map(row => {
          const rowKey = `${row.date}:${row.map}`, open = expanded === rowKey;
          return <Fragment key={rowKey}><tr className="border-b border-[color:var(--shell-line)] align-top">
            {auditColumns.map(column => <td key={column.key} className={`px-3 py-3 ${["driver", "vehicle", "result", "expurge"].includes(column.key) ? "" : "whitespace-nowrap"} ${["map", "driver"].includes(column.key) ? "font-medium" : ""}`}>
              {row.cells[column.key]?.value === "__blank__" ? "—" : row.cells[column.key]?.label ?? "—"}
              {column.key === "result" && <span className="mt-1 block text-[var(--shell-muted)]">{row.contribution.attained}/{row.contribution.evaluated} atingidos</span>}
              {column.key === "expurge" && <button type="button" className={`${actionButtonClass} mt-2`} aria-expanded={open} aria-controls={`audit-${row.date}-${row.map}`} onClick={() => setExpanded(open ? null : rowKey)}>{open ? "Fechar equipe" : "Ver equipe"}</button>}
            </td>)}
          </tr>{open && <tr id={`audit-${row.date}-${row.map}`}><td colSpan={auditColumns.length} className="bg-[var(--shell-surface-muted)] p-4">
            <p className="mb-3 text-xs text-[var(--shell-muted)]">Equipe completa do mapa. “Incluído” identifica quem participa do recorte atual. Expurgo refere-se a {query.indicator.toUpperCase()}. Snapshot da seleção: {formatDateTime(row.snapshotAt)}.</p>
            <table className="w-full text-left text-xs"><thead><tr>{["Colaborador", "Função", "No recorte", ...indicators.map(i => i.toUpperCase() + " (h)"), "Resultado de " + query.indicator.toUpperCase(), "Expurgo / motivo"].map(label => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
              <tbody>{row.members.map((member, index) => <tr key={`${member.employeeCode}:${index}`} className="border-t border-[color:var(--shell-line)] align-top">
                <td className="px-2 py-2">{member.employeeName ?? "Não informado"}<span className="block text-[var(--shell-muted)]">#{member.employeeCode ?? "—"}</span></td><td className="px-2 py-2">{member.role ?? "—"}</td><td className="px-2 py-2">{member.included ? "Incluído" : "Contexto da equipe"}</td>
                {indicators.map(i => <td key={i} className="px-2 py-2">{member[i]?.temporalOrderAnomaly ? "Anomalia" : auditHours(member[i]?.seconds)}{member[i]?.lifecycleStatus === "EM_ANDAMENTO" && <span className="block text-[var(--shell-muted)]">Em andamento</span>}</td>)}
                <td className="px-2 py-2">{member.conflictingSnapshots ? "Snapshots divergentes" : auditOutcome(member[query.indicator])}</td>
                <td className="max-w-80 whitespace-normal px-2 py-2">{member.expurge?.present === true ? "Com expurgo" : member.expurge?.present === false ? "Sem expurgo" : "Não informado"}{member.expurge?.reasons && <p className="mt-1">{member.expurge.reasons}</p>}{member.expurge?.observations && <p className="mt-1 text-[var(--shell-muted)]">{member.expurge.observations}</p>}</td>
              </tr>)}</tbody>
            </table>
          </td></tr>}</Fragment>;
        })}</tbody>
      </table></div>
      {!data.totalElements && <p className="py-6 text-sm text-[var(--shell-muted)]">Nenhum mapa nesta seleção.</p>}
      <nav aria-label="Paginação da auditoria de mapas" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <span className="text-[var(--shell-muted)]">Exibindo {first}–{data.totalElements ? first + data.items.length - 1 : 0} de {data.totalElements} mapas</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs">Por página<select aria-label="Mapas por página na auditoria" className={`${fieldClass} w-auto`} value={pageSize} onChange={event => { setPageSize(Number(event.target.value)); setPage(1); setExpanded(null); }}>{[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}</select></label>
          <button type="button" className={actionButtonClass} disabled={data.page <= 1} onClick={() => { setPage(data.page - 1); setExpanded(null); }} aria-label="Página anterior da auditoria"><ChevronLeft size={16} /></button>
          <label className="flex items-center gap-2 text-xs">Página<select aria-label="Página da auditoria" className={`${fieldClass} w-auto`} value={data.page} onChange={event => { setPage(Number(event.target.value)); setExpanded(null); }}>{Array.from({ length: data.totalPages }, (_, i) => <option key={i+1} value={i+1}>{i+1}</option>)}</select> de {data.totalPages}</label>
          <button type="button" className={actionButtonClass} disabled={data.page >= data.totalPages} onClick={() => { setPage(data.page + 1); setExpanded(null); }} aria-label="Próxima página da auditoria"><ChevronRight size={16} /></button>
        </div>
      </nav>
      <p className="mt-4 text-xs leading-5 text-[var(--shell-muted)]">Saída e entrada são os horários oficiais de TR e TI. Entregas usa o mapa histórico (03_08_05) ou LIVE (v_03_11_40), conforme a origem; ausências ficam como “—” e valores conflitantes como “Divergente”. Os tempos não são somados entre integrantes. Em TR, a JL de contexto usa o modo Ponto. Esta lista permite conferir os dados; não altera expurgos.</p>
    </>}
    {openColumn && data && <JourneyAuditColumnFilter key={openColumn.key} column={openColumn.key}
      label={auditColumns.find(column => column.key === openColumn.key)?.label ?? openColumn.key}
      options={data.facets[openColumn.key] ?? []} selected={table.filters[openColumn.key]} anchor={openColumn.anchor}
      onApply={values => changeFilter(openColumn.key, values)} onClear={() => changeFilter(openColumn.key, undefined)}
      onSort={direction => { setTable(previous => ({ ...previous, sortBy: openColumn.key, sortDirection: direction })); setPage(1); setExpanded(null); setOpenColumn(null); }} onClose={closeMenu} />}
  </section>;
}
