import type { Checklist, Indicator, IndicatorResult, JlItem, JourneyItem, TiItem, TmlItem, TrItem } from "../model/types";

export type LiveScope = "all" | "d0" | "earlier";

const STATUS_LABELS: Record<string, string> = {
  EM_ANDAMENTO: "Em andamento",
  FINALIZADO: "Finalizado",
  CONCLUIDO: "Concluído",
  ATINGIDO: "Dentro da meta",
  DENTRO_DA_META: "Dentro da meta",
  ESTOURADO: "Meta excedida",
  INCOMPLETO: "Incompleto",
  SEM_DADOS: "Sem dados",
  SEM_PONTO_FINAL: "Sem ponto final",
  SEM_PFIS: "Sem fechamento físico",
  SEM_PFIN: "Sem fechamento financeiro",
  SEM_RETORNO: "Sem retorno",
};

export function statusLabel(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  return STATUS_LABELS[value] ?? value;
}

export function statusTone(value: string | null | undefined): "neutral" | "live" | "positive" | "warning" {
  if (value === "EM_ANDAMENTO") return "live";
  if (value === "ATINGIDO" || value === "DENTRO_DA_META" || value === "FINALIZADO") return "positive";
  if (["ESTOURADO", "INCOMPLETO", "SEM_DADOS", "SEM_PONTO_FINAL", "SEM_PFIS",
    "SEM_PFIN", "SEM_RETORNO"].includes(value ?? "")) return "warning";
  return "neutral";
}

export function primaryResult(item: JourneyItem, indicator: Indicator): IndicatorResult {
  switch (indicator) {
    case "tml": return (item as TmlItem).tml;
    case "tr": return (item as TrItem).tr;
    case "ti": return (item as TiItem).ti;
    case "jl": return (item as JlItem).jl;
  }
}

export function hasLiveRows(items: readonly JourneyItem[], indicator: Indicator): boolean {
  return items.some((item) => {
    if (primaryResult(item, indicator)?.lifecycleStatus === "EM_ANDAMENTO") return true;
    if (indicator !== "ti") return false;
    const ti = item as TiItem;
    return ti.physicalClose?.lifecycleStatus === "EM_ANDAMENTO" ||
      ti.financialClose?.lifecycleStatus === "EM_ANDAMENTO";
  });
}

export function shouldPollJourney(items: readonly JourneyItem[], indicator: Indicator,
                                  visibility: DocumentVisibilityState): boolean {
  return visibility === "visible" && hasLiveRows(items, indicator);
}

export interface MapGroup<T extends JourneyItem> {
  key: string;
  date: string;
  map: number | null;
  mapOrigin: string | null;
  items: T[];
}

export function groupByMap<T extends JourneyItem>(items: readonly T[]): MapGroup<T>[] {
  const groups = new Map<string, MapGroup<T>>();
  for (const [index, item] of items.entries()) {
    const { date, map, mapOrigin } = item.context;
    const key = map === null ? `${date}:unknown:${index}` : `${date}:${map}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, date, map, mapOrigin, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date) ||
    (a.map ?? 0) - (b.map ?? 0));
}

/** TR belongs to the map; employee rows only supply its associated crew. */
export function mapTrFact(group: MapGroup<TrItem>): TrItem | undefined {
  return group.items[0];
}

/** Only rows explicitly marked LIVE can enter a D0 or earlier-pending view. */
export function filterMapGroups<T extends JourneyItem>(groups: readonly MapGroup<T>[],
                                                       scope: LiveScope, today: string): MapGroup<T>[] {
  if (scope === "all") return [...groups];
  return groups.filter((group) => group.mapOrigin === "LIVE" &&
    (scope === "d0" ? group.date === today : group.date < today));
}

function searchable(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function searchMapGroups<T extends JourneyItem>(groups: readonly MapGroup<T>[], text: string): MapGroup<T>[] {
  const term = searchable(text.trim());
  if (!term) return [...groups];
  return groups.filter((group) => searchable([
    group.map, group.date,
    ...group.items.flatMap(({ context }) => [context.vehicle, context.plate, context.fleet,
      context.employeeName, context.employeeCode, context.mapDriverCode]),
  ].filter((value) => value != null).join(" ")).includes(term));
}

export function paginateMapGroups<T extends JourneyItem>(groups: readonly MapGroup<T>[],
                                                          page: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(groups.length / size));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * size;
  return { groups: groups.slice(start, start + size), page: currentPage, totalPages,
    start: groups.length ? start + 1 : 0, end: Math.min(groups.length, start + size) };
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "—";
  const sign = seconds < 0 ? "−" : "";
  const whole = Math.floor(Math.abs(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remaining = whole % 60;
  return `${sign}${hours}h ${String(minutes).padStart(2, "0")}m ${String(remaining).padStart(2, "0")}s`;
}

export function liveSeconds(result: IndicatorResult, snapshotAt: string | null,
                            nowMs: number): number | null {
  if (result.seconds == null) return null;
  if (result.lifecycleStatus !== "EM_ANDAMENTO" || !snapshotAt) return result.seconds;
  const snapshotMs = new Date(snapshotAt).getTime();
  if (!Number.isFinite(snapshotMs)) return result.seconds;
  return result.seconds + Math.max(0, Math.floor((nowMs - snapshotMs) / 1000));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short", timeStyle: "short",
  }).format(date);
}

export function outcomeLabel(value: boolean | null): string {
  return value === null ? "Sem resultado" : value ? "Atingido" : "Não atingido";
}

export function checklistPending(value: Checklist | null): boolean {
  return value === null || value.count === null || value.count === 0;
}
