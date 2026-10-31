"use client";

import { useEffect, useRef, useState } from "react";
import { Download, RefreshCw, ArrowRight, Wallet, Clock3, CalendarDays, ShieldAlert } from "lucide-react";
import { exportQueryString } from "../api/receivablesApi";
import type { Dashboard, Query, ReceivablesApi, Title } from "../model/types";
import { date, historyLabels, initialQuery, money, priorityLabels, situationLabels, titleKey } from "../lib/formatters";
import ReceivablesFilters from "./ReceivablesFilters";
import ReceivableDetails from "./ReceivableDetails";
import { RiskBadge } from "./CustomerRisk";
import styles from "./receivables.module.css";

export default function ReceivablesDashboard({ api }: { api: ReceivablesApi }) {
  const [draft, setDraft] = useState<Query>(initialQuery);
  const [query, setQuery] = useState<Query>(initialQuery);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loadedQuery, setLoadedQuery] = useState<Query>(initialQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<Title | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const exportController = useRef<AbortController | null>(null);
  useEffect(() => () => exportController.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError(""); setExportError(""); setExportStatus("");
      try {
        const result = await api.dashboard(query, controller.signal);
        if (!controller.signal.aborted) { setData(result); setLoadedQuery(query); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Não foi possível conectar ao serviço de boletos."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [api, query, refresh]);
  const apply = () => setQuery({ ...draft, page: 0 });
  const reset = () => { const clean = initialQuery(); setDraft(clean); setQuery(clean); };
  const pendingFilters = exportQueryString(draft) !== exportQueryString(loadedQuery) || draft.size !== loadedQuery.size;
  const busy = loading || exporting;
  const exportCsv = async () => {
    if (!data || busy || error || pendingFilters || exportController.current) return;
    const controller = new AbortController();
    exportController.current = controller;
    setExporting(true); setExportError(""); setExportStatus("");
    try {
      const file = await api.exportCsv({ ...loadedQuery,
        historyFrom: data.metadata.historyFrom, historyTo: data.metadata.historyTo }, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url; link.download = file.filename;
      document.body.appendChild(link);
      try { link.click(); } finally { link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
      setExportStatus("CSV gerado com todos os títulos dos filtros aplicados.");
    } catch (e) {
      if (!controller.signal.aborted) setExportError(e instanceof Error ? e.message : "Não foi possível exportar o CSV. Tente novamente.");
    } finally {
      exportController.current = null;
      if (!controller.signal.aborted) setExporting(false);
    }
  };
  const summary = data?.summary;
  const cards = summary ? [
    { label: "Carteira filtrada", value: money(summary.pendingAmount), caption: `${summary.titles} títulos · ${summary.customers} clientes`, icon: Wallet, tone: "total" },
    { label: "Vencidos", value: money(summary.overdueAmount), caption: `${summary.overdueTitles} títulos para atenção`, icon: Clock3, tone: "overdue" },
    { label: "Vencem hoje", value: money(summary.dueTodayAmount), caption: `${summary.dueTodayTitles} títulos`, icon: CalendarDays, tone: "today" },
    { label: "A vencer", value: money(summary.upcomingAmount), caption: `${summary.upcomingTitles} títulos · ${summary.preventiveTitles} alertas preventivos`, icon: ShieldAlert, tone: "future" },
  ] : [];
  return <section className={styles.root}>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>SPO / Financeiro</p><h1>Gestão de boletos</h1><p className={styles.subtitle}>Acompanhe a carteira e organize a atenção aos próximos vencimentos.</p></div>
      <div className={styles.headerActions}>
        <button onClick={() => void exportCsv()} disabled={busy || !data?.total || !!error || pendingFilters} aria-describedby="receivables-export-help"><Download size={16} aria-hidden />{exporting ? "Exportando…" : "Exportar CSV"}</button>
        <button className={styles.primary} onClick={() => setRefresh(n => n + 1)} disabled={busy}><RefreshCw size={16} aria-hidden className={loading ? styles.spinning : ""} />{loading ? "Atualizando…" : "Atualizar carteira"}</button>
      </div>
    </header>
    <div className={styles.statusLine} aria-live="polite">{data ? <>
      <span><span className={styles.liveDot} /> Consulta de {new Date(data.metadata.queriedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
      <span>Referência: {date(data.metadata.asOf)}</span><span>Atualização da fonte: {data.metadata.sourceUpdatedAt ? new Date(data.metadata.sourceUpdatedAt).toLocaleString("pt-BR") : "não informada"}</span>
    </> : <span>{loading ? "Consultando a carteira…" : "Aguardando consulta"}</span>}</div>
    {error && <div className={styles.error} role="alert"><strong>{error}</strong>{data && <p>A última consulta bem-sucedida foi mantida. Os filtros e totais exibidos correspondem a esses dados.</p>}</div>}
    <div className={styles.metrics} aria-busy={loading}>
      {cards.map(card => <div className={`${styles.metric} ${styles[card.tone]}`} key={card.label}><div><span>{card.label}</span><card.icon size={19} aria-hidden /></div><strong>{card.value}</strong><small>{card.caption}</small></div>)}
      {!data && loading && <p className={styles.empty} role="status">Carregando indicadores e títulos…</p>}
    </div>
    {data && data.metadata.historyStatus !== "AVAILABLE" && <div className={styles.note}><strong>{historyLabels[data.metadata.historyStatus] ?? "Histórico indisponível"} no período consultado.</strong> O risco anual aparece separadamente em cada cliente e depende da cobertura e da amostra anual.</div>}
    <ReceivablesFilters draft={draft} setDraft={setDraft} options={data?.filters} busy={busy} apply={apply} reset={reset} />
    <p id="receivables-export-help" className={styles.muted}>{pendingFilters ? "Há filtros alterados. Clique em Aplicar filtros para atualizar a lista e liberar a exportação." : "O CSV inclui todas as páginas dos filtros e da ordenação aplicados. A exportação consulta a carteira novamente."}</p>
    {exportError && <div className={styles.error} role="alert">{exportError}</div>}
    <p className={styles.muted} role="status">{exporting ? "Gerando CSV de todos os títulos filtrados…" : exportStatus}</p>
    <div className={styles.listHeader}><div><h2>Fila de acompanhamento</h2><p className={styles.muted}>Prioridade com motivos visíveis, calculada pelo backend.</p></div>{data && <span className={styles.count}>{data.total} títulos</span>}</div>
    <div className={styles.tableWrap} aria-busy={loading}>
      <table><caption className={styles.srOnly}>Títulos da carteira com prioridade de cobrança</caption><thead><tr><th>Cliente / título</th><th>Vencimento</th><th>Saldo pendente</th><th>Prioridade e motivo</th><th>Histórico</th><th><span className={styles.srOnly}>Ações</span></th></tr></thead>
        <tbody>{data?.items.map(row => <tr key={titleKey(row)}>
          <td><strong>{row.customerName}</strong><small>Cliente {row.customer} · UNB {row.unit}</small><small>Título {row.title} / parcela {row.installment}</small></td>
          <td><strong>{date(row.dueOn)}</strong><small className={row.status === "OVERDUE" ? styles.redText : ""}>{row.daysOverdue !== null && row.daysOverdue > 0 ? `${row.daysOverdue} dia(s) em atraso` : situationLabels[row.status]}</small></td>
          <td className={styles.amount}>{money(row.pendingAmount)}</td>
          <td><span className={`${styles.badge} ${styles[row.priority.toLowerCase()]}`}>{priorityLabels[row.priority]}</span><small><RiskBadge risk={row.risk} /></small><small>{row.reasons[0]}</small>{row.risk && <small>{row.risk.lateTitles}/{row.risk.observedTitles} títulos observados com atraso em {row.risk.year}</small>}</td>
          <td><span className={styles.historyLabel}>{historyLabels[row.history.status] ?? row.history.status}</span>{row.history.events > 0 && <small>{row.history.lateEvents}/{row.history.events} pagamentos após vencimento</small>}</td>
          <td><button onClick={() => setSelected(row)} className={styles.iconButton} aria-label={`Abrir título ${row.title} de ${row.customerName}`}>Detalhes <ArrowRight size={14} aria-hidden /></button></td>
        </tr>)}</tbody>
      </table>
      {!loading && !data && <p className={styles.empty}>A carteira ainda não pôde ser carregada. Use Atualizar carteira para tentar novamente.</p>}
      {data && data.items.length === 0 && <p className={styles.empty}>{data.total === 0 ? "Nenhum título encontrado para esta consulta." : "Esta página não possui títulos. Volte à primeira página."}</p>}
    </div>
    {data && <footer className={styles.pagination}><span>{data.total ? `Página ${data.page + 1} de ${data.totalPages}` : "Nenhum resultado"} · totais de todas as páginas</span><div>
      <button disabled={busy || data.page === 0} onClick={() => setQuery({ ...loadedQuery, page: 0 })}>Primeira</button>
      <button disabled={busy || data.page === 0} onClick={() => setQuery({ ...loadedQuery, page: data.page - 1 })}>Anterior</button>
      <button disabled={busy || data.page + 1 >= data.totalPages} onClick={() => setQuery({ ...loadedQuery, page: data.page + 1 })}>Próxima</button>
    </div></footer>}
    {data && <details className={styles.coverage}><summary>Cobertura dos dados e regra de prioridade</summary>
      <p>Carteira disponível: {data.metadata.portfolioCoverage.titles} títulos; emissões de {date(data.metadata.portfolioCoverage.firstIssuedOn)} a {date(data.metadata.portfolioCoverage.lastIssuedOn)}. Vencimentos de {date(data.metadata.portfolioCoverage.firstDueOn)} a {date(data.metadata.portfolioCoverage.lastDueOn)}.</p>
      <p>Histórico consultado: {date(data.metadata.historyFrom)} a {date(data.metadata.historyTo)}; {data.metadata.paymentEvents} eventos associados aos códigos dos clientes da carteira. Indicadores usam cliente e unidade confirmados.</p>
      <p>Alerta preventivo: vencimento em até {data.metadata.policy.upcomingDays} dias e cliente com risco anual 3, 4 ou 5. O risco exige ao menos {Math.max(3, data.metadata.policy.minimumHistoryTitles)} títulos com pagamentos válidos e vencimento no ano até hoje, na mesma unidade confirmada. A janela recente usa {data.metadata.policy.recentDays} dias. Os detalhes mostram métricas e motivos.</p>
      <ul>{data.metadata.warnings.map(w => <li key={w}>{w}</li>)}</ul>
    </details>}
    {selected && <ReceivableDetails key={titleKey(selected)} title={selected} query={loadedQuery} api={api} refresh={refresh} close={() => setSelected(null)} />}
  </section>;
}

