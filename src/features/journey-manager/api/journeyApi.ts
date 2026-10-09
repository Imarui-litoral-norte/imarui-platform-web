import { authApi, clearAuthSession, getOrCreateDeviceId, readAuthSession } from "@/features/auth";
import { buildGatewayUrl } from "@/shared/network/gatewayUrl";
import type { AnalysisRole, Indicator, JourneyHistory, JourneyItem, JourneyQuery, JourneyResponse, PeriodResponse } from "../model/types";

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
    !payload.collaborators.every(c => typeof c.employeeCode === "number" && typeof c.employeeName === "string" && validCounts(c.counts)))
    throw new Error("Resposta analítica inválida.");
  return payload;
}

async function request(path: string, signal?: AbortSignal, retry = true): Promise<unknown> {
  const session = readAuthSession();
  if (!session?.accessToken) throw new Error("Sessão autenticada não encontrada. Entre novamente.");
  let response: Response;
  try {
    response = await fetch(buildGatewayUrl(path), {
      signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
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
    return request(path, signal, false);
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
  async get(query: JourneyQuery, signal?: AbortSignal): Promise<JourneyResponse> {
    return normalizeJourneyResponse<JourneyItem>(await request(buildJourneyPath(query), signal), query.indicator) as JourneyResponse;
  },
  async history(query: JourneyQuery, role: AnalysisRole, search: string, scope: string,
    signal?: AbortSignal, includePrevious = true): Promise<JourneyHistory> {
    return normalizeJourneyHistory(await request(buildJourneyHistoryPath(query, role, search, scope, includePrevious), signal));
  },
};
