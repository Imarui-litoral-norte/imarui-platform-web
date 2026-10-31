import type { Risk } from "../model/types";
import { date, historyLabels, money } from "../lib/formatters";
import styles from "./receivables.module.css";

const levels: Record<number, string> = { 1: "baixo", 2: "moderado", 3: "elevado", 4: "alto", 5: "muito alto" };
const components: Record<string, string> = { FREQUENCY: "Frequência de atrasos", SEVERITY: "Duração dos atrasos",
  RECENCY: "Atrasos recentes", LATE_AMOUNT: "Valores em atraso", AMOUNT_SENSITIVITY: "Atraso em valores maiores", EXPOSURE: "Exposição atual" };
const number = (value: number | null, suffix = "") => value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${suffix}`;

export function RiskBadge({ risk }: { risk?: Risk }) {
  if (!risk || risk.level === null) return <span className={styles.historyLabel}>Risco não estimado</span>;
  return <span className={`${styles.badge} ${risk.level >= 4 ? styles.overdue : risk.level >= 3 ? styles.preventive : styles.monitor}`}>
    Cliente risco {risk.level}/5 · {levels[risk.level]}
  </span>;
}

export default function CustomerRisk({ risk }: { risk?: Risk }) {
  return <section aria-labelledby="customer-risk-title">
    <h3 id="customer-risk-title">Risco comportamental do cliente</h3>
    <RiskBadge risk={risk} />
    {!risk ? <p className={styles.note}>O servidor ainda não disponibiliza a análise anual de risco.</p> : <>
      <p className={styles.muted}>Vencimentos de {date(risk.from)} a {date(risk.to)} · cobertura limitada aos registros disponíveis.
        O filtro de pagamentos não altera esta análise anual.</p>
      {risk.level === null && <p className={styles.note}>{historyLabels[risk.status] ?? risk.status}. Histórico insuficiente não significa baixo risco.</p>}
      <dl className={styles.facts}>
        <div><dt>Títulos com atraso em {risk.year}</dt><dd>{risk.lateTitles} de {risk.observedTitles} observados ({number(risk.lateTitlePercent, "%")})</dd></div>
        <div><dt>Valor observado em atraso</dt><dd>{number(risk.lateAmountPercent, "%")}</dd></div>
        <div><dt>Atraso médio ponderado pelo valor atrasado</dt><dd>{number(risk.weightedDelayDays, " dias")}</dd></div>
        <div><dt>Títulos atrasados na janela recente</dt><dd>{risk.recentLateTitles}</dd></div>
        <div><dt>Saldo vencido atual do cliente</dt><dd>{money(risk.openOverdueAmount)} · maior atraso: {risk.maximumOpenDelayDays} dias</dd></div>
        <div><dt>Mediana dos pagamentos observados em dia por título</dt><dd>{money(risk.onTimeMedian)}</dd></div>
        <div><dt>Exposição total / mediana em dia</dt><dd>{number(risk.exposureToOnTimeMedian, "×")}</dd></div>
        <div><dt>Títulos acima de 1,5× a mediana em dia</dt><dd>{risk.highAmountTitles} observados · {number(risk.highAmountLatePercent, "%")} com atraso</dd></div>
        <div><dt>Demais valores</dt><dd>{risk.otherAmountTitles} observados · {number(risk.otherAmountLatePercent, "%")} com atraso</dd></div>
        <div><dt>Índice comportamental</dt><dd>{risk.score === null ? "Não calculado" : `${risk.score}/100`}</dd></div>
      </dl>
      <ul className={styles.reasons}>{risk.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
      {risk.components.length > 0 && <details><summary>Como o índice foi composto</summary><ul>{risk.components.map(c => <li key={c.code}>{components[c.code] ?? c.code}: {c.points}/{c.maximum} pontos</li>)}</ul></details>}
      <p className={styles.note}>Escala de 1 (baixo) a 5 (muito alto), baseada no comportamento observado.
        Pagamentos parciais contam uma vez por título/parcela. O índice usa pesos iniciais, ainda sem calibração preditiva,
        e não representa probabilidade de inadimplência ou limite de crédito. Atrasos usam dias corridos, sem ajuste de feriados.</p>
    </>}
  </section>;
}
