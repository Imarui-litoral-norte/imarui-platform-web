import type { Dashboard, Detail, Query, ReceivablesApi, Risk, Title } from "../model/types";

type Transport = (path: string, signal: AbortSignal) => Promise<unknown>;
type DownloadTransport = (path: string, signal: AbortSignal) => ReturnType<ReceivablesApi["exportCsv"]>;
export function supportsAnnualRisk(data: Pick<Dashboard, "metadata">): boolean {
  return data.metadata.riskModel === "BEHAVIOURAL_V1";
}
export function queryString(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== "" && value !== undefined && value !== null) params.set(key, String(value));
  }
  return params.toString();
}
export function exportQueryString(query: Query): string {
  const params = new URLSearchParams(queryString(query));
  params.delete("page");
  params.delete("size");
  return params.toString();
}
function validRisk(risk: Risk | undefined): boolean {
  // Permit gradual deployment with the previous server contract.
  if (risk === undefined) return true;
  return !!risk && typeof risk.status === "string" && typeof risk.model === "string" &&
    Number.isInteger(risk.year) && typeof risk.from === "string" && typeof risk.to === "string" &&
    (risk.level === null || Number.isInteger(risk.level) && risk.level >= 1 && risk.level <= 5) &&
    (risk.score === null || Number.isInteger(risk.score) && risk.score >= 0 && risk.score <= 100) &&
    [risk.observedTitles, risk.lateTitles, risk.recentLateTitles, risk.maximumOpenDelayDays,
      risk.highAmountTitles, risk.otherAmountTitles].every(n => Number.isInteger(n) && n >= 0) &&
    [risk.lateTitlePercent, risk.lateAmountPercent, risk.weightedDelayDays, risk.onTimeMedian,
      risk.highAmountLatePercent, risk.otherAmountLatePercent, risk.exposureToOnTimeMedian]
      .every(n => n === null || Number.isFinite(n) && n >= 0) &&
    Number.isFinite(risk.openOverdueAmount) && risk.openOverdueAmount >= 0 &&
    Array.isArray(risk.reasons) && risk.reasons.every(r => typeof r === "string") &&
    Array.isArray(risk.components) && risk.components.every(c => c && typeof c.code === "string" &&
      Number.isInteger(c.points) && Number.isInteger(c.maximum) && c.points >= 0 && c.points <= c.maximum);
}
function validTitle(row: Title): boolean {
  return !!row && typeof row.customerName === "string" && Number.isInteger(row.unit) &&
    Number.isInteger(row.customer) && Number.isInteger(row.title) && typeof row.installment === "string" &&
    Number.isFinite(row.pendingAmount) && row.pendingAmount > 0 &&
    ["OVERDUE", "DUE_TODAY", "UPCOMING", "UNKNOWN_DUE"].includes(row.status) &&
    ["OVERDUE", "PREVENTIVE", "DUE_SOON", "MONITOR", "DATA_REVIEW"].includes(row.priority) &&
    Array.isArray(row.reasons) && row.reasons.every(r => typeof r === "string") &&
    !!row.history && typeof row.history.status === "string" && Number.isInteger(row.history.events) && validRisk(row.risk) &&
    (row.dueOn === null || /^\d{4}-\d{2}-\d{2}$/.test(row.dueOn));
}
export function normalizeDashboard(value: unknown): Dashboard {
  const data = value as Dashboard;
  if (!data || !data.summary || !Number.isInteger(data.total) || !Number.isInteger(data.page) ||
    !Number.isInteger(data.size) || !Number.isInteger(data.totalPages) ||
    !Array.isArray(data.items) || !data.items.every(validTitle) || !data.metadata ||
    typeof data.metadata.queriedAt !== "string" || !data.metadata.policy || !data.metadata.portfolioCoverage ||
    (supportsAnnualRisk(data) && data.items.some(row => !row.risk)) ||
    !Array.isArray(data.metadata.warnings) || !data.filters ||
    ![data.filters.units, data.filters.sellers, data.filters.supervisors].every(Array.isArray) ||
    data.total !== data.summary.titles || !Number.isFinite(data.summary.pendingAmount) ||
    data.summary.titles !== data.summary.overdueTitles + data.summary.dueTodayTitles +
      data.summary.upcomingTitles + data.summary.unknownDueTitles)
    throw new Error("Resposta inválida da carteira de boletos.");
  return data;
}
export function normalizeDetail(value: unknown): Detail {
  const data = value as Detail;
  if (!data || !validTitle(data.selected) || !Array.isArray(data.customerTitles) ||
    !data.customerTitles.every(validTitle) || !Array.isArray(data.payments) ||
    !Number.isInteger(data.totalPayments) || !data.metadata ||
    (supportsAnnualRisk(data) && [data.selected, ...data.customerTitles].some(row => !row.risk)) ||
    !data.payments.every(p => p && Number.isInteger(p.title) && typeof p.installment === "string" &&
      (p.amount === null || Number.isFinite(p.amount))))
    throw new Error("Resposta inválida do detalhe do boleto.");
  return data;
}
export function createReceivablesApi(request: Transport, download: DownloadTransport): ReceivablesApi {
  return {
    exportCsv: (query, signal) => download(`/api/v1/receivables/titles/export?${exportQueryString(query)}`, signal),
    dashboard: async (query, signal) => {
      const data = normalizeDashboard(await request(`/api/v1/receivables/titles?${queryString(query)}`, signal));
      if ((query.riskLevel || query.sort === "RISK_DESC") && !supportsAnnualRisk(data))
        throw new Error("O backend em execução ainda não oferece os filtros de risco. Conclua a atualização do servidor e consulte novamente.");
      if (query.riskLevel && data.items.some(row => row.risk?.level !== Number(query.riskLevel)))
        throw new Error("O servidor retornou clientes fora do nível de risco selecionado. Atualize a consulta e verifique a versão do servidor.");
      return data;
    },
    detail: async (title, query, paymentPage, signal) => normalizeDetail(await request(
      `/api/v1/receivables/titles/${title.unit}/${title.customer}/${title.title}/${encodeURIComponent(title.installment)}?${queryString(query)}&paymentPage=${paymentPage}&paymentSize=20`, signal)),
  };
}

