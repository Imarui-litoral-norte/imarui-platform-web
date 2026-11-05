import { authApi, clearAuthSession, getOrCreateDeviceId, readAuthSession } from "@/features/auth";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";
import type { AnalysisRole, Indicator, JourneyAudit, JourneyAuditTableQuery, JourneyHistory, JourneyItem, JourneyQuery, JourneyResponse, PeriodResponse } from "../model/types";

export function buildJourneyPath(query: JourneyQuery): string {
  const params = new URLSearchParams({ from: query.from, to: query.to, expurge: query.expurge });
  if (query.indicator !== "tr") params.set("mode", query.mode);
  if (query.map.trim()) params.set("map", query.map.trim());
  if (query.employeeCode.trim()) params.set("employeeCode", query.employeeCode.trim());
  if (query.role !== "all") params.set("role", query.role);
  return `/api/v1/journey/${query.indicator}?${params.toString()}`;
}

/** Validates the envelope before UI code receives the typed contract. */
export function normalizeJourneyResponse<T extends JourneyItem>(value: unknown, indicator?: Indicator): PeriodResponse<T> {
  if (!value || typeof value !== "object") throw new Error("Resposta de Jornada inválida.");
  const payload = value as Record<string, unknown>;
  if (typeof payload.from !== "string" || typeof payload.to !== "string" ||
      (payload.snapshotAt !== null && typeof payload.snapshotAt !== "string") ||
      !Array.isArray(payload.items)) throw new Error("Resposta de Jornada inválida.");
  for (const item of payload.items) {
    if (!item || typeof item !== "object" || !("context" in item) ||
        !item.context || typeof item.context !== "object" ||
        !("map" in item.context) || !("employeeCode" in item.context) ||
        !("expurge" in item) || !item.expurge || typeof item.expurge !== "object" ||
        !("snapshotAt" in item) ||
        (indicator !== undefined && (!(indicator in item) ||
          !item[indicator] || typeof item[indicator] !== "object"))) {
      throw new Error("Linha de Jornada inválida.");
    }
  }
  return payload as unknown as PeriodResponse<T>;
}

export function buildJourneyHistoryPath(query: JourneyQuery, role: AnalysisRole, search: string,
  scope: string, includePrevious = true): string {
  const original = buildJourneyPath(query);
  const [path, raw] = original.split("?");
  const params = new URLSearchParams(raw);
  if (query.viewFilters) params.set("viewFilters", JSON.stringify(query.viewFilters));
  params.set("populationRole", role);
  if (search.trim()) params.set("search", search.trim());
  params.set("scope", scope);
  params.set("includePrevious", String(includePrevious));
  return `${path.replace("/journey/", "/journey/history/")}?${params}`;
}

export function normalizeJourneyHistory(value: unknown): JourneyHistory {
  if (!value || typeof value !== "object") throw new Error("Resposta analítica inválida.");
  const payload = value as JourneyHistory;
  const validCounts = (counts: JourneyHistory["summary"]) => counts &&
    [counts.total, counts.attained, counts.notAttained, counts.pending, counts.unavailable,
      counts.evaluated, counts.distinctMaps, counts.expurged, counts.anomalies].every(n => Number.isInteger(n) && n >= 0) &&
    counts.total === counts.attained + counts.notAttained + counts.pending + counts.unavailable &&
    counts.evaluated === counts.attained + counts.notAttained &&
    (counts.evaluated === 0 ? counts.adherence === null : typeof counts.adherence === "number" &&
      Number.isFinite(counts.adherence) && Math.abs(counts.adherence - counts.attained * 100 / counts.evaluated) < 0.001);
  if (![payload.from, payload.to, payload.contextFrom, payload.contextTo, payload.asOf].every(d => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) ||
    !["MAP", "MAP_EMPLOYEE"].includes(payload.population) || !["motorista", "ajudante"].includes(payload.role) ||
    typeof payload.hasLiveOrigin !== "boolean" || (payload.snapshotAt !== null && typeof payload.snapshotAt !== "string") ||
    !validCounts(payload.summary) || !Array.isArray(payload.daily) || !Array.isArray(payload.previousYearDaily) || !Array.isArray(payload.collaborators) ||
    ![...payload.daily, ...payload.previousYearDaily].every(d => typeof d.date === "string" && validCounts(d.counts)) ||
    !payload.collaborators.every(c => typeof c.employeeCode === "number" && typeof c.employeeName === "string" && validCounts(c.counts)) ||
    (payload.team !== undefined && (!Array.isArray(payload.team) || !payload.team.every(row =>
      typeof row.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isInteger(row.map) && row.map > 0 &&
      Number.isInteger(row.employeeCode) && typeof row.employeeName === "string" && typeof row.role === "string" &&
      (row.fleet === null || typeof row.fleet === "string") && (row.departureDate === null || (typeof row.departureDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.departureDate))) &&
      (row.expurgePresent === null || typeof row.expurgePresent === "boolean") && validCounts(row.counts) &&
      (row.seconds === null || (typeof row.seconds === "number" && Number.isFinite(row.seconds) && row.seconds >= 0)) &&
      (row.journeyExceeded === null || typeof row.journeyExceeded === "boolean")))))
    throw new Error("Resposta analítica inválida.");
  return payload;
}

export function buildJourneyAuditPath(query: JourneyQuery, role: AnalysisRole, search: string,
  scope: string, page: number, pageSize: number, auditFilter = "all"): string {
  const [path, raw] = buildJourneyHistoryPath(query, role, search, scope, false).split("?");
  const params = new URLSearchParams(raw);
  params.delete("includePrevious"); params.set("auditFilter", auditFilter); params.set("page", String(page)); params.set("pageSize", String(pageSize));
  return `${path}/maps?${params}`;
}
export function normalizeJourneyAudit(value: unknown): JourneyAudit {
  const data = value as JourneyAudit;
  const validMetric = (metric: JourneyAudit["items"][number]["members"][number]["tml"]) => metric === null ||
    typeof metric === "object" && (metric.seconds === null || typeof metric.seconds === "number" && Number.isFinite(metric.seconds)) &&
    (metric.lifecycleStatus === null || typeof metric.lifecycleStatus === "string");
  if (!data || !["tml", "tr", "ti", "jl"].includes(data.indicator) || !["ponto", "mpd"].includes(data.mode) ||
    !["motorista", "ajudante"].includes(data.role) || ![data.page, data.pageSize, data.totalPages].every(n => Number.isInteger(n) && n > 0) ||
    !Number.isInteger(data.totalElements) || data.totalElements < 0 || data.page > data.totalPages ||
    !Number.isInteger(data.unfilteredTotal) || data.unfilteredTotal < data.totalElements ||
    !data.facets || typeof data.facets !== "object" || !Object.values(data.facets).every(options => Array.isArray(options) &&
      options.every(option => typeof option.value === "string" && typeof option.label === "string" && Number.isInteger(option.count) && option.count >= 0)) ||
    !Array.isArray(data.items) || data.items.length > data.pageSize || !data.summary ||
    !data.items.every(row => row && /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isInteger(row.map) && row.map > 0 &&
      Array.isArray(row.vehicles) && row.vehicles.every(v => typeof v === "string") && row.cells &&
      Object.values(row.cells).every(cell => typeof cell.value === "string" && typeof cell.label === "string") &&
      Number.isInteger(row.helpers) && row.helpers >= 0 && Array.isArray(row.driverNames) && row.driverNames.every(n => typeof n === "string") &&
      Array.isArray(row.departures) && Array.isArray(row.vehicleEntries) && row.deliveries &&
      (row.deliveries.count === null || Number.isInteger(row.deliveries.count) && row.deliveries.count >= 0) && row.contribution &&
      Array.isArray(row.members) && row.members.every(member => member && typeof member.included === "boolean" &&
        typeof member.conflictingSnapshots === "boolean" && [member.tml, member.tr, member.ti, member.jl].every(validMetric))))
    throw new Error("Resposta de auditoria da Jornada inválida.");
  return data;
}

async function request(path: string, signal?: AbortSignal, retry = true, body?: JourneyAuditTableQuery): Promise<unknown> {
  const session = readAuthSession();
  if (!session?.accessToken) throw new Error("Sessão autenticada não encontrada. Entre novamente.");
  let response: Response;
  try {
    response = await fetch(buildGatewayUrl(path), {
      signal,
      method: body ? "POST" : "GET",
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${session.accessToken}`,
        "X-Device-Id": getOrCreateDeviceId(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new Error("Não foi possível conectar ao serviço de Jornada.");
  }
  if (response.status === 401 && retry) {
    await authApi.refresh();
    return request(path, signal, false, body);
  }
  if (response.status === 401) {
    clearAuthSession();
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  if (!response.ok) {
    throw new Error(`Não foi possível consultar a Jornada (${response.status}).`);
  }
  return response.json();
}

export const journeyApi = {
  async filterOptions(query: JourneyQuery, signal?: AbortSignal) {
    const params = new URLSearchParams({from: query.from, to: query.to});
    if (query.indicator !== "tr") params.set("mode", query.mode);
    return await request(`/api/v1/journey/history/${query.indicator}/filter-options?${params}`, signal) as import("../model/types").JourneyFilterOptions;
  },
  async audit(query: JourneyQuery, role: AnalysisRole, search: string, scope: string,
    page: number, pageSize: number, signal?: AbortSignal, auditFilter = "all", table?: JourneyAuditTableQuery): Promise<JourneyAudit> {
    return normalizeJourneyAudit(await request(buildJourneyAuditPath(query, role, search, scope, page, pageSize, auditFilter), signal, true, table));
  },
  async get(query: JourneyQuery, signal?: AbortSignal): Promise<JourneyResponse> {
    return normalizeJourneyResponse<JourneyItem>(await request(buildJourneyPath(query), signal), query.indicator) as JourneyResponse;
  },
  async history(query: JourneyQuery, role: AnalysisRole, search: string, scope: string,
    signal?: AbortSignal, includePrevious = true): Promise<JourneyHistory> {
    return normalizeJourneyHistory(await request(buildJourneyHistoryPath(query, role, search, scope, includePrevious), signal));
  },
};
