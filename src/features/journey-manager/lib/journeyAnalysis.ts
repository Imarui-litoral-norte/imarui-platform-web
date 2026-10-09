import type { JourneyCounts, JourneyDay, JourneyHistory } from "../model/types";

// Calendar-only arithmetic uses UTC to avoid DST changing a day's identity.
export const calendarDate = (value: string) => new Date(`${value}T12:00:00Z`);
export const isoDate = (value: Date) => value.toISOString().slice(0, 10);
export function addDays(value: string, amount: number) {
  const date = calendarDate(value); date.setUTCDate(date.getUTCDate() + amount); return isoDate(date);
}
export function weekStart(value: string) {
  return addDays(value, -((calendarDate(value).getUTCDay() + 6) % 7));
}
export function dateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}
export function monthEnd(value: string) {
  const date = calendarDate(`${value.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + 1, 0); return isoDate(date);
}
export function months(from: string, to: string) {
  const result: string[] = [];
  const date = calendarDate(`${from.slice(0, 7)}-01`);
  while (isoDate(date) <= to) { result.push(isoDate(date).slice(0, 7)); date.setUTCMonth(date.getUTCMonth() + 1); }
  return result;
}
export const shortDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
export const monthLabel = (value: string) => calendarDate(`${value.slice(0, 7)}-01`).toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
export const percent = (value: number | null) => value === null ? "—" : `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
export const emptyCounts = (): JourneyCounts => ({ total: 0, attained: 0, notAttained: 0, pending: 0, unavailable: 0,
  evaluated: 0, adherence: null, distinctMaps: 0, expurged: 0, anomalies: 0 });

/** Roll up backend counts, never average percentages or recompute an individual KPI. */
export function sumCounts(rows: JourneyCounts[]): JourneyCounts {
  const result = emptyCounts();
  for (const row of rows) for (const key of ["total", "attained", "notAttained", "pending", "unavailable", "evaluated", "distinctMaps", "expurged", "anomalies"] as const) result[key] += row[key];
  result.adherence = result.evaluated ? result.attained * 100 / result.evaluated : null;
  return result;
}
export function countsBetween(days: JourneyDay[], from: string, to: string) {
  return sumCounts(days.filter(day => day.date >= from && day.date <= to).map(day => day.counts));
}
export interface AnalysisPoint {
  key: string; label: string; from: string; to: string; group: string; counts: JourneyCounts;
  accumulated: number | null; selected: boolean;
}

export function weeklyPoints(history: JourneyHistory): { granular: boolean; points: AnalysisPoint[] } {
  const first = weekStart(history.from), last = weekStart(history.to);
  const weeks: string[] = [];
  for (let start = first; start <= last; start = addDays(start, 7)) weeks.push(start);
  const granular = weeks.length <= 3;
  const index = new Map(history.daily.map(day => [day.date, day.counts]));
  const points: AnalysisPoint[] = [];
  if (granular) {
    for (const week of weeks) {
      let cumulative = emptyCounts();
      for (const date of dateRange(week, addDays(week, 5))) {
        const counts = index.get(date) ?? emptyCounts();
        cumulative = sumCounts([cumulative, counts]);
        // No-data/future points stay gaps; cumulative isn't fabricated across an empty day.
        points.push({ key: date, label: shortDate(date), from: date, to: date, group: week,
          counts, accumulated: counts.total ? cumulative.adherence : null,
          selected: date >= history.from && date <= history.to });
      }
    }
  } else {
    // Calendar month intersections avoid assigning an entire boundary week to two months.
    for (const month of months(history.from, history.to)) {
      const from = month + "-01", to = monthEnd(from);
      let cumulative = emptyCounts();
      for (let week = weekStart(from); week <= to; week = addDays(week, 7)) {
        const start = week < from ? from : week, end = addDays(week, 5) > to ? to : addDays(week, 5);
        if (start > end) continue;
        const counts = sumCounts(dateRange(start, end).map(date => index.get(date) ?? emptyCounts()));
        cumulative = sumCounts([cumulative, counts]);
        points.push({ key: `${month}:${week}`, label: `${shortDate(start)}–${shortDate(end)}`, from: start, to: end,
          group: month, counts, accumulated: counts.total ? cumulative.adherence : null,
          selected: start <= history.to && end >= history.from });
      }
    }
  }
  return { granular, points };
}

export function monthlyPoints(history: JourneyHistory): { granular: boolean; points: AnalysisPoint[] } {
  const periodMonths = months(history.from, history.to);
  const granular = periodMonths.length === 1;
  if (granular) {
    const month = periodMonths[0], from = month + "-01";
    const index = new Map(history.daily.map(day => [day.date, day.counts]));
    let cumulative = emptyCounts();
    return { granular, points: dateRange(from, monthEnd(from)).map(date => {
      const counts = index.get(date) ?? emptyCounts(); cumulative = sumCounts([cumulative, counts]);
      return { key: date, label: shortDate(date), from: date, to: date, group: month, counts,
        accumulated: counts.total ? cumulative.adherence : null, selected: date >= history.from && date <= history.to };
    }) };
  }
  let cumulative = emptyCounts();
  return { granular, points: periodMonths.map(month => {
    const from = month + "-01", to = monthEnd(from), counts = countsBetween(history.daily, from, to);
    cumulative = sumCounts([cumulative, counts]);
    return { key: month, label: monthLabel(month), from, to, group: "period", counts,
      accumulated: counts.total ? cumulative.adherence : null, selected: true };
  }) };
}

export function annualComparison(history: JourneyHistory) {
  return months(history.from, history.to).map(month => {
    const from = month + "-01", end = monthEnd(from), to = end < history.asOf ? end : history.asOf;
    const previousMonth = `${Number(month.slice(0, 4)) - 1}-${month.slice(5, 7)}`;
    const priorEnd = monthEnd(previousMonth + "-01");
    const aligned = `${previousMonth}-${to.slice(8, 10)}`;
    const previousTo = aligned > priorEnd ? priorEnd : aligned;
    return { month, label: monthLabel(month), from, to,
      current: countsBetween(history.daily, from, to),
      previous: to < from ? emptyCounts() : countsBetween(history.previousYearDaily, previousMonth + "-01", previousTo),
      previousFrom: previousMonth + "-01", previousTo };
  });
}
