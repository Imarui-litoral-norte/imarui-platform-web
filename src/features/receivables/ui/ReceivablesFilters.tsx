import type { Dashboard, Query } from "../model/types";
import { priorityLabels, situationLabels } from "../lib/formatters";
import styles from "./receivables.module.css";

type Props = { draft: Query; setDraft: (next: Query) => void; options?: Dashboard["filters"];
  busy: boolean; riskAvailable: boolean; apply: () => void; reset: () => void };
export default function ReceivablesFilters({ draft, setDraft, options, busy, riskAvailable, apply, reset }: Props) {
  const field = (key: keyof Query) => ({ value: String(draft[key]), onChange:
    (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft({ ...draft, [key]: event.target.value }) });
  return <form className={styles.filters} onSubmit={event => { event.preventDefault(); apply(); }}>
    <fieldset className={styles.filterFields} disabled={busy}>
    <div className={styles.filterRow}>
      <label className={styles.search}>Cliente ou título<input {...field("search")} placeholder="Nome, código do cliente ou título" maxLength={100} /></label>
      <label>Situação<select {...field("status")}>{Object.entries(situationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Prioridade<select {...field("priority")}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Risco do cliente<select {...field("riskLevel")} disabled={!riskAvailable}><option value="">Todos os níveis</option>{[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>Risco {level}/5</option>)}</select></label>
      <button className={styles.primary} disabled={busy} type="submit">Aplicar filtros</button>
      <button type="button" onClick={reset} disabled={busy}>Limpar</button>
    </div>
    <details className={styles.advanced}>
      <summary>Períodos, equipe e ordenação</summary>
      <div className={styles.filterRow}>
        <label>Vencimento de<input type="date" {...field("dueFrom")} /></label>
        <label>Vencimento até<input type="date" {...field("dueTo")} min={draft.dueFrom || undefined} /></label>
        <label>Emissão de<input type="date" {...field("issuedFrom")} /></label>
        <label>Emissão até<input type="date" {...field("issuedTo")} min={draft.issuedFrom || undefined} /></label>
        <label>Unidade<select {...field("unit")}><option value="">Todas</option>{options?.units.map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Vendedor<select {...field("seller")}><option value="">Todos</option>{options?.sellers.map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Supervisor<select {...field("supervisor")}><option value="">Todos</option>{options?.supervisors.map(n => <option key={n}>{n}</option>)}</select></label>
        <label>Histórico de pagamentos de<input type="date" {...field("historyFrom")} /></label>
        <label>Histórico até<input type="date" {...field("historyTo")} min={draft.historyFrom || undefined} /></label>
        <label>Ordenar por<select {...field("sort")}><option value="PRIORITY">Prioridade de cobrança</option><option value="RISK_DESC" disabled={!riskAvailable}>Maior risco do cliente</option><option value="DUE_ASC">Vencimento mais antigo</option><option value="AMOUNT_DESC">Maior saldo</option><option value="CUSTOMER_ASC">Nome do cliente</option></select></label>
        <label>Títulos por página<select value={draft.size} onChange={e => setDraft({ ...draft, size: Number(e.target.value) })}><option>25</option><option>50</option><option>100</option></select></label>
      </div>
      <p className={styles.muted}>Sem período histórico informado, a consulta usa do início do ano até hoje. As datas de emissão e vencimento filtram a carteira; o período de pagamentos altera apenas o histórico exibido. O risco sempre considera os vencimentos do ano corrente até hoje e toda a carteira elegível do cliente.</p>
    </details>
    </fieldset>
  </form>;
}

