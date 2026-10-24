export type Situation = "ALL" | "OVERDUE" | "DUE_TODAY" | "UPCOMING" | "UNKNOWN_DUE";
export type Priority = "ALL" | "OVERDUE" | "PREVENTIVE" | "DUE_SOON" | "MONITOR" | "DATA_REVIEW";
export type History = {
  status: string; events: number; distinctTitles: number; lateEvents: number; recurringLateTitles: number;
  latePercent: number | null; maximumDelayDays: number | null; firstPaymentOn: string | null; lastPaymentOn: string | null;
};
export type Title = {
  unit: number; customer: number; title: number; installment: string; customerName: string;
  issuedOn: string | null; deliveredOn: string | null; dueOn: string | null;
  originalAmount: number | null; pendingAmount: number; seller: number | null; supervisor: number | null;
  sourceRiskClass: number | null; collectionStatus: string | null; lastContact: string | null;
  status: Exclude<Situation, "ALL">; daysOverdue: number | null; priority: Exclude<Priority, "ALL">;
  reasons: string[]; history: History;
};
export type Query = {
  search: string; unit: string; seller: string; supervisor: string; dueFrom: string; dueTo: string;
  issuedFrom: string; issuedTo: string; historyFrom: string; historyTo: string;
  status: Situation; priority: Priority; sort: string; page: number; size: number;
};
export type Metadata = {
  queriedAt: string; sourceUpdatedAt: string | null; asOf: string; historyFrom: string; historyTo: string;
  historyStatus: string; paymentEvents: number; duplicatePaymentRows: number; invalidPaymentEvents: number;
  historyUnits: number[]; warnings: string[];
  portfolioCoverage: { titles: number; firstIssuedOn: string | null; lastIssuedOn: string | null; firstDueOn: string | null; lastDueOn: string | null };
  policy: { upcomingDays: number; recentDays: number; minimumHistoryTitles: number; recurringLateTitles: number };
};
export type Dashboard = {
  summary: { titles: number; customers: number; pendingAmount: number; overdueTitles: number; overdueAmount: number;
    dueTodayTitles: number; dueTodayAmount: number; upcomingTitles: number; upcomingAmount: number;
    preventiveTitles: number; unknownDueTitles: number };
  items: Title[]; page: number; size: number; total: number; totalPages: number; metadata: Metadata;
  filters: { units: number[]; sellers: number[]; supervisors: number[] };
};
export type Payment = { title: number; installment: string; dueOn: string | null; paidOn: string | null;
  amount: number | null; interest: number | null; netAmount: number | null; daysLate: number | null; duplicateRows: number };
export type Detail = { selected: Title; customerTitles: Title[]; payments: Payment[]; paymentPage: number;
  paymentSize: number; totalPayments: number; metadata: Metadata };
export type ReceivablesApi = {
  dashboard: (query: Query, signal: AbortSignal) => Promise<Dashboard>;
  detail: (title: Title, query: Query, paymentPage: number, signal: AbortSignal) => Promise<Detail>;
};

