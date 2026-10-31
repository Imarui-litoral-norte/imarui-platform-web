import type { Priority, Query, Situation, Title } from "../model/types";

export const situationLabels: Record<Situation, string> = { ALL: "Todas as situações", OVERDUE: "Vencidos",
  DUE_TODAY: "Vencem hoje", UPCOMING: "A vencer", UNKNOWN_DUE: "Vencimento ausente" };
export const priorityLabels: Record<Priority, string> = { ALL: "Todas as prioridades", OVERDUE: "Cobrar vencido",
  PREVENTIVE: "Atenção preventiva", DUE_SOON: "Próximo vencimento", MONITOR: "Acompanhar", DATA_REVIEW: "Revisar dados" };
export const historyLabels: Record<string, string> = { AVAILABLE: "Histórico disponível", INSUFFICIENT: "Amostra insuficiente",
  NO_HISTORY: "Sem histórico do cliente", UNIT_UNMAPPED: "Unidade sem associação confirmada", UNAVAILABLE: "Histórico indisponível",
  EMPTY_PERIOD: "Sem pagamentos no período", NO_CUSTOMERS: "Carteira sem clientes" };
export const money = (value: number | null) => value === null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const date = (value: string | null) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
export const titleKey = (row: Title) => `${row.unit}:${row.customer}:${row.title}:${row.installment}`;
export function initialQuery(): Query {
  return { search: "", unit: "", seller: "", supervisor: "", dueFrom: "", dueTo: "", issuedFrom: "", issuedTo: "",
    historyFrom: "", historyTo: "", status: "ALL", priority: "ALL", riskLevel: "", sort: "PRIORITY", page: 0, size: 25 };
}

