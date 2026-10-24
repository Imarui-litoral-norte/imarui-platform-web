import type { Dashboard, Detail, Query, ReceivablesApi, Title } from "../model/types";

type Transport = (path: string, signal: AbortSignal) => Promise<unknown>;
export function queryString(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== "" && value !== undefined && value !== null) params.set(key, String(value));
  }
  return params.toString();
}
function validTitle(row: Title): boolean {
  return !!row && typeof row.customerName === "string" && Number.isInteger(row.unit) &&
    Number.isInteger(row.customer) && Number.isInteger(row.title) && typeof row.installment === "string" &&
    Number.isFinite(row.pendingAmount) && row.pendingAmount > 0 &&
    ["OVERDUE", "DUE_TODAY", "UPCOMING", "UNKNOWN_DUE"].includes(row.status) &&
    ["OVERDUE", "PREVENTIVE", "DUE_SOON", "MONITOR", "DATA_REVIEW"].includes(row.priority) &&
    Array.isArray(row.reasons) && row.reasons.every(r => typeof r === "string") &&
    !!row.history && typeof row.history.status === "string" && Number.isInteger(row.history.events) &&
    (row.dueOn === null || /^\d{4}-\d{2}-\d{2}$/.test(row.dueOn));
}
export function normalizeDashboard(value: unknown): Dashboard {
  const data = value as Dashboard;
  if (!data || !data.summary || !Number.isInteger(data.total) || !Number.isInteger(data.page) ||
    !Number.isInteger(data.size) || !Number.isInteger(data.totalPages) ||
    !Array.isArray(data.items) || !data.items.every(validTitle) || !data.metadata ||
    typeof data.metadata.queriedAt !== "string" || !data.metadata.policy || !data.metadata.portfolioCoverage ||
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
    !data.payments.every(p => p && Number.isInteger(p.title) && typeof p.installment === "string" &&
      (p.amount === null || Number.isFinite(p.amount))))
    throw new Error("Resposta inválida do detalhe do boleto.");
  return data;
}
export function createReceivablesApi(request: Transport): ReceivablesApi {
  return {
    dashboard: async (query, signal) => normalizeDashboard(await request(
      `/api/v1/receivables/titles?${queryString(query)}`, signal)),
    detail: async (title, query, paymentPage, signal) => normalizeDetail(await request(
      `/api/v1/receivables/titles/${title.unit}/${title.customer}/${title.title}/${encodeURIComponent(title.installment)}?${queryString(query)}&paymentPage=${paymentPage}&paymentSize=20`, signal)),
  };
}

