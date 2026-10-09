import type { Indicator, IndicatorResult, JlItem, JourneyItem, TiItem, TmlItem, TrItem } from "../model/types";
import { liveSeconds, primaryResult, type MapGroup } from "./journeyPresentation";

export type SegmentKind = "load" | "maintenance" | "physical" | "financial" | "tml" | "tr" | "ti";

export interface TimelineSegment {
  kind: SegmentKind;
  label: string;
  left: number;
  width: number;
}

export interface TimelineView {
  seconds: number | null;
  progress: number;
  started: boolean;
  closed: boolean;
  exceeded: boolean;
  finalTone: "positive" | "negative" | "neutral";
  segments: TimelineSegment[];
}

const CLOSED_STATUSES = new Set(["FINALIZADO", "CONCLUIDO"]);
const POSITIVE_STATUSES = new Set(["ATINGIDO", "DENTRO_DA_META"]);
const NEGATIVE_STATUSES = new Set(["ESTOURADO", "FORA_DA_META"]);

function timestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function segment(kind: SegmentKind, label: string, start: string | null | undefined,
                 end: string | null | undefined, windowStart: number | null,
                 windowEnd: number | null): TimelineSegment | null {
  const from = timestamp(start);
  const to = timestamp(end);
  if (windowStart === null || windowEnd === null || windowEnd <= windowStart ||
      from === null || to === null || to <= from) return null;
  const clippedStart = Math.max(windowStart, from);
  const clippedEnd = Math.min(windowEnd, to);
  if (clippedEnd <= clippedStart) return null;
  const span = windowEnd - windowStart;
  return { kind, label, left: 100 * (clippedStart - windowStart) / span,
    width: 100 * (clippedEnd - clippedStart) / span };
}

function windowEnd(start: number | null, end: string | null | undefined,
                   seconds: number | null, target: number | null, closed: boolean): number | null {
  const explicit = timestamp(end);
  if (explicit !== null) return explicit;
  const horizon = closed ? seconds : Math.max(seconds ?? 0, target ?? 0);
  return start !== null && horizon !== null && horizon > 0 ? start + horizon * 1000 : null;
}

function finalTone(result: IndicatorResult): TimelineView["finalTone"] {
  if (POSITIVE_STATUSES.has(result.targetStatus ?? "") || result.achieved === true) return "positive";
  if (NEGATIVE_STATUSES.has(result.targetStatus ?? "") || result.achieved === false) return "negative";
  return "neutral";
}

export function mapDriver<T extends JourneyItem>(group: MapGroup<T>): T | undefined {
  return group.items.find((item) => item.context.role?.toLowerCase().includes("motorista")) ??
    group.items.find((item) => item.context.mapDriverCode !== null &&
      item.context.employeeCode === item.context.mapDriverCode);
}

export function mapHelperCount<T extends JourneyItem>(group: MapGroup<T>): number {
  return group.items.filter((item) => item.context.role?.toLowerCase().includes("ajudante")).length;
}

export function mapRepresentative(group: MapGroup<JourneyItem>, indicator: Indicator): JourneyItem | undefined {
  if (indicator === "tr") return group.items[0];
  return mapDriver(group);
}

export function timelineView(item: JourneyItem | undefined, indicator: Indicator, now: number): TimelineView {
  if (!item) return { seconds: null, progress: 0, started: false, closed: false,
    exceeded: false, finalTone: "neutral", segments: [] };
  const result = primaryResult(item, indicator);
  const seconds = liveSeconds(result, item.snapshotAt, now);
  const closed = CLOSED_STATUSES.has(result.lifecycleStatus ?? "");
  const target = result.targetSeconds ?? (indicator === "tml" ? 1800 : null);
  const exceeded = seconds !== null && target !== null && target > 0 && seconds > target;
  const progress = closed && seconds !== null ? 100 :
    seconds !== null && target !== null && target > 0 ? Math.min(100, Math.max(2, 100 * seconds / target)) :
      seconds !== null ? 2 : 0;
  let start: number | null = null;
  let end: number | null = null;
  const segments: TimelineSegment[] = [];
  const add = (entry: TimelineSegment | null) => { if (entry) segments.push(entry); };

  if (indicator === "tml") {
    const row = item as TmlItem;
    start = timestamp(row.startedAt ?? row.entryAt);
    end = windowEnd(start, row.endedAt ?? row.mapDepartureAt, seconds, target, closed);
    add(segment("load", "Checklist de carga", row.loadChecklist?.effectiveStartedAt,
      row.loadChecklist?.effectiveEndedAt, start, end));
    add(segment("maintenance", "Checklist de manutenção", row.maintenanceChecklist?.effectiveStartedAt,
      row.maintenanceChecklist?.effectiveEndedAt, start, end));
  } else if (indicator === "tr") {
    const row = item as TrItem;
    start = timestamp(row.mapDepartureAt);
    end = windowEnd(start, row.mapReturnAt, seconds, target, closed);
    // The current TR response has no delivery or lunch intervals.
  } else if (indicator === "ti") {
    const row = item as TiItem;
    start = timestamp(row.vehicleEntryAt);
    end = windowEnd(start, row.pointExitAt ?? row.endedAt, seconds, target, closed);
    add(segment("physical", "PFIS", row.vehicleEntryAt, row.physicalCloseAt, start, end));
    add(segment("financial", "PFIN", row.physicalCloseAt, row.financialCloseAt, start, end));
  } else {
    const row = item as JlItem;
    start = timestamp(row.startedAt ?? row.pointEntryAt);
    end = windowEnd(start, row.endedAt ?? row.pointExitAt ?? row.financialCloseAt, seconds, target, closed);
    add(segment("tml", "TML", row.startedAt ?? row.pointEntryAt, row.mapDepartureAt, start, end));
    add(segment("tr", "TR", row.mapDepartureAt, row.mapReturnAt, start, end));
    add(segment("ti", "TI", row.mapReturnAt,
      row.mode === "mpd" ? row.financialCloseAt : row.pointExitAt, start, end));
  }

  return { seconds, progress, started: seconds !== null || start !== null, closed, exceeded,
    finalTone: seconds === null ? "neutral" : finalTone(result), segments };
}

export function formatClockDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "--:--";
  const whole = Math.floor(Math.abs(seconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  return `${seconds < 0 ? "−" : ""}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
