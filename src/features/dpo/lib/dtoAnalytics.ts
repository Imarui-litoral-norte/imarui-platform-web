import type {
  DtoApplicationTimelinePoint,
  DtoAttentionPoint,
  DtoCollaboratorStat,
  DtoFieldRole,
  DtoFiltersState,
  DtoFormDetail,
  DtoFormResourceMap,
  DtoMetrics,
  DtoPortfolioMetrics,
  DtoQuestionStat,
  DtoRecord,
  DtoRecurringGap,
  DtoTimelinePoint,
  DtoTrend,
} from "@/features/dpo/model/dtoTypes";
import {
  formatDtoPercentage,
  formatDtoValue,
  formatPercentagePointDelta,
  normalizeSearchText,
  parseDtoDate,
} from "@/features/dpo/lib/dtoFormatters";

export const DEFAULT_DTO_FILTERS: DtoFiltersState = Object.freeze({
  period: "all",
  startDate: "",
  endDate: "",
  collaborator: "",
  manager: "",
  search: "",
  onlyNegative: false,
});

function hasRole(detail: Pick<DtoFormDetail, "columns">, role: DtoFieldRole) {
  return detail.columns.some(
    (column) => column.role === role && column.observation_status === "OBSERVED",
  );
}

function startOfDay(date: Date) {
  const result = new Date(date.getTime());
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date.getTime());
  result.setHours(23, 59, 59, 999);
  return result;
}

function resolveDateRange(filters: DtoFiltersState, now: Date) {
  const today = startOfDay(now);
  if (filters.period === "last30" || filters.period === "last90") {
    const start = new Date(today);
    start.setDate(start.getDate() - (filters.period === "last30" ? 29 : 89));
    return { start, end: endOfDay(today) };
  }
  if (filters.period === "currentYear") {
    return {
      start: new Date(today.getFullYear(), 0, 1),
      end: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
    };
  }
  if (filters.period === "custom") {
    const start = parseDtoDate(filters.startDate);
    const end = parseDtoDate(filters.endDate);
    return { start: start ? startOfDay(start) : null, end: end ? endOfDay(end) : null };
  }
  return { start: null, end: null };
}

function recordMatchesSearch(record: DtoRecord, search: string) {
  if (!search) return true;
  const values = [
    record.id,
    record.collaborator,
    record.manager,
    ...Object.entries(record.values).flatMap(([key, value]) => [key, formatDtoValue(value)]),
    ...record.answers.flatMap((answer) => [answer.label, formatDtoValue(answer.raw_value)]),
  ];
  return normalizeSearchText(values.join(" ")).includes(search);
}

export function filterDtoRecords(
  records: DtoRecord[],
  filters: DtoFiltersState,
  now = new Date(),
) {
  const collaborator = normalizeSearchText(filters.collaborator);
  const manager = normalizeSearchText(filters.manager);
  const search = normalizeSearchText(filters.search);
  const { start, end } = resolveDateRange(filters, now);
  return records.filter((record) => {
    if (collaborator && normalizeSearchText(record.collaborator) !== collaborator) return false;
    if (manager && normalizeSearchText(record.manager) !== manager) return false;
    if (start || end) {
      const date = parseDtoDate(record.historical_date || record.date);
      if (!date || (start && date < start) || (end && date > end)) return false;
    }
    if (
      filters.onlyNegative &&
      !record.answers.some((answer) => answer.status === "NEGATIVE")
    ) return false;
    return recordMatchesSearch(record, search);
  });
}

function uniqueLabels(values: Array<string | null>) {
  const labels = new Map<string, string>();
  values.forEach((value) => {
    const label = String(value ?? "").trim();
    const key = normalizeSearchText(label);
    if (key && !labels.has(key)) labels.set(key, label);
  });
  return [...labels.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function getDtoFilterOptions(detail: DtoFormDetail) {
  return {
    collaborators: uniqueLabels(detail.records.map((record) => record.collaborator)),
    managers: uniqueLabels(detail.records.map((record) => record.manager)),
    hasDateColumn: hasRole(detail, "DATE"),
    hasCollaboratorColumn: hasRole(detail, "COLLABORATOR"),
    hasManagerColumn: hasRole(detail, "APPLIER"),
  };
}

export function computeRecordMetrics(record: DtoRecord) {
  let positive = 0;
  let negative = 0;
  let ignored = 0;
  let blank = 0;
  let unmapped = 0;
  record.answers.forEach((answer) => {
    if (answer.status === "POSITIVE") positive += 1;
    else if (answer.status === "NEGATIVE") negative += 1;
    else if (answer.status === "IGNORED") ignored += 1;
    else if (answer.status === "BLANK") blank += 1;
    else if (answer.status === "UNMAPPED") unmapped += 1;
  });
  const answered = positive + negative;
  return {
    positive,
    negative,
    ignored,
    blank,
    unmapped,
    answered,
    adherence: answered > 0 ? (positive / answered) * 100 : null,
  };
}

export function computeDtoMetrics(
  records: DtoRecord[],
  columns: DtoFormDetail["columns"],
): DtoMetrics {
  let positive = 0;
  let negative = 0;
  let ignored = 0;
  let blank = 0;
  let unmapped = 0;
  let lastApplication: Date | null = null;
  const collaborators = new Set<string>();
  records.forEach((record) => {
    const metrics = computeRecordMetrics(record);
    positive += metrics.positive;
    negative += metrics.negative;
    ignored += metrics.ignored;
    blank += metrics.blank;
    unmapped += metrics.unmapped;
    const date = parseDtoDate(record.historical_date || record.date);
    if (date && (!lastApplication || date > lastApplication)) lastApplication = date;
    const collaborator = normalizeSearchText(record.collaborator);
    if (collaborator) collaborators.add(collaborator);
  });
  const answered = positive + negative;
  const hasDateColumn = columns.some((column) => column.role === "DATE");
  const hasCollaboratorColumn = columns.some((column) => column.role === "COLLABORATOR");
  return {
    applications: records.length,
    positive,
    negative,
    ignored,
    blank,
    unmapped,
    answered,
    adherence: answered > 0 ? (positive / answered) * 100 : null,
    collaborators: hasCollaboratorColumn ? collaborators.size : null,
    lastApplication,
    hasDateColumn,
    hasCollaboratorColumn,
  };
}

export function computeQuestionStats(
  records: DtoRecord[],
  columns: DtoFormDetail["columns"],
): DtoQuestionStat[] {
  const stats = new Map<string, DtoQuestionStat & { negativeRecordIds: Set<string> }>();
  columns
    .filter((column) => column.role === "EVALUATION" && column.observation_status === "OBSERVED")
    .forEach((column) => stats.set(column.key, {
      columnKey: column.key,
      label: column.label,
      positive: 0,
      negative: 0,
      ignored: 0,
      unmapped: 0,
      answered: 0,
      negativeApplications: 0,
      negativeRate: null,
      recurring: false,
      negativeRecordIds: new Set(),
    }));
  records.forEach((record) => record.answers.forEach((answer) => {
    const item = stats.get(answer.column_key);
    if (!item) return;
    if (answer.status === "POSITIVE") item.positive += 1;
    else if (answer.status === "NEGATIVE") {
      item.negative += 1;
      item.negativeRecordIds.add(record.id);
    } else if (answer.status === "IGNORED") item.ignored += 1;
    else if (answer.status === "UNMAPPED") item.unmapped += 1;
  }));
  return [...stats.values()].map(({ negativeRecordIds, ...item }) => {
    const answered = item.positive + item.negative;
    return {
      ...item,
      answered,
      negativeApplications: negativeRecordIds.size,
      negativeRate: answered ? (item.negative / answered) * 100 : null,
      recurring: negativeRecordIds.size >= 2,
    };
  }).sort((a, b) =>
    b.negative - a.negative ||
    (b.negativeRate ?? -1) - (a.negativeRate ?? -1) ||
    a.label.localeCompare(b.label, "pt-BR")
  );
}

export function computeRecurringGaps(records: DtoRecord[]): DtoRecurringGap[] {
  const byQuestion = new Map<string, { label: string; records: Map<string, Date | null> }>();
  records.forEach((record) => record.answers.forEach((answer) => {
    if (answer.status !== "NEGATIVE") return;
    const current = byQuestion.get(answer.column_key) || {
      label: answer.label,
      records: new Map<string, Date | null>(),
    };
    current.records.set(record.id, parseDtoDate(record.date));
    byQuestion.set(answer.column_key, current);
  }));
  return [...byQuestion.entries()].filter(([, value]) => value.records.size >= 2).map(
    ([columnKey, value]) => ({
      columnKey,
      questionLabel: value.label,
      applications: value.records.size,
      recordIds: [...value.records.keys()],
      lastOccurrence: [...value.records.values()].filter((date): date is Date => date !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null,
    }),
  ).sort((a, b) => b.applications - a.applications || a.questionLabel.localeCompare(b.questionLabel, "pt-BR"));
}

export function getCollaboratorRecords(records: DtoRecord[], name: string) {
  const key = normalizeSearchText(name);
  return records.filter((record) => normalizeSearchText(record.collaborator) === key);
}

export function computeCollaboratorStats(
  records: DtoRecord[],
  columns: DtoFormDetail["columns"],
): DtoCollaboratorStat[] | null {
  if (!columns.some((column) => column.role === "COLLABORATOR")) return null;
  const groups = new Map<string, { name: string; records: DtoRecord[] }>();
  records.forEach((record) => {
    const name = String(record.collaborator ?? "").trim();
    const key = normalizeSearchText(name);
    if (!key) return;
    const group = groups.get(key) || { name, records: [] };
    group.records.push(record);
    groups.set(key, group);
  });
  return [...groups.values()].map(({ name, records: collaboratorRecords }) => {
    const metrics = computeDtoMetrics(collaboratorRecords, columns);
    return {
      name,
      applications: collaboratorRecords.length,
      applicationsWithNegative: collaboratorRecords.filter(
        (record) => computeRecordMetrics(record).negative > 0,
      ).length,
      positive: metrics.positive,
      negative: metrics.negative,
      adherence: metrics.adherence,
      recurringGaps: computeRecurringGaps(collaboratorRecords),
      lastApplication: metrics.lastApplication,
    };
  }).sort((a, b) => b.negative - a.negative || a.name.localeCompare(b.name, "pt-BR"));
}

export function computeCollaboratorApplicationTimeline(
  records: DtoRecord[],
): DtoApplicationTimelinePoint[] {
  return records.map((record, index) => {
    const date = parseDtoDate(record.date);
    if (!date) return null;
    const metrics = computeRecordMetrics(record);
    return {
      key: `${date.toISOString()}-${record.id}-${index}`,
      label: new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" }).format(date),
      date,
      positive: metrics.positive,
      negative: metrics.negative,
      adherence: metrics.adherence,
    };
  }).filter((item): item is DtoApplicationTimelinePoint => item !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

type Granularity = "day" | "week" | "month";
function timelineGranularity(dates: Date[]): Granularity {
  if (dates.length < 2) return "day";
  const sorted = dates.map((date) => date.getTime()).sort((a, b) => a - b);
  const days = (sorted.at(-1)! - sorted[0]) / 86_400_000;
  return days <= 45 ? "day" : days <= 240 ? "week" : "month";
}

function timelineBucket(date: Date, granularity: Granularity) {
  let bucket = startOfDay(date);
  if (granularity === "week") bucket.setDate(bucket.getDate() - ((bucket.getDay() + 6) % 7));
  if (granularity === "month") bucket = new Date(bucket.getFullYear(), bucket.getMonth(), 1);
  const key = `${bucket.getFullYear()}-${String(bucket.getMonth() + 1).padStart(2, "0")}-${String(bucket.getDate()).padStart(2, "0")}`;
  const label = granularity === "month"
    ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(bucket)
    : granularity === "week"
      ? `Sem. ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(bucket)}`
      : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(bucket);
  return { key, label, order: bucket.getTime() };
}

export function computeTimeline(records: DtoRecord[]): DtoTimelinePoint[] {
  const dated = records.map((record) => ({ record, date: parseDtoDate(record.historical_date || record.date) }))
    .filter((item): item is { record: DtoRecord; date: Date } => item.date !== null);
  if (!dated.length) return [];
  const granularity = timelineGranularity(dated.map((item) => item.date));
  const buckets = new Map<string, DtoTimelinePoint & { order: number }>();
  dated.forEach(({ record, date }) => {
    const bucket = timelineBucket(date, granularity);
    const current = buckets.get(bucket.key) || {
      key: bucket.key, label: bucket.label, order: bucket.order,
      applications: 0, positive: 0, negative: 0, adherence: null,
    };
    const metrics = computeRecordMetrics(record);
    current.applications += 1;
    current.positive += metrics.positive;
    current.negative += metrics.negative;
    buckets.set(bucket.key, current);
  });
  return [...buckets.values()].sort((a, b) => a.order - b.order).map(({ order: _order, ...item }) => {
    const answered = item.positive + item.negative;
    return { ...item, adherence: answered ? (item.positive / answered) * 100 : null };
  });
}

export function computeTrend(timeline: DtoTimelinePoint[]): DtoTrend | null {
  const comparable = timeline.filter((item) => item.adherence !== null);
  if (comparable.length < 2) return null;
  const previous = comparable.at(-2)!;
  const current = comparable.at(-1)!;
  const delta = current.adherence! - previous.adherence!;
  return {
    direction: delta > 0 ? "improving" : delta < 0 ? "worsening" : "stable",
    delta,
    previousLabel: previous.label,
    currentLabel: current.label,
  };
}

export function computeAttentionPoints(
  detail: DtoFormDetail,
  records: DtoRecord[],
): DtoAttentionPoint[] {
  if (!records.length) return [];
  const points: DtoAttentionPoint[] = [];
  const topQuestion = computeQuestionStats(records, detail.columns).find((item) => item.negative > 0);
  const trend = computeTrend(computeTimeline(records));
  const collaborator = computeCollaboratorStats(records, detail.columns)?.find((item) => item.recurringGaps.length > 0);
  const metrics = computeDtoMetrics(records, detail.columns);
  if (topQuestion) points.push({
    id: `question-${topQuestion.columnKey}`,
    title: "Pergunta com mais desvios",
    description: `${topQuestion.label}: ${topQuestion.negative} resultado(s) negativo(s) em ${topQuestion.answered} respostas válidas (${formatDtoPercentage(topQuestion.negativeRate)}).`,
    tone: "danger",
  });
  if (trend?.direction === "worsening") points.push({
    id: "adherence-trend",
    title: "Aderência recuou no período mais recente",
    description: `De ${trend.previousLabel} para ${trend.currentLabel}, a aderência variou ${formatPercentagePointDelta(trend.delta)}.`,
    tone: "attention",
  });
  if (collaborator) points.push({
    id: `recurring-${normalizeSearchText(collaborator.name)}`,
    title: "Mesmo gap reapareceu",
    description: `${collaborator.name} possui ${collaborator.recurringGaps.length} pergunta(s) com resultado negativo em pelo menos duas aplicações distintas.`,
    tone: "attention",
  });
  if (metrics.unmapped > 0) points.push({
    id: "unmapped-values",
    title: "Parametrização pendente",
    description: `${metrics.unmapped} resposta(s) não parametrizada(s) foram excluídas dos indicadores.`,
    tone: "attention",
  });
  return points.slice(0, 4);
}

export function computePortfolioMetrics(
  formsCount: number,
  resources: DtoFormResourceMap,
): DtoPortfolioMetrics {
  const values = Object.values(resources);
  const details = values.map((resource) => resource.data).filter((detail): detail is DtoFormDetail => detail !== null);
  const failedForms = values.filter((resource) => resource.status === "error" && !resource.data).length;
  const pendingForms = values.filter((resource) => ["idle", "loading"].includes(resource.status) && !resource.data).length;
  if (!details.length && formsCount > 0) return {
    forms: formsCount, loadedForms: 0, failedForms, pendingForms,
    applications: null, positive: null, negative: null, adherence: null,
    collaborators: null, partial: true,
  };
  let applications = 0;
  let positive = 0;
  let negative = 0;
  let hasCollaborators = false;
  const collaborators = new Set<string>();
  details.forEach((detail) => {
    const metrics = computeDtoMetrics(detail.records, detail.columns);
    applications += metrics.applications;
    positive += metrics.positive;
    negative += metrics.negative;
    if (metrics.hasCollaboratorColumn) {
      hasCollaborators = true;
      detail.records.forEach((record) => {
        const name = normalizeSearchText(record.collaborator);
        if (name) collaborators.add(name);
      });
    }
  });
  const answered = positive + negative;
  return {
    forms: formsCount,
    loadedForms: details.length,
    failedForms,
    pendingForms,
    applications,
    positive,
    negative,
    adherence: answered ? (positive / answered) * 100 : null,
    collaborators: hasCollaborators ? collaborators.size : null,
    partial: details.length < formsCount || failedForms > 0 || pendingForms > 0,
  };
}

export function getPortfolioOffenders(resources: DtoFormResourceMap) {
  return Object.values(resources).map((resource) => {
    if (!resource.data) return null;
    const metrics = computeDtoMetrics(resource.data.records, resource.data.columns);
    return { id: resource.data.form.id, name: resource.data.form.name, negative: metrics.negative, adherence: metrics.adherence };
  }).filter((item): item is { id: string; name: string; negative: number; adherence: number | null } => Boolean(item && item.negative > 0))
    .sort((a, b) => b.negative - a.negative || (a.adherence ?? Infinity) - (b.adherence ?? Infinity));
}
