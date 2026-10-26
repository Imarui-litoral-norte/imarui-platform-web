import { normalizeSearchText, parseDtoDate } from "@/features/dpo/lib/dtoFormatters";
import type {
  DtoFormDetail,
  DtoTrackingContext,
  DtoTrackedSubject,
  DtoTrackingMode,
  DtoTrackingMonthCell,
  DtoTrackingMonthStatus,
  DtoTrackingMonthSummary,
  DtoTrackingStatus,
  DtoTrackingSummary,
  DtoTrackingYearRow,
  DtoTrackingYearSummary,
} from "@/features/dpo/model/dtoTypes";

const DAY_IN_MS = 86_400_000;

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value: Date, days: number): Date {
  const result = new Date(value.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

export function extractTrackingNames(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) return value.flatMap(extractTrackingNames);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["name", "nome", "label", "value", "valor"]) {
      if (key in record) return extractTrackingNames(record[key]);
    }
    return Object.values(record).flatMap(extractTrackingNames);
  }

  const text = String(value).trim();
  if (!text) return [];
  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    try {
      return extractTrackingNames(JSON.parse(text));
    } catch {
      // Mantém o valor textual quando o conteúdo apenas se parece com JSON.
    }
  }
  return text
    .split(/\r?\n|;|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueNames(values: string[]): Map<string, string> {
  const names = new Map<string, string>();
  values.forEach((value) => {
    const key = normalizeSearchText(value);
    if (key && !names.has(key)) names.set(key, value.trim());
  });
  return names;
}

function statusRank(status: DtoTrackingStatus): number {
  return { never: 0, overdue: 1, dueSoon: 2, current: 3 }[status];
}

export function computeDtoTracking(
  detail: DtoFormDetail,
  context: DtoTrackingContext | null = null,
  now: Date = new Date(),
): DtoTrackingSummary {
  const tracking = detail.configuration.tracking;
  const mode: DtoTrackingMode = tracking?.mode || "COLLABORATOR";
  const environmentSource = tracking?.environment_source || "FIELD";
  const collaboratorSource = tracking?.collaborator_source || "CPF";
  const isFormEnvironment =
    mode === "ENVIRONMENT" && environmentSource === "FORM";
  const configured = Boolean(
    tracking?.realization_date_field_key &&
      tracking.interval_days &&
      (mode !== "COLLABORATOR" || (
        tracking.collaborator_source &&
        tracking.applicable_functions?.length
      )),
  ) && (isFormEnvironment
    ? tracking.manual_collaborators?.length === 1 && !tracking.roster_field_key
    : Boolean(tracking?.roster_field_key));
  const empty: DtoTrackingSummary = {
    configured,
    mode,
    environmentSource,
    collaboratorSource,
    subjects: [],
    excludedSubjects: tracking?.excluded_collaborators || [],
    total: 0,
    current: 0,
    dueSoon: 0,
    overdue: 0,
    never: 0,
    newEmployees: 0,
    realizationAdherence: null,
    lastRealization: null,
  };
  if (!configured) return empty;

  const rosterFieldKey = tracking.roster_field_key as string | null;
  const realizationDateFieldKey = tracking.realization_date_field_key as string;
  const intervalDays = tracking.interval_days as number;
  const isCollaborator = mode === "COLLABORATOR";
  const employeeByKey = new Map(
    (context?.employees || []).map((employee) => [employee.key, employee]),
  );
  const observed = isCollaborator
    ? new Map(
        (context?.employees || []).map((employee) => [employee.key, employee.name]),
      )
    : isFormEnvironment
      ? new Map<string, string>()
      : uniqueNames(
          detail.records.flatMap((record) =>
            extractTrackingNames(record.values[rosterFieldKey as string]),
          ),
        );
  const observedKeys = new Set(observed.keys());
  const manual = isCollaborator
    ? new Map<string, string>()
    : uniqueNames(tracking.manual_collaborators);
  manual.forEach((name, key) => {
    if (!observed.has(key)) observed.set(key, name);
  });
  const manualKeys = new Set(manual.keys());
  const excluded = new Set(
    isCollaborator
      ? tracking.excluded_employee_keys || []
      : tracking.excluded_collaborators.map((name) => normalizeSearchText(name)),
  );
  const today = startOfDay(now);
  const dueSoonDays = Math.min(14, Math.max(3, Math.round(intervalDays * 0.2)));

  const subjects: DtoTrackedSubject[] = [];
  observed.forEach((name, key) => {
    if (excluded.has(key)) return;
    const matchingRecords = isCollaborator
      ? detail.records.filter((record) =>
          context?.record_employee_keys[record.id]?.includes(key),
        )
      : isFormEnvironment
        ? detail.records
        : detail.records.filter((record) =>
            extractTrackingNames(record.values[rosterFieldKey as string]).some(
              (candidate) => normalizeSearchText(candidate) === key,
            ),
          );
    const dates = matchingRecords
      .map((record) => parseDtoDate(record.values[realizationDateFieldKey]))
      .filter((date): date is Date => date !== null)
      .sort((left, right) => right.getTime() - left.getTime());
    const lastRealization = dates[0] || null;
    const employee = isCollaborator ? employeeByKey.get(key) : undefined;
    const admissionDate = employee?.admission_date
      ? parseDtoDate(employee.admission_date)
      : null;
    const admissionDay = admissionDate ? startOfDay(admissionDate) : null;
    const daysSinceAdmission = admissionDay
      ? Math.floor((today.getTime() - admissionDay.getTime()) / DAY_IN_MS)
      : null;
    const isNew = Boolean(
      isCollaborator &&
        daysSinceAdmission !== null &&
        daysSinceAdmission >= 0 &&
        tracking.new_employee_window_days &&
        daysSinceAdmission <= tracking.new_employee_window_days,
    );
    const firstRealizationPending = Boolean(
      isCollaborator &&
        !lastRealization &&
        admissionDay &&
        tracking.new_employee_first_due_days,
    );
    const nextDueDate = lastRealization
      ? addDays(startOfDay(lastRealization), intervalDays)
      : firstRealizationPending
        ? addDays(
            admissionDay as Date,
            tracking.new_employee_first_due_days as number,
          )
        : null;
    const daysUntilDue = nextDueDate
      ? Math.ceil((nextDueDate.getTime() - today.getTime()) / DAY_IN_MS)
      : null;
    const firstDueSoonDays = tracking.new_employee_first_due_days
      ? Math.min(
          14,
          Math.max(3, Math.round(tracking.new_employee_first_due_days * 0.2)),
        )
      : dueSoonDays;
    const effectiveDueSoonDays = firstRealizationPending
      ? firstDueSoonDays
      : dueSoonDays;
    const status: DtoTrackingStatus = !lastRealization && !nextDueDate
      ? "never"
      : (daysUntilDue as number) < 0
        ? "overdue"
        : (daysUntilDue as number) <= effectiveDueSoonDays
          ? "dueSoon"
          : "current";
    subjects.push({
      key,
      name,
      source: isCollaborator
        ? "database"
        : isFormEnvironment
        ? "form"
        : !observedKeys.has(key) && manualKeys.has(key)
          ? "manual"
          : "observed",
      function: employee?.function || null,
      admissionDate,
      isNew,
      firstRealizationPending,
      applications: matchingRecords.length,
      lastRealization,
      nextDueDate,
      daysUntilDue,
      status,
    });
  });

  subjects.sort(
    (left, right) =>
      statusRank(left.status) - statusRank(right.status) ||
      (left.daysUntilDue ?? Number.NEGATIVE_INFINITY) -
        (right.daysUntilDue ?? Number.NEGATIVE_INFINITY) ||
      left.name.localeCompare(right.name, "pt-BR"),
  );
  const current = subjects.filter((item) => item.status === "current").length;
  const dueSoon = subjects.filter((item) => item.status === "dueSoon").length;
  const overdue = subjects.filter((item) => item.status === "overdue").length;
  const never = subjects.filter((item) => item.status === "never").length;
  const newEmployees = subjects.filter((item) => item.isNew).length;
  const lastRealization = subjects.reduce<Date | null>(
    (latest, item) =>
      item.lastRealization && (!latest || item.lastRealization > latest)
        ? item.lastRealization
        : latest,
    null,
  );

  return {
    configured,
    mode,
    environmentSource,
    collaboratorSource,
    subjects,
    excludedSubjects: isCollaborator ? [] : tracking.excluded_collaborators,
    total: subjects.length,
    current,
    dueSoon,
    overdue,
    never,
    newEmployees,
    realizationAdherence:
      subjects.length > 0
        ? ((current + dueSoon) / subjects.length) * 100
        : null,
    lastRealization,
  };
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function monthStart(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function isInMonth(value: Date, year: number, month: number): boolean {
  return value.getFullYear() === year && value.getMonth() === month;
}

function uniqueSortedDates(values: Date[]): Date[] {
  return [...new Map(values.map((value) => [startOfDay(value).getTime(), startOfDay(value)])).values()]
    .sort((left, right) => left.getTime() - right.getTime());
}

export interface DtoTrackingSnapshotPeriod {
  start: Date | null;
  end: Date | null;
}

function trackingRealizationDates(detail: DtoFormDetail): Date[] {
  const dateKey = detail.configuration.tracking.realization_date_field_key;
  return uniqueSortedDates(
    dateKey
      ? detail.records
          .map((record) => parseDtoDate(record.values[dateKey]))
          .filter((date): date is Date => date !== null)
      : [],
  );
}

/** Resolves the loaded snapshot boundaries without inventing a period from today. */
export function resolveTrackingSnapshotPeriod(detail: DtoFormDetail): DtoTrackingSnapshotPeriod {
  const realizations = trackingRealizationDates(detail);
  const start = parseDtoDate(detail.source_period_start) || realizations[0] || null;
  const end = parseDtoDate(detail.source_period_end) || realizations.at(-1) || null;
  return start && end && start > end ? { start: null, end: null } : { start, end };
}

/** Years are bounded by the snapshot whenever it declares a period. */
export function getDtoTrackingYears(detail: DtoFormDetail): number[] {
  const { start, end } = resolveTrackingSnapshotPeriod(detail);
  if (start && end && start <= end) {
    return Array.from(
      { length: end.getFullYear() - start.getFullYear() + 1 },
      (_, index) => start.getFullYear() + index,
    );
  }
  const years = new Set(trackingRealizationDates(detail).map((date) => date.getFullYear()));
  if (start) years.add(start.getFullYear());
  if (end) years.add(end.getFullYear());
  return [...years].sort((left, right) => left - right);
}

function collectRealizationsBySubject(
  detail: DtoFormDetail,
  context: DtoTrackingContext | null,
  subjects: DtoTrackedSubject[],
): Map<string, Date[]> {
  const tracking = detail.configuration.tracking;
  const dateKey = tracking.realization_date_field_key;
  const result = new Map(subjects.map((subject) => [subject.key, [] as Date[]]));
  if (!dateKey) return result;
  const subjectKeys = new Set(result.keys());
  const collaboratorMode = tracking.mode === "COLLABORATOR";
  const formEnvironment = tracking.mode === "ENVIRONMENT" && tracking.environment_source === "FORM";

  detail.records.forEach((record) => {
    const realization = parseDtoDate(record.values[dateKey]);
    if (!realization) return;
    if (collaboratorMode) {
      (context?.record_employee_keys[record.id] || []).forEach((key) => {
        if (subjectKeys.has(key)) result.get(key)?.push(realization);
      });
      return;
    }
    if (formEnvironment) {
      subjects.forEach((subject) => result.get(subject.key)?.push(realization));
      return;
    }
    extractTrackingNames(record.values[tracking.roster_field_key || ""]).forEach((name) => {
      const key = normalizeSearchText(name);
      if (subjectKeys.has(key)) result.get(key)?.push(realization);
    });
  });
  result.forEach((dates, key) => result.set(key, uniqueSortedDates(dates)));
  return result;
}

function classifyMonth({
  admissionDate,
  assumePendingWithoutHistory,
  firstDueDays,
  intervalDays,
  month,
  realizations,
  snapshotStart,
  snapshotEnd,
  year,
}: {
  admissionDate: Date | null;
  assumePendingWithoutHistory: boolean;
  firstDueDays: number | null;
  intervalDays: number;
  month: number;
  realizations: Date[];
  snapshotStart: Date | null;
  snapshotEnd: Date | null;
  year: number;
}): DtoTrackingMonthCell {
  const start = monthStart(year, month);
  const end = endOfMonth(year, month);
  const firstDue = admissionDate && firstDueDays !== null
    ? addDays(admissionDate, firstDueDays)
    : null;
  const cell: DtoTrackingMonthCell = {
    year,
    month,
    status: "unknown",
    realizations: realizations.filter((date) => isInMonth(date, year, month)),
    coverageRealization: null,
    coverageStartDate: null,
    coverageEndDate: null,
    dueDate: null,
    overdueDays: null,
  };
  if (!snapshotStart || !snapshotEnd) return cell;
  if (end < snapshotStart) return { ...cell, status: "outOfSnapshot" };
  if (start > snapshotEnd) return { ...cell, status: "future" };
  if (admissionDate && end < admissionDate) return { ...cell, status: "notApplicable" };

  // Records before the snapshot were not loaded. They must not be used to
  // invent coverage or an overdue cycle at the left boundary.
  const knownRealizations = realizations.filter(
    (date) => date >= snapshotStart && date <= snapshotEnd,
  );
  const previous = knownRealizations.filter((date) => date < start).at(-1) || null;
  const inMonth = cell.realizations;
  const dueDate = previous
    ? addDays(previous, intervalDays)
    : firstDue && firstDue >= snapshotStart
      ? firstDue
      : null;
  const lateDue = dueDate && inMonth[0] && dueDate < inMonth[0]
    ? dueDate
    : null;

  if (inMonth.length) {
    const coverageRealization = inMonth.at(-1) || null;
    return {
      ...cell,
      status: lateDue ? "realizedLate" : "realized",
      dueDate: lateDue,
      overdueDays: lateDue ? Math.floor((inMonth[0].getTime() - lateDue.getTime()) / DAY_IN_MS) : null,
      coverageRealization,
      coverageStartDate: coverageRealization,
      coverageEndDate: coverageRealization ? addDays(coverageRealization, intervalDays) : null,
    };
  }

  if (!dueDate) {
    if (firstDue && firstDue > end) return { ...cell, status: "future" };
    // A collaborator is the analysis target: no known realization in a loaded
    // month is actionable as pending. Environments retain historical uncertainty.
    return {
      ...cell,
      status: assumePendingWithoutHistory ? "missed" : "unknown",
    };
  }
  if (dueDate > end) {
    return {
      ...cell,
      status: previous ? "covered" : "future",
      coverageRealization: previous,
      coverageStartDate: previous,
      coverageEndDate: previous ? dueDate : null,
    };
  }

  const isPast = dueDate <= snapshotEnd;
  return {
    ...cell,
    status: isPast ? "missed" : "due",
    dueDate,
    overdueDays: isPast
      ? Math.max(0, Math.floor((snapshotEnd.getTime() - dueDate.getTime()) / DAY_IN_MS))
      : null,
    coverageRealization: previous,
    coverageStartDate: previous,
    coverageEndDate: previous ? dueDate : null,
  };
}

export function computeDtoTrackingYear(
  detail: DtoFormDetail,
  context: DtoTrackingContext | null,
  year: number,
): DtoTrackingYearSummary {
  const snapshotPeriod = resolveTrackingSnapshotPeriod(detail);
  const current = computeDtoTracking(detail, context, snapshotPeriod.end || new Date());
  const intervalDays = detail.configuration.tracking.interval_days || 0;
  const firstDueDays = detail.configuration.tracking.new_employee_first_due_days;
  const datesBySubject = collectRealizationsBySubject(detail, context, current.subjects);
  const employeeByKey = new Map((context?.employees || []).map((employee) => [employee.key, employee]));
  const { start: snapshotStart, end: snapshotEnd } = snapshotPeriod;
  const rows: DtoTrackingYearRow[] = current.subjects.map((subject) => {
    const employee = employeeByKey.get(subject.key);
    const dates = datesBySubject.get(subject.key) || [];
    const months = Array.from({ length: 12 }, (_, month) => classifyMonth({
      admissionDate: subject.admissionDate,
      assumePendingWithoutHistory: current.mode === "COLLABORATOR",
      firstDueDays,
      intervalDays,
      month,
      realizations: dates,
      snapshotStart,
      snapshotEnd,
      year,
    }));
    return {
      subject,
      location: employee?.location || null,
      area: employee?.area || null,
      months,
      realizations: dates.filter((date) => date.getFullYear() === year).length,
      realizedMonths: months.filter((cell) => cell.status === "realized" || cell.status === "realizedLate").length,
      coveredMonths: months.filter((cell) => cell.status === "covered").length,
      pendingMonths: months.filter((cell) => cell.status === "due" || cell.status === "missed").length,
    };
  });
  return { year, mode: current.mode, rows, availableYears: getDtoTrackingYears(detail) };
}

/** Returns annual-only dates for the matrix row hover, never snapshot-wide values. */
export function getDtoTrackingYearDates(
  row: DtoTrackingYearRow,
  referenceDate: Date,
): { lastRealization: Date | null; nextDueDate: Date | null; lastDueDate: Date | null } {
  const realizations = uniqueSortedDates(row.months.flatMap((cell) => cell.realizations));
  const dueDates = uniqueSortedDates(
    row.months
      .map((cell) => cell.dueDate)
      .filter((date): date is Date => date !== null),
  );
  return {
    lastRealization: realizations.at(-1) || null,
    nextDueDate: dueDates.find((date) => date >= referenceDate) || null,
    lastDueDate: dueDates.at(-1) || null,
  };
}

/** Matrix category values are subject keys, so duplicate display names stay distinct. */
export function getDtoTrackingRowBySubjectKey(
  rows: DtoTrackingYearRow[],
  subjectKey: string,
): DtoTrackingYearRow | null {
  return rows.find((row) => row.subject.key === subjectKey) || null;
}

export function computeDtoTrackingMonthSummary(
  rows: DtoTrackingYearRow[],
  year: number,
  month: number,
): DtoTrackingMonthSummary {
  const cells = rows.map((row) => row.months[month]).filter(Boolean);
  const count = (status: DtoTrackingMonthStatus) => cells.filter((cell) => cell.status === status).length;
  const applicable = cells.filter(
    (cell) => !["notApplicable", "future", "outOfSnapshot", "unknown"].includes(cell.status),
  ).length;
  const covered = count("covered");
  const realized = count("realized");
  const realizedLate = count("realizedLate");
  return {
    year, month, applicable, realized, covered, realizedLate,
    due: count("due"),
    missed: count("missed"),
    future: count("future"),
    outOfSnapshot: count("outOfSnapshot"),
    unknown: count("unknown"),
    coveragePercentage: applicable ? ((realized + realizedLate + covered) / applicable) * 100 : null,
  };
}
