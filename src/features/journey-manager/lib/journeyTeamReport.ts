import type { ExpurgeFilter, Indicator, JourneyTeamObservation } from "../model/types";
import { sumCounts } from "./journeyAnalysis";

export interface TeamReportFilters {
  excluded: number[];
  fleets: string[];
  expurge: ExpurgeFilter;
  view: "all" | "not_attained" | "journey_exceeded";
}
export const initialTeamReportFilters: TeamReportFilters = { excluded: [], fleets: [], expurge: "all", view: "all" };

export type TeamReportSortColumn = "name" | "dates" | "attained" | "adherence" | "average" | "journeyExceeded";
export interface TeamReportSort {
  column: TeamReportSortColumn;
  direction: "asc" | "desc";
}
export const initialTeamReportSort: TeamReportSort = { column: "name", direction: "asc" };
type TeamReportRow = ReturnType<typeof teamReportRows>[number];

/** Compare raw values; missing results stay last in either direction. */
export function sortTeamReportRows(rows: TeamReportRow[], sort: TeamReportSort) {
  const value = (row: TeamReportRow): string | number | null => {
    switch (sort.column) {
      case "name": return row.employeeName;
      case "dates": return row.dates[0] ?? null;
      case "attained": return row.counts.evaluated ? row.counts.attained : null;
      case "adherence": return row.counts.adherence;
      case "average": return row.averageSeconds;
      case "journeyExceeded": return row.journeyKnown ? row.journeyExceeded : null;
    }
  };
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = value(a), right = value(b);
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    let comparison = typeof left === "number" && typeof right === "number" ? left - right :
      typeof left === "string" && typeof right === "string" ? left.localeCompare(right, "pt-BR") : 0;
    if (comparison === 0 && left !== null && right !== null && sort.column === "attained") {
      comparison = a.counts.evaluated - b.counts.evaluated;
    }
    return comparison * direction || a.employeeName.localeCompare(b.employeeName, "pt-BR") || a.employeeCode - b.employeeCode;
  });
}

/** Filter individual observations before rolling up, including people who changed fleet. */
export function teamReportRows(observations: JourneyTeamObservation[], filters: TeamReportFilters) {
  const grouped = new Map<number, JourneyTeamObservation[]>();
  for (const row of observations) {
    if (filters.excluded.includes(row.employeeCode) ||
        (filters.fleets.length > 0 && !filters.fleets.includes(row.fleet?.trim() ?? "")) ||
        (filters.expurge === "expurged" && row.expurgePresent !== true) ||
        (filters.expurge === "not_expurged" && row.expurgePresent !== false)) continue;
    const rows = grouped.get(row.employeeCode) ?? [];
    rows.push(row); grouped.set(row.employeeCode, rows);
  }
  return [...grouped.entries()].map(([employeeCode, rows]) => {
    const counts = sumCounts(rows.map(row => row.counts));
    const times = rows.flatMap(row => row.seconds === null ? [] : [row.seconds]);
    const journeyKnown = rows.filter(row => row.journeyExceeded !== null).length;
    return { employeeCode, employeeName: rows.at(-1)!.employeeName, counts,
      dates: [...new Set(rows.flatMap(row => row.departureDate === null ? [] : [row.departureDate]))].sort(),
      averageSeconds: times.length ? times.reduce((total, seconds) => total + seconds, 0) / times.length : null,
      timeSamples: times.length, journeyExceeded: rows.filter(row => row.journeyExceeded === true).length,
      journeyKnown, journeyUnknown: rows.length - journeyKnown };
  }).filter(row => filters.view === "all" || (filters.view === "not_attained" ?
    row.counts.notAttained > 0 : row.journeyExceeded > 0))
    .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "pt-BR"));
}

export function formatTeamAverage(seconds: number | null, indicator: Indicator) {
  if (seconds === null) return "—";
  const total = Math.round(seconds);
  const first = indicator === "tml" || indicator === "ti" ? Math.floor(total / 60) : Math.floor(total / 3600);
  const second = indicator === "tml" || indicator === "ti" ? total % 60 : Math.floor(total / 60) % 60;
  return `${String(first).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}
