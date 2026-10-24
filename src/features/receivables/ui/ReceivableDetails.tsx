"use client";

import { useEffect, useRef, useState } from "react";
import type { Detail, Query, ReceivablesApi, Title } from "../model/types";
import { date, historyLabels, money, priorityLabels, situationLabels, titleKey } from "../lib/formatters";
import styles from "./receivables.module.css";

export default function ReceivableDetails({ title, query, api, refresh, close }: {
  title: Title; query: Query; api: ReceivablesApi; refresh: number; close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<Detail | null>(null);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try { const result = await api.detail(title, query, page, controller.signal); if (!controller.signal.aborted) setData(result); }
      catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Falha ao consultar o detalhe."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [api, page, query, refresh, title]);
  const row = data?.selected ?? title;
  return <dialog ref={dialog} className={styles.dialog} onClose={close} aria-labelledby="receivable-detail-title">
    <div className={styles.detailHeader}>
      <div><p className={styles.eyebrow}>Título {row.title} / parcela {row.installment}</p><h2 id="receivable-detail-title">{row.customerName}</h2><p className={styles.muted}>Cliente {row.customer} · unidade {row.unit}</p></div>
      <button onClick={() => dialog.current?.close()} aria-label="Fechar detalhes">Fechar ×</button>
    </div>
    {error && <p role="alert" className={styles.error}>{error}{data && " Os últimos dados carregados foram mantidos."}</p>}
    {loading && <p role="status" className={styles.muted}>Consultando detalhes…</p>}
    <div className={styles.detailBody} aria-busy={loading}>
      <div className={styles.metrics}>
        <div className={styles.metric}><span>Saldo pendente</span><strong>{money(row.pendingAmount)}</strong></div>
        <div className={styles.metric}><span>Vencimento</span><strong>{date(row.dueOn)}</strong><small>{situationLabels[row.status]}</small></div>
        <div className={styles.metric}><span>Prioridade</span><strong className={styles.smallValue}>{priorityLabels[row.priority]}</strong></div>
      </div>
      <ul className={styles.reasons}>{row.reasons.map(r => <li key={r}>{r}</li>)}</ul>
      <dl className={styles.facts}>
        <div><dt>Emissão</dt><dd>{date(row.issuedOn)}</dd></div><div><dt>Entrega</dt><dd>{date(row.deliveredOn)}</dd></div>
        <div><dt>Valor original</dt><dd>{money(row.originalAmount)}</dd></div><div><dt>Vendedor / supervisor</dt><dd>{row.seller ?? "—"} / {row.supervisor ?? "—"}</dd></div>
        <div><dt>Classe de risco informada</dt><dd>{row.sourceRiskClass ?? "—"} (sem interpretação automática)</dd></div>
        <div><dt>Status da cobrança</dt><dd>{row.collectionStatus ?? "Não informado"}</dd></div>
      </dl>
      {row.lastContact && <p className={styles.note}>Último atendimento informado: {row.lastContact}</p>}
      <h3>Comportamento de pagamento</h3>
      <p className={styles.note}>{historyLabels[row.history.status] ?? row.history.status}.
        {row.history.events > 0 && ` ${row.history.distinctTitles} títulos em ${row.history.events} eventos de pagamento; ${row.history.lateEvents} após o vencimento (${row.history.latePercent?.toLocaleString("pt-BR") ?? "—"}%). Maior atraso observado: ${row.history.maximumDelayDays ?? "—"} dia(s).`}
      </p>
      {data && <p className={styles.muted}>Período consultado: {date(data.metadata.historyFrom)} a {date(data.metadata.historyTo)}. Pagamentos parciais são eventos distintos; a taxa descreve os pagamentos observados.</p>}
      <h3>Pagamentos disponíveis</h3>
      {data && data.payments.length > 0 ? <>
        <div className={styles.tableWrap}><table><caption className={styles.srOnly}>Pagamentos do cliente na mesma unidade</caption><thead><tr><th>Título/parcela</th><th>Vencimento</th><th>Pagamento</th><th>Valor pago</th><th>Dias após vencimento</th></tr></thead>
          <tbody>{data.payments.map((p, n) => <tr key={`${page}:${n}`}><td>{p.title} / {p.installment}</td><td>{date(p.dueOn)}</td><td>{date(p.paidOn)}</td><td>{money(p.amount)}</td><td>{p.daysLate === null ? "—" : p.daysLate > 0 ? p.daysLate : "Em dia / antecipado"}</td></tr>)}</tbody></table></div>
        <div className={styles.pagination}><span>{data.totalPayments} eventos</span><button disabled={loading || page === 0} onClick={() => setPage(p => p - 1)}>Anteriores</button><button disabled={loading || (page + 1) * data.paymentSize >= data.totalPayments} onClick={() => setPage(p => p + 1)}>Próximos</button></div>
      </> : <p className={styles.empty}>Nenhum pagamento disponível para este cliente, unidade e período.</p>}
      {data && <><h3>Títulos atuais deste cliente</h3><div className={styles.tableWrap}><table><thead><tr><th>Título/parcela</th><th>Vencimento</th><th>Saldo</th><th>Situação</th></tr></thead><tbody>{data.customerTitles.map(t => <tr key={titleKey(t)}><td>{t.title} / {t.installment}</td><td>{date(t.dueOn)}</td><td>{money(t.pendingAmount)}</td><td>{situationLabels[t.status]}</td></tr>)}</tbody></table></div></>}
    </div>
  </dialog>;
}

