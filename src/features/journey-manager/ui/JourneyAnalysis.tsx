"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { EChartsOption } from "echarts";
import { BarChart3, CircleHelp, Users } from "lucide-react";
import { annualComparison, countsBetween, emptyCounts, monthLabel, monthlyPoints, percent,
  shortDate, weeklyPoints, type AnalysisPoint } from "../lib/journeyAnalysis";
import type { AnalysisRole, Indicator, JourneyCounts, JourneyHistory } from "../model/types";
import { actionButtonClass, fieldClass, primaryButtonClass } from "./journeyControls";
import JourneyTeamReport from "./JourneyTeamReport";
import type { TeamReportFilters, TeamReportSort } from "../lib/journeyTeamReport";

const EChart = dynamic(() => import("echarts-for-react"), { ssr: false,
  loading: () => <div className="flex h-72 items-center justify-center text-sm text-[var(--shell-muted)]">Preparando gráfico…</div> });
const paletteInitial = { text: "#334155", muted: "#64748b", line: "#e2e8f0", surface: "#ffffff",
  positive: "#0f766e", negative: "#be123c", accent: "#2563eb", pending: "#b45309" };
type Palette = typeof paletteInitial;

function usePalette() {
  const ref = useRef<HTMLDivElement>(null);
  const [palette, setPalette] = useState(paletteInitial);
  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const style = getComputedStyle(ref.current);
      const dark = document.documentElement.dataset.uiTheme === "dark";
      setPalette({ text: style.getPropertyValue("--shell-text").trim() || paletteInitial.text,
        muted: style.getPropertyValue("--shell-muted").trim() || paletteInitial.muted,
        line: style.getPropertyValue("--shell-line").trim() || paletteInitial.line,
        surface: style.getPropertyValue("--shell-surface").trim() || paletteInitial.surface,
        positive: dark ? "#5eead4" : "#0f766e", negative: dark ? "#fb7185" : "#be123c",
        accent: dark ? "#93c5fd" : "#2563eb", pending: dark ? "#fbbf24" : "#b45309" });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ui-theme", "class"] });
    return () => observer.disconnect();
  }, []);
  return { ref, palette };
}

function description(counts: JourneyCounts) {
  return `${percent(counts.adherence)} · ${counts.attained}/${counts.evaluated} atingidos\n${counts.notAttained} não atingidos\n${counts.pending} em andamento · ${counts.unavailable} sem resultado`;
}
function baseOption(palette: Palette): EChartsOption {
  return { backgroundColor: "transparent", textStyle: { color: palette.text, fontFamily: "system-ui, sans-serif" },
    color: [palette.positive, palette.accent], animationDuration: 350,
    aria: { enabled: true, label: { description: "Gráfico de aderência. Dias sem resultado aparecem como lacunas. Os valores e suas bases estão disponíveis na tabela abaixo do gráfico." } },
    tooltip: { trigger: "axis", renderMode: "richText", backgroundColor: palette.surface,
      borderColor: palette.line, textStyle: { color: palette.text } },
    legend: { top: 0, textStyle: { color: palette.muted }, icon: "roundRect", itemHeight: 8 },
    grid: { left: 48, right: 20, top: 45, bottom: 48 },
    yAxis: { type: "value", min: 0, max: 100, axisLabel: { color: palette.muted, formatter: "{value}%" },
      splitLine: { lineStyle: { color: palette.line, type: "dashed" } } } };
}

function seriesOption(points: AnalysisPoint[], palette: Palette, cumulativeLabel: string, grouped: boolean): EChartsOption {
  // Insert a real gap between weeks/months so the accumulated line resets visibly.
  const plot: (AnalysisPoint | null)[] = [];
  points.forEach((point, index) => {
    if (grouped && index > 0 && points[index - 1].group !== point.group) plot.push(null);
    plot.push(point);
  });
  const areas: [{ name: string; xAxis: number; itemStyle: { color: string; opacity: number } }, { xAxis: number }][] = [];
  if (grouped) {
    let start = 0;
    plot.forEach((point, index) => {
      if (!point || index === plot.length - 1) {
        const end = point ? index : index - 1, group = plot[start];
        if (group && start <= end) areas.push([{ name: group.group.length === 7 ? monthLabel(group.group) : `Semana ${shortDate(group.group)}`,
          xAxis: start, itemStyle: { color: palette.accent, opacity: areas.length % 2 ? 0.03 : 0.07 } }, { xAxis: end }]);
        start = index + 1;
      }
    });
  }
  return { ...baseOption(palette),
    tooltip: { ...baseOption(palette).tooltip as object, formatter: (params: unknown) => {
      const entry = (params as { dataIndex: number }[])[0], point = plot[entry?.dataIndex];
      return point ? `${shortDate(point.from)}${point.from !== point.to ? `–${shortDate(point.to)}` : ""}\n${description(point.counts)}\n${cumulativeLabel}: ${percent(point.accumulated)}` : "";
    } },
    xAxis: { type: "category", data: plot.map(point => point?.label ?? ""), axisLabel: { color: palette.muted, hideOverlap: true },
      axisLine: { lineStyle: { color: palette.line } }, axisTick: { show: false } },
    grid: { left: 48, right: 20, top: 60, bottom: plot.length > 24 ? 70 : 48 },
    dataZoom: plot.length > 24 ? [{ type: "slider", height: 18, bottom: 8, start: 0, end: plot.length > 60 ? 45 : 100,
      textStyle: { color: palette.muted }, borderColor: palette.line }, { type: "inside" }] : [],
    series: [{ name: "Aderência", type: "bar", barMaxWidth: 26, itemStyle: { color: palette.positive },
      data: plot.map(point => ({ value: point?.counts.adherence ?? null,
        itemStyle: { color: palette.positive, opacity: point?.selected ? 1 : 0.48, borderRadius: [4, 4, 0, 0] } })),
      markArea: { silent: true, label: { color: palette.muted, fontSize: 10 }, data: areas } },
    { name: cumulativeLabel, type: "line", smooth: false, connectNulls: false, symbolSize: 5,
      lineStyle: { color: palette.accent, width: 2 }, itemStyle: { color: palette.accent },
      data: plot.map(point => point?.accumulated ?? null) }] };
}

function ChartCard({ title, subtitle, option, children, height = 330 }: {
  title: string; subtitle: string; option: EChartsOption; children?: ReactNode; height?: number;
}) {
  return <section className="min-w-0 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 sm:p-5">
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="mb-5 mt-1 text-xs leading-5 text-[var(--shell-muted)]">{subtitle}</p>
    <div role="img" aria-label={title}><EChart option={option} notMerge lazyUpdate
      opts={{ renderer: "svg" }} style={{ height, width: "100%" }} /></div>
    {children}
  </section>;
}
function SeriesTable({ points }: { points: AnalysisPoint[] }) {
  return <details className="mt-3 text-xs text-[var(--shell-muted)]">
    <summary className="cursor-pointer py-2">Ver os valores do gráfico</summary>
    <div className="max-h-64 overflow-auto"><table className="w-full text-left tabular-nums">
      <thead><tr>{["Período", "Atingidos / avaliados", "Aderência", "Em andamento", "Sem resultado"].map(label => <th key={label} className="px-2 py-2 font-medium">{label}</th>)}</tr></thead>
      <tbody>{points.map(point => <tr key={point.key} className="border-t border-[color:var(--shell-line)]">
        <td className="px-2 py-2">{point.from === point.to ? point.from.split("-").reverse().join("/") : point.label}</td>
        <td className="px-2">{point.counts.attained} / {point.counts.evaluated}</td><td className="px-2">{percent(point.counts.adherence)}</td>
        <td className="px-2">{point.counts.pending}</td><td className="px-2">{point.counts.unavailable}</td>
      </tr>)}</tbody>
    </table></div>
  </details>;
}
function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: string }) {
  return <div className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
    <p className="text-xs text-[var(--shell-muted)]">{label}</p>
    <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: tone }}>{value}</p>
    <p className="mt-2 text-xs leading-5 text-[var(--shell-muted)]">{detail}</p>
  </div>;
}

export default function JourneyAnalysis({ history, indicator, role, onRoleChange, roleLocked, reportFilters, onReportFiltersChange, reportSort, onReportSortChange }: {
  history: JourneyHistory; indicator: Indicator; role: AnalysisRole; onRoleChange: (role: AnalysisRole) => void; roleLocked: boolean;
  reportFilters: TeamReportFilters; onReportFiltersChange: (filters: TeamReportFilters) => void;
  reportSort: TeamReportSort; onReportSortChange: (sort: TeamReportSort) => void;
}) {
  const { ref, palette } = usePalette();
  const [sort, setSort] = useState("adherence");
  const weekly = useMemo(() => weeklyPoints(history), [history]);
  const monthly = useMemo(() => monthlyPoints(history), [history]);
  const annual = useMemo(() => annualComparison(history), [history]);
  const people = useMemo(() => [...history.collaborators].sort((a, b) => sort === "name" ? a.employeeName.localeCompare(b.employeeName, "pt-BR") :
    sort === "volume" ? b.counts.evaluated - a.counts.evaluated : (a.counts.adherence ?? 101) - (b.counts.adherence ?? 101) || b.counts.evaluated - a.counts.evaluated), [history, sort]);
  const summary = history.summary, unit = history.population === "MAP" ? "mapas" : role === "ajudante" ? "participações de ajudantes" : "participações de motoristas";
  const weeklyOption = useMemo(() => seriesOption(weekly.points, palette, weekly.granular ? "Acumulado da semana" : "Acumulado no mês · seg–sáb", true), [weekly, palette]);
  const monthlyOption = useMemo(() => seriesOption(monthly.points, palette, monthly.granular ? "Acumulado do mês" : "Acumulado do período", false), [monthly, palette]);
  const staffOption: EChartsOption = { ...baseOption(palette), legend: { show: false },
    grid: { left: 12, right: people.length > 12 ? 55 : 35, top: 10, bottom: 30, containLabel: true },
    xAxis: { type: "value", min: 0, max: 100, axisLabel: { color: palette.muted, formatter: "{value}%" }, splitLine: { lineStyle: { color: palette.line, type: "dashed" } } },
    yAxis: { type: "category", inverse: true, data: people.map(p => p.employeeName),
      axisLabel: { color: palette.text, width: 150, overflow: "truncate" }, axisLine: { show: false }, axisTick: { show: false } },
    tooltip: { ...baseOption(palette).tooltip as object, formatter: (params: unknown) => {
      const index = (params as { dataIndex: number }[])[0]?.dataIndex, person = people[index];
      return person ? `${person.employeeName} · #${person.employeeCode}\n${description(person.counts)}\n${person.counts.distinctMaps} mapas no recorte` : "";
    } },
    dataZoom: people.length > 12 ? [{ type: "slider", yAxisIndex: 0, orient: "vertical", right: 0, width: 16, startValue: 0, endValue: 11,
      textStyle: { color: palette.muted }, borderColor: palette.line, filterMode: "empty" }, { type: "inside", yAxisIndex: 0, filterMode: "empty" }] : [],
    series: [{ name: "Aderência", type: "bar", barMaxWidth: 20, itemStyle: { color: palette.positive, borderRadius: [0, 4, 4, 0] },
      label: { show: true, position: "right", color: palette.text, formatter: (params: unknown) => percent((params as { value: number | null }).value) },
      data: people.map(p => p.counts.adherence) }] };
  const annualOption: EChartsOption = { ...baseOption(palette),
    xAxis: { type: "category", data: annual.map(row => row.label), axisLabel: { color: palette.muted }, axisLine: { lineStyle: { color: palette.line } }, axisTick: { show: false } },
    tooltip: { ...baseOption(palette).tooltip as object, formatter: (params: unknown) => {
      const row = annual[(params as { dataIndex: number }[])[0]?.dataIndex];
      return row ? `${row.label}\nAtual · ${shortDate(row.from)}–${shortDate(row.to)}\n${description(row.current)}\nAno anterior · ${shortDate(row.previousFrom)}–${shortDate(row.previousTo)}\n${description(row.previous)}` : "";
    } },
    series: [{ name: "Mês selecionado", type: "bar", barMaxWidth: 30, itemStyle: { color: palette.positive, borderRadius: [4, 4, 0, 0] }, data: annual.map(row => row.current.adherence) },
    { name: "Mesmo mês · ano anterior", type: "bar", barMaxWidth: 30, itemStyle: { color: palette.accent, borderRadius: [4, 4, 0, 0] }, data: annual.map(row => row.previous.adherence) }] };
  const closedCoverage = summary.total ? summary.evaluated * 100 / summary.total : null;
  const weekDays = history.daily.filter(day => new Date(day.date + "T12:00:00Z").getUTCDay() !== 0);
  const selectedWeekCounts = countsBetween(weekDays, history.from, history.to);
  const weekCounts = countsBetween(weekDays,
    weekly.points[0]?.from ?? history.from, weekly.points.at(-1)?.to ?? history.to);
  const monthCounts = countsBetween(history.daily, `${history.from.slice(0, 7)}-01`, monthly.points.at(-1)?.to ?? history.to);

  return <div ref={ref} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><BarChart3 size={19} className="text-[var(--shell-accent)]" /> Análise de {indicator.toUpperCase()}</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--shell-muted)]">Aderência = atingidos ÷ resultados fechados avaliáveis. Base: {unit}. Sem meta percentual fixa nesta visão.</p></div>
      <div className="flex items-center gap-1 rounded-xl border border-[color:var(--shell-line)] p-1" aria-label="População da análise">
        {(["motorista", "ajudante"] as const).map(option => <button key={option} type="button"
          className={role === option ? primaryButtonClass : actionButtonClass} aria-pressed={role === option}
          disabled={roleLocked && role !== option} onClick={() => onRoleChange(option)}><Users size={14} />{option === "motorista" ? "Motoristas" : "Ajudantes"}</button>)}
      </div>
    </div>
    {roleLocked && <p className="text-xs text-[var(--shell-muted)]">A função está definida no filtro compartilhado. Selecione “Todos” em Filtros para alternar a população.</p>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label={history.from === history.to ? "Aderência do dia selecionado" : "Aderência do período selecionado"} value={percent(summary.adherence)} detail={`${summary.attained} atingidos de ${summary.evaluated} resultados avaliados`} tone={palette.positive} />
      <Stat label="Fora do resultado esperado" value={String(summary.notAttained)} detail={`${summary.distinctMaps} mapas · ${summary.total} ${unit} no recorte`} tone={palette.negative} />
      <Stat label="Resultados em andamento" value={String(summary.pending)} detail={`${summary.unavailable} sem resultado avaliável · não entram na aderência`} tone={palette.pending} />
      <Stat label="Cobertura dos resultados" value={percent(closedCoverage)} detail={`${summary.evaluated} fechados avaliáveis de ${summary.total} observações`} />
    </div>
    {summary.total === 0 && <p className="rounded-xl border border-dashed border-[color:var(--shell-line)] p-4 text-sm">Nenhum resultado para esta população no recorte selecionado. Os gráficos de contexto abaixo podem mostrar outros dias da semana ou do mês.</p>}
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title={weekly.granular ? "Semana · evolução de segunda a sábado" : "Semanas agrupadas por mês"}
        subtitle={`${weekly.granular ? "Cada bloco representa uma semana, inclusive quando cruza o mês. Barras destacadas pertencem à seleção." : "Cada barra representa o trecho de uma semana dentro do mês. Domingos não entram; semanas na virada são divididas sem duplicar os dias."} Acumulado no contexto: ${percent(weekCounts.adherence)} (${weekCounts.attained}/${weekCounts.evaluated}).`}
        option={weeklyOption}>
        <p className="mt-2 text-xs leading-5 text-[var(--shell-muted)]">Participação da seleção na base semanal: {selectedWeekCounts.evaluated} de {weekCounts.evaluated} resultados avaliados ({percent(weekCounts.evaluated ? selectedWeekCounts.evaluated * 100 / weekCounts.evaluated : null)}).</p>
        <SeriesTable points={weekly.points} /></ChartCard>
      <ChartCard title={monthly.granular ? "Mês · acompanhamento diário" : "Meses · resultado consolidado"}
        subtitle={`${monthly.granular ? "O mês do dia selecionado aparece completo; dias futuros ficam sem resultado." : "Uma informação por mês, com aderência ponderada pelo número de resultados."} Acumulado no contexto: ${percent(monthCounts.adherence)} (${monthCounts.attained}/${monthCounts.evaluated}).`}
        option={monthlyOption}><SeriesTable points={monthly.points} /></ChartCard>
      <section className="min-w-0 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold">Diário e período · resultados por colaborador</h3>
          <p className="mb-5 mt-1 text-xs leading-5 text-[var(--shell-muted)]">{people.length} {role === "motorista" ? "motoristas" : "ajudantes"}. Cada percentual considera os mapas de cada pessoa. Passe o cursor para consultar a base.</p></div>
          <label className="text-xs text-[var(--shell-muted)]">Ordenar por<select className={`${fieldClass} mt-1 w-auto`} value={sort} onChange={event => setSort(event.target.value)}>
            <option value="adherence">Menor aderência</option><option value="volume">Mais resultados</option><option value="name">Nome</option></select></label></div>
        {people.length ? <><div role="img" aria-label="Aderência por colaborador"><EChart option={staffOption} notMerge lazyUpdate opts={{ renderer: "svg" }} style={{ height: 330, width: "100%" }} /></div>
          <details className="mt-3 text-xs text-[var(--shell-muted)]"><summary className="cursor-pointer py-2">Ver os resultados da equipe</summary><div className="max-h-64 overflow-auto"><table className="w-full text-left">
            <thead><tr><th className="py-2">Colaborador</th><th>Atingidos / avaliados</th><th>Aderência</th><th>Em andamento / sem resultado</th></tr></thead><tbody>
              {people.map(person => <tr key={person.employeeCode} className="border-t border-[color:var(--shell-line)]"><td className="py-2">{person.employeeName}</td><td>{person.counts.attained}/{person.counts.evaluated}</td><td>{percent(person.counts.adherence)}</td><td>{person.counts.pending} / {person.counts.unavailable}</td></tr>)}</tbody></table></div></details></> :
          <div className="flex h-80 items-center justify-center text-sm text-[var(--shell-muted)]">Nenhum colaborador com dados no recorte.</div>}
      </section>
      <ChartCard title="Mesmo mês · ano atual × ano anterior" subtitle="Comparação pelo mesmo trecho do mês. Meses encerrados usam o mês completo; o mês em curso compara até a data atual. Ausência de histórico aparece como lacuna."
        option={annualOption}>
        <div className="mt-3 space-y-2 text-xs text-[var(--shell-muted)]">{annual.map(row => <div key={row.month} className="flex flex-wrap justify-between gap-2 border-t border-[color:var(--shell-line)] pt-2">
          <span>{row.label} · {row.current.attained}/{row.current.evaluated} × {row.previous.attained}/{row.previous.evaluated}</span>
          <span>{row.current.adherence !== null && row.previous.adherence !== null ? `${(row.current.adherence - row.previous.adherence).toLocaleString("pt-BR", { maximumFractionDigits: 1, signDisplay: "always" })} p.p.` : "Sem comparação avaliável"}</span>
        </div>)}</div>
      </ChartCard>
    </div>
    <JourneyTeamReport history={history} indicator={indicator} filters={reportFilters} onFiltersChange={onReportFiltersChange} sort={reportSort} onSortChange={onReportSortChange} />
    <div>
      <section className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-5"><h3 className="flex items-center gap-2 font-semibold"><CircleHelp size={16} /> Leitura dos dados</h3>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--shell-muted)]"><li>Sem resultado não equivale a 0% de aderência. Ciclos abertos aguardam o fechamento oficial.</li>
          <li>{summary.expurged} observações com expurgo e {summary.anomalies} com anomalia temporal no recorte. O filtro de expurgo é respeitado.</li>
          <li>Equipe e cartões usam a seleção exata. Semanas e meses ampliam o contexto ao redor das datas selecionadas.</li>
          <li>{history.population === "MAP" ? "O resultado do mapa é contado uma vez, mesmo quando aparece para vários integrantes da equipe." : "Cada vínculo mapa–colaborador tem seu próprio resultado. Ao selecionar ajudantes, um mapa pode ter mais de uma participação."}</li>
        </ul>
      </section>
    </div>
  </div>;
}
