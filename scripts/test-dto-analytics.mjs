import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function transpile(relativePath) {
  return ts.transpileModule(
    fs.readFileSync(path.join(root, relativePath), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
      fileName: relativePath,
    },
  ).outputText;
}

function evaluate(code, dependencies = {}) {
  const moduleRecord = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier in dependencies) return dependencies[specifier];
    throw new Error(`Dependência inesperada no teste DTO: ${specifier}`);
  };
  new Function("exports", "module", "require", code)(
    moduleRecord.exports,
    moduleRecord,
    localRequire,
  );
  return moduleRecord.exports;
}

const formatters = evaluate(
  transpile("src/features/dpo/lib/dtoFormatters.ts"),
);
const analytics = evaluate(
  transpile("src/features/dpo/lib/dtoAnalytics.ts"),
  { "@/features/dpo/lib/dtoFormatters": formatters },
);
const tracking = evaluate(
  transpile("src/features/dpo/lib/dtoTracking.ts"),
  { "@/features/dpo/lib/dtoFormatters": formatters },
);
const planning = evaluate(
  transpile("src/features/dpo/lib/dtoPlanning.ts"),
  { "@/features/dpo/lib/dtoFormatters": formatters },
);

const saviDate = formatters.parseDtoDate("11/08/2026 17:20");
assert.ok(saviDate);
assert.equal(saviDate.getFullYear(), 2026);
assert.equal(saviDate.getMonth(), 7);
assert.equal(saviDate.getDate(), 11);
assert.equal(saviDate.getHours(), 17);
assert.equal(saviDate.getMinutes(), 20);

const columns = [
  { key: "collaborator", role: "COLLABORATOR", observation_status: "OBSERVED" },
  { key: "question-a", label: "Pergunta A", role: "EVALUATION", observation_status: "OBSERVED" },
  { key: "question-b", label: "Pergunta B", role: "EVALUATION", observation_status: "OBSERVED" },
];

function record(id, collaborator, date, statuses) {
  return {
    id,
    index: 0,
    date,
    collaborator,
    manager: null,
    values: {},
    answers: statuses.map(([column_key, status]) => ({
      column_key,
      label: column_key === "question-a" ? "Pergunta A" : "Pergunta B",
      raw_value: status,
      normalized_value: status.toLowerCase(),
      status,
    })),
  };
}

const records = [
  record("app-1", "Maria", "2026-08-01", [
    ["question-a", "NEGATIVE"],
    ["question-b", "POSITIVE"],
  ]),
  record("app-2", "Maria", "2026-08-08", [
    ["question-a", "NEGATIVE"],
    ["question-b", "IGNORED"],
  ]),
  record("app-3", "Maria", "2026-08-10", [
    ["question-a", "UNMAPPED"],
    ["question-b", "POSITIVE"],
  ]),
  record("app-4", "João", "2026-08-11", [
    ["question-a", "NEGATIVE"],
    ["question-b", "POSITIVE"],
  ]),
];

const metrics = analytics.computeDtoMetrics(records.slice(0, 3), columns);
assert.equal(metrics.positive, 2);
assert.equal(metrics.negative, 2);
assert.equal(metrics.ignored, 1);
assert.equal(metrics.unmapped, 1);
assert.equal(metrics.adherence, 50);

const collaborators = analytics.computeCollaboratorStats(records, columns);
assert.equal(collaborators.length, 2);
const maria = collaborators.find((item) => item.name === "Maria");
assert.equal(maria.applications, 3);
assert.equal(maria.applicationsWithNegative, 2);
assert.equal(maria.recurringGaps.length, 1);
assert.equal(maria.recurringGaps[0].questionLabel, "Pergunta A");
assert.deepEqual(maria.recurringGaps[0].recordIds, ["app-1", "app-2"]);

const duplicateApplication = [records[0], { ...records[0] }];
assert.equal(analytics.computeRecurringGaps(duplicateApplication).length, 0);

const trackingDetail = {
  configuration: {
    tracking: {
      mode: "COLLABORATOR",
      collaborator_source: "CPF",
      roster_field_key: "person",
      realization_date_field_key: "realized-at",
      interval_days: 60,
      applicable_functions: ["MOTORISTA"],
      new_employee_window_days: null,
      new_employee_first_due_days: null,
      excluded_collaborators: [],
      manual_collaborators: [],
    },
  },
  records: [
    { id: "cpf-ana", values: { person: "11111111111", "realized-at": "11/08/2026 17:20" } },
    { id: "cpf-bruno", values: { person: "22222222222", "realized-at": "01/06/2026 08:00" } },
    { id: "cpf-unknown", values: { person: "99999999999", "realized-at": "09/09/2026 08:00" } },
  ],
};
const workforceContext = {
  collaborator_source: "CPF",
  available_functions: [
    { name: "MOTORISTA", employees: 2 },
    { name: "AJUDANTE", employees: 1 },
  ],
  employees: [
    { key: "1", name: "Ana", function: "MOTORISTA", admission_date: "2024-01-10" },
    { key: "2", name: "Bruno", function: "MOTORISTA", admission_date: "2023-01-10" },
    { key: "3", name: "Carla", function: "AJUDANTE", admission_date: "2022-01-10" },
  ],
  record_employee_keys: {
    "cpf-ana": ["1"],
    "cpf-bruno": ["2"],
  },
  employees_without_cpf: 0,
  unmatched_records: 1,
};
const trackingSummary = tracking.computeDtoTracking(
  trackingDetail,
  workforceContext,
  new Date(2026, 8, 10, 12),
);
assert.equal(trackingSummary.mode, "COLLABORATOR");
assert.equal(trackingSummary.total, 3);
assert.equal(trackingSummary.current, 1);
assert.equal(trackingSummary.overdue, 1);
assert.equal(trackingSummary.never, 1);
assert.equal(Math.round(trackingSummary.realizationAdherence), 33);
assert.equal(
  trackingSummary.subjects.find((item) => item.name === "Carla").applications,
  0,
);

const environmentTracking = tracking.computeDtoTracking(
  {
    configuration: {
      tracking: {
        mode: "ENVIRONMENT",
        environment_source: "FIELD",
        roster_field_key: "environment",
        realization_date_field_key: "realized-at",
        interval_days: 30,
        applicable_functions: [],
        new_employee_window_days: null,
        new_employee_first_due_days: null,
        excluded_collaborators: ["Escritório"],
        manual_collaborators: ["Pátio"],
      },
    },
    records: [
      { values: { environment: "Oficina", "realized-at": "20/08/2026" } },
      { values: { environment: "Oficina", "realized-at": "01/09/2026" } },
      { values: { environment: "Armazém", "realized-at": "01/07/2026" } },
      { values: { environment: "Escritório", "realized-at": "09/09/2026" } },
    ],
  },
  null,
  new Date(2026, 8, 10, 12),
);
assert.equal(environmentTracking.mode, "ENVIRONMENT");
assert.equal(environmentTracking.total, 3);
assert.equal(environmentTracking.current, 1);
assert.equal(environmentTracking.overdue, 1);
assert.equal(environmentTracking.never, 1);
assert.equal(
  environmentTracking.subjects.find((item) => item.name === "Oficina").applications,
  2,
);
assert.equal(
  environmentTracking.subjects.find((item) => item.name === "Pátio").applications,
  0,
);

const formEnvironmentTracking = tracking.computeDtoTracking(
  {
    configuration: {
      tracking: {
        mode: "ENVIRONMENT",
        environment_source: "FORM",
        roster_field_key: null,
        realization_date_field_key: "realized-at",
        interval_days: 30,
        applicable_functions: [],
        new_employee_window_days: null,
        new_employee_first_due_days: null,
        excluded_collaborators: [],
        manual_collaborators: ["Armazém"],
      },
    },
    records: [
      { values: { "realized-at": "20/08/2026", evaluator: "Ana" } },
      { values: { "realized-at": "01/09/2026", evaluator: "Bruno" } },
    ],
  },
  null,
  new Date(2026, 8, 10, 12),
);
assert.equal(formEnvironmentTracking.configured, true);
assert.equal(formEnvironmentTracking.environmentSource, "FORM");
assert.equal(formEnvironmentTracking.total, 1);
assert.equal(formEnvironmentTracking.current, 1);
assert.equal(formEnvironmentTracking.subjects[0].name, "Armazém");
assert.equal(formEnvironmentTracking.subjects[0].applications, 2);
assert.equal(formEnvironmentTracking.subjects[0].source, "form");

const mapTracking = tracking.computeDtoTracking(
  {
    configuration: {
      tracking: {
        mode: "COLLABORATOR",
        collaborator_source: "MAP",
        roster_field_key: "map",
        realization_date_field_key: "realized-at",
        interval_days: 60,
        applicable_functions: ["MOTORISTA", "AJUDANTE"],
        new_employee_window_days: null,
        new_employee_first_due_days: null,
        excluded_collaborators: [],
        manual_collaborators: [],
      },
    },
    records: [
      { id: "map-291128", values: { map: 291128, "realized-at": "10/09/2026" } },
    ],
  },
  {
    collaborator_source: "MAP",
    available_functions: workforceContext.available_functions,
    employees: workforceContext.employees,
    record_employee_keys: {
      "map-291128": ["1", "2", "3"],
    },
    employees_without_cpf: 0,
    unmatched_records: 0,
  },
  new Date(2026, 8, 10, 12),
);
assert.equal(mapTracking.total, 3);
assert.equal(mapTracking.current, 3);
assert.ok(mapTracking.subjects.every((item) => item.applications === 1));

// Expurgos must also apply when a context cached before saving still contains the person.
const exclusionDetail = {
  configuration: { tracking: {
    mode: "COLLABORATOR", collaborator_source: "MAP", roster_field_key: "map",
    realization_date_field_key: "realized-at", interval_days: 60,
    applicable_functions: ["MOTORISTA", "AJUDANTE"], excluded_employee_keys: ["1"],
    excluded_collaborators: [], manual_collaborators: [],
  } },
  records: [{id: "map-done", values: {map: 291128, "realized-at": "10/09/2026"}}],
};
const exclusionContext = { ...workforceContext, record_employee_keys: {"map-done": ["1", "2", "3"]} };
const excludedTracking = tracking.computeDtoTracking(exclusionDetail, exclusionContext, new Date(2026, 8, 10, 12));
assert.equal(excludedTracking.total, 2);
assert.equal(excludedTracking.subjects.some(subject => subject.key === "1"), false);
assert.equal(excludedTracking.current, 2);
assert.equal(excludedTracking.realizationAdherence, 100);
assert.equal(exclusionDetail.records.length, 1);
const excludedRows = tracking.computeDtoTrackingYear(exclusionDetail, exclusionContext, 2026).rows;
assert.equal(excludedRows.length, 2);
exclusionDetail.configuration.tracking.excluded_employee_keys = [];
const restoredTracking = tracking.computeDtoTracking(exclusionDetail, exclusionContext, new Date(2026, 8, 10, 12));
assert.equal(restoredTracking.total, 3);
assert.equal(restoredTracking.subjects.find(subject => subject.key === "1").applications, 1);

// Stable keys keep homonyms independent, including an empty population after expurgos.
const sameNameContext = {...exclusionContext, employees: exclusionContext.employees.map(employee => ({...employee, name: "Mesmo nome"}))};
exclusionDetail.configuration.tracking.excluded_employee_keys = ["1"];
const homonyms = tracking.computeDtoTracking(exclusionDetail, sameNameContext);
assert.equal(homonyms.subjects.length, 2);
assert.ok(homonyms.subjects.every(subject => subject.key !== "1"));
exclusionDetail.configuration.tracking.excluded_employee_keys = ["1", "2", "3"];
const allExcluded = tracking.computeDtoTracking(exclusionDetail, exclusionContext);
assert.equal(allExcluded.total, 0);
assert.equal(allExcluded.realizationAdherence, null);
assert.equal(tracking.computeDtoTrackingYear(exclusionDetail, exclusionContext, 2026).rows.length, 0);

const newEmployeeTracking = tracking.computeDtoTracking(
  {
    configuration: {
      tracking: {
        mode: "COLLABORATOR",
        collaborator_source: "CPF",
        roster_field_key: "cpf",
        realization_date_field_key: "realized-at",
        interval_days: 60,
        applicable_functions: ["MOTORISTA"],
        new_employee_window_days: 45,
        new_employee_first_due_days: 30,
        excluded_collaborators: [],
        manual_collaborators: [],
      },
    },
    records: [],
  },
  {
    collaborator_source: "CPF",
    available_functions: [{ name: "MOTORISTA", employees: 1 }],
    employees: [
      {
        key: "raymundo",
        name: "Raymundo",
        function: "MOTORISTA",
        admission_date: "2026-09-10",
      },
    ],
    record_employee_keys: {},
    employees_without_cpf: 0,
    unmatched_records: 0,
  },
  new Date(2026, 8, 10, 12),
);
assert.equal(newEmployeeTracking.newEmployees, 1);
assert.equal(newEmployeeTracking.subjects[0].isNew, true);
assert.equal(newEmployeeTracking.subjects[0].firstRealizationPending, true);
assert.equal(newEmployeeTracking.subjects[0].status, "current");
assert.equal(
  newEmployeeTracking.subjects[0].nextDueDate.toISOString().slice(0, 10),
  "2026-10-10",
);

const newEmployeeAfterFirstRealization = tracking.computeDtoTracking(
  {
    configuration: {
      tracking: {
        mode: "COLLABORATOR",
        collaborator_source: "CPF",
        roster_field_key: "cpf",
        realization_date_field_key: "realized-at",
        interval_days: 60,
        applicable_functions: ["MOTORISTA"],
        new_employee_window_days: 45,
        new_employee_first_due_days: 30,
        excluded_collaborators: [],
        manual_collaborators: [],
      },
    },
    records: [
      { id: "raymundo-first", values: { "realized-at": "2026-09-10" } },
    ],
  },
  {
    collaborator_source: "CPF",
    available_functions: [{ name: "MOTORISTA", employees: 1 }],
    employees: [
      {
        key: "raymundo",
        name: "Raymundo",
        function: "MOTORISTA",
        admission_date: "2026-09-10",
      },
    ],
    record_employee_keys: { "raymundo-first": ["raymundo"] },
    employees_without_cpf: 0,
    unmatched_records: 0,
  },
  new Date(2026, 8, 10, 12),
);
assert.equal(newEmployeeAfterFirstRealization.subjects[0].firstRealizationPending, false);
assert.equal(
  newEmployeeAfterFirstRealization.subjects[0].nextDueDate.toISOString().slice(0, 10),
  "2026-11-09",
);

const planningOccurrences = planning.computePlanningOccurrences({
  detail: {
    configuration: { tracking: { realization_date_field_key: "realized-at" } },
    records: [
      { id: "done", manager: "Ana Aplicadora", date: null, values: { "realized-at": "02/09/2026" } },
      { id: "other", manager: "Outro Aplicador", date: null, values: { "realized-at": "09/09/2026" } },
    ],
  },
  context: {
    record_employee_keys: { done: ["target"], other: ["target"] },
    record_applicant_keys: { done: ["applicant"], other: ["other-applicant"] },
  },
  items: [{
    id: "weekly",
    form_id: "form",
    title: "Agenda semanal",
    assignee_employee_key: "applicant",
    target_employee_keys: ["target"],
    start_date: "2026-09-01",
    end_date: "2026-09-15",
    recurrence: "WEEKLY",
    target_count: 1,
    notes: null,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  }],
  now: new Date(2026, 8, 10, 12),
});
assert.equal(planningOccurrences.length, 3);
assert.equal(planningOccurrences[0].status, "completed");
assert.equal(planningOccurrences[0].actualCount, 1);
assert.equal(planningOccurrences[1].status, "pending");
assert.equal(planningOccurrences[2].status, "upcoming");

const collaboratorCalendarEntries = planning.computePlanningCalendarEntries({
  collaboratorMode: true,
  context: {
    record_employee_keys: { done: ["target"], other: ["target"] },
  },
  employeeNamesByKey: { target: "Colaborador Planejado" },
  occurrences: planningOccurrences,
  now: new Date(2026, 8, 10, 12),
});
assert.equal(collaboratorCalendarEntries.length, 3);
assert.equal(collaboratorCalendarEntries[0].targetName, "Colaborador Planejado");
assert.equal(collaboratorCalendarEntries[0].targetKind, "collaborator");
assert.equal(collaboratorCalendarEntries[0].status, "completed");

const environmentCalendarEntries = planning.computePlanningCalendarEntries({
  collaboratorMode: false,
  context: null,
  employeeNamesByKey: { applicant: "Aplicadora do Armazém" },
  occurrences: planningOccurrences,
  now: new Date(2026, 8, 10, 12),
});
assert.equal(environmentCalendarEntries[0].targetName, "Aplicadora do Armazém");
assert.equal(environmentCalendarEntries[0].targetKind, "applicant");

const monthlyOccurrences = planning.computePlanningOccurrences({
  detail: { configuration: { tracking: {} }, records: [] },
  context: null,
  items: [{
    id: "monthly",
    form_id: "form",
    title: "Agenda mensal",
    assignee_employee_key: "applicant",
    target_employee_keys: [],
    start_date: "2026-01-31",
    end_date: "2026-03-31",
    recurrence: "MONTHLY",
    target_count: 1,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }],
  now: new Date(2026, 0, 1, 12),
});
assert.deepEqual(
  monthlyOccurrences.map((item) => item.date.getDate()),
  [31, 28, 31],
);

const historicalDetail = {
  source_period_start: "2025-01-01",
  source_period_end: "2026-10-10",
  configuration: {
    tracking: {
      mode: "COLLABORATOR", collaborator_source: "CPF", roster_field_key: "cpf",
      realization_date_field_key: "realized-at", interval_days: 60,
      applicable_functions: ["MOTORISTA"], new_employee_window_days: 45,
      new_employee_first_due_days: 30, excluded_collaborators: [], manual_collaborators: [],
    },
  },
  records: [
    { id: "aug", values: { "realized-at": "2026-08-05" } },
    { id: "late", values: { "realized-at": "2026-08-05" } },
    { id: "multiple", values: { "realized-at": "2026-08-18" } },
  ],
};
const historicalContext = {
  collaborator_source: "CPF",
  employees: [
    { key: "covered", name: "Coberta", function: "MOTORISTA", location: "Base", area: "Entrega", admission_date: "2024-01-10" },
    { key: "late", name: "Atrasada", function: "MOTORISTA", location: "Base", area: "Entrega", admission_date: "2024-01-10" },
    { key: "new", name: "Nova", function: "MOTORISTA", location: "Base", area: "Entrega", admission_date: "2026-06-15" },
  ],
  record_employee_keys: { aug: ["covered"], late: ["late"], multiple: ["covered"] },
  employees_without_cpf: 0, unmatched_records: 0,
};
const historicalYear = tracking.computeDtoTrackingYear(historicalDetail, historicalContext, 2026);
assert.deepEqual(historicalYear.availableYears, [2025, 2026]);
const coveredRow = historicalYear.rows.find((row) => row.subject.key === "covered");
assert.equal(coveredRow.months[7].status, "realized");
assert.equal(coveredRow.months[8].status, "covered");
assert.equal(coveredRow.months[9].status, "due");
assert.equal(coveredRow.months[7].realizations.length, 2);
const lateRow = historicalYear.rows.find((row) => row.subject.key === "late");
assert.equal(lateRow.months[7].status, "realized");
const newRow = historicalYear.rows.find((row) => row.subject.key === "new");
assert.equal(newRow.months[4].status, "notApplicable");
assert.equal(newRow.months[6].status, "missed");
const monthSummary = tracking.computeDtoTrackingMonthSummary(historicalYear.rows, 2026, 8);
assert.equal(monthSummary.covered, 2);
assert.equal(monthSummary.applicable, 3);
assert.equal(monthSummary.coveragePercentage, (2 / 3) * 100);

function trackingFixture({ start = "2026-01-01", end = "2026-10-10", admission = "2024-01-01", records = [], intervalDays = 60, firstDueDays = 30 } = {}) {
  return {
    detail: {
      source_period_start: start,
      source_period_end: end,
      configuration: { tracking: {
        mode: "COLLABORATOR", collaborator_source: "CPF", roster_field_key: "cpf",
        realization_date_field_key: "realized-at", interval_days: intervalDays,
        applicable_functions: ["MOTORISTA"], new_employee_window_days: null,
        new_employee_first_due_days: firstDueDays, excluded_collaborators: [], manual_collaborators: [],
      } },
      records: records.map((date, index) => ({ id: `realization-${index}`, values: { "realized-at": date } })),
    },
    context: {
      collaborator_source: "CPF",
      employees: [{ key: "employee", name: "Colaborador", function: "MOTORISTA", location: "Caraguatatuba", area: "Entrega", admission_date: admission }],
      record_employee_keys: Object.fromEntries(records.map((_, index) => [`realization-${index}`, ["employee"]])),
      employees_without_cpf: 0,
      unmatched_records: 0,
    },
  };
}

// A: the first due date comes from admission + configured first-due days, not current snapshot state.
const firstLate = trackingFixture({ start: "2026-06-01", admission: "2026-06-15", records: ["2026-08-05"] });
const firstLateYear = tracking.computeDtoTrackingYear(firstLate.detail, firstLate.context, 2026);
assert.equal(firstLateYear.rows[0].months[6].status, "missed");
assert.equal(firstLateYear.rows[0].months[7].status, "realizedLate");
assert.equal(firstLateYear.rows[0].months[7].dueDate.toISOString().slice(0, 10), "2026-07-15");
assert.equal(firstLateYear.rows[0].months[7].overdueDays, 21);

// B: a later realization begins a new cycle but never changes the missed month.
const lateCycle = trackingFixture({ records: ["2026-05-15", "2026-08-05"] });
const lateCycleYear = tracking.computeDtoTrackingYear(lateCycle.detail, lateCycle.context, 2026);
assert.equal(lateCycleYear.rows[0].months[6].status, "missed");
assert.equal(lateCycleYear.rows[0].months[7].status, "realizedLate");

// C: valid coverage ends at the actual next due date.
const coverage = trackingFixture({ end: "2026-10-10", records: ["2026-08-15"] });
const coverageYear = tracking.computeDtoTrackingYear(coverage.detail, coverage.context, 2026);
assert.equal(coverageYear.rows[0].months[7].status, "realized");
assert.equal(coverageYear.rows[0].months[8].status, "covered");
assert.equal(coverageYear.rows[0].months[9].status, "due");
const expiredCoverage = trackingFixture({ end: "2026-10-31", records: ["2026-08-15"] });
assert.equal(tracking.computeDtoTrackingYear(expiredCoverage.detail, expiredCoverage.context, 2026).rows[0].months[9].status, "missed");

// D/E/F/G/H/I/J: neutral boundaries, multiple dates, derived years and summary semantics.
const neverRealized = trackingFixture({ admission: "2026-06-15", records: [] });
const neverRealizedYear = tracking.computeDtoTrackingYear(neverRealized.detail, neverRealized.context, 2026);
assert.equal(neverRealizedYear.rows[0].months[4].status, "notApplicable");
assert.equal(neverRealizedYear.rows[0].months[6].status, "missed");
assert.ok(neverRealizedYear.rows[0].months.every((cell) => cell.status !== "covered" || cell.coverageRealization !== null));
const snapshotBoundary = trackingFixture({ start: "2025-07-01", end: "2026-10-10", records: ["2026-03-10"] });
const boundaryYear = tracking.computeDtoTrackingYear(snapshotBoundary.detail, snapshotBoundary.context, 2025);
assert.equal(boundaryYear.rows[0].months[0].status, "outOfSnapshot");
assert.deepEqual(boundaryYear.availableYears, [2025, 2026]);
const unknownHistory = trackingFixture({ start: "2026-01-01", records: ["2026-03-10"] });
const unknownYear = tracking.computeDtoTrackingYear(unknownHistory.detail, unknownHistory.context, 2026);
assert.equal(unknownYear.rows[0].months[0].status, "missed");
assert.equal(unknownYear.rows[0].months[1].status, "missed");
assert.equal(unknownYear.rows[0].months[2].status, "realized");
const collaboratorJanuary = tracking.computeDtoTrackingMonthSummary(unknownYear.rows, 2026, 0);
assert.equal(collaboratorJanuary.applicable, 1);
assert.equal(collaboratorJanuary.missed, 1);
assert.equal(collaboratorJanuary.unknown, 0);
const environmentHistory = tracking.computeDtoTrackingYear({
  source_period_start: "2026-01-01",
  source_period_end: "2026-09-30",
  configuration: { tracking: {
    mode: "ENVIRONMENT", environment_source: "FIELD", roster_field_key: "environment",
    realization_date_field_key: "realized-at", interval_days: 60,
    applicable_functions: [], new_employee_window_days: null,
    new_employee_first_due_days: null, excluded_collaborators: [],
    manual_collaborators: ["Sem registros"],
  } },
  records: [{ id: "environment-record", values: { environment: "Com registro", "realized-at": "10/03/2026" } }],
}, null, 2026);
const environmentWithoutHistory = environmentHistory.rows.find((row) => row.subject.name === "Sem registros");
assert.equal(environmentWithoutHistory.months[0].status, "unknown");
const multipleRealizations = trackingFixture({ records: ["2026-08-05", "2026-08-18"] });
const multipleYear = tracking.computeDtoTrackingYear(multipleRealizations.detail, multipleRealizations.context, 2026);
assert.equal(multipleYear.rows[0].months[7].realizations.length, 2);
assert.equal(multipleYear.rows[0].months[7].coverageRealization.toISOString().slice(0, 10), "2026-08-18");
const summaryWithNeutralStates = tracking.computeDtoTrackingMonthSummary(boundaryYear.rows, 2025, 0);
assert.equal(summaryWithNeutralStates.applicable, 0);
assert.equal(summaryWithNeutralStates.outOfSnapshot, 1);
assert.equal(summaryWithNeutralStates.coveragePercentage, null);

// Snapshot fallback: metadata and realizations compose one effective period.
const derivedSnapshot = trackingFixture({ records: ["2026-03-10", "2026-09-20"] });
delete derivedSnapshot.detail.source_period_start;
delete derivedSnapshot.detail.source_period_end;
const derivedPeriod = tracking.resolveTrackingSnapshotPeriod(derivedSnapshot.detail);
assert.equal(derivedPeriod.start.toISOString().slice(0, 10), "2026-03-10");
assert.equal(derivedPeriod.end.toISOString().slice(0, 10), "2026-09-20");
assert.deepEqual(tracking.getDtoTrackingYears(derivedSnapshot.detail), [2026]);
const derivedYear = tracking.computeDtoTrackingYear(derivedSnapshot.detail, derivedSnapshot.context, 2026);
assert.equal(derivedYear.rows[0].months[1].status, "outOfSnapshot");
assert.equal(derivedYear.rows[0].months[9].status, "future");

const startOnlySnapshot = trackingFixture({ start: "2026-02-01", records: ["2026-09-20"] });
delete startOnlySnapshot.detail.source_period_end;
const startOnlyPeriod = tracking.resolveTrackingSnapshotPeriod(startOnlySnapshot.detail);
assert.equal(startOnlyPeriod.start.toISOString().slice(0, 10), "2026-02-01");
assert.equal(startOnlyPeriod.end.toISOString().slice(0, 10), "2026-09-20");
const endOnlySnapshot = trackingFixture({ end: "2026-10-15", records: ["2026-03-10"] });
delete endOnlySnapshot.detail.source_period_start;
const endOnlyPeriod = tracking.resolveTrackingSnapshotPeriod(endOnlySnapshot.detail);
assert.equal(endOnlyPeriod.start.toISOString().slice(0, 10), "2026-03-10");
assert.equal(endOnlyPeriod.end.toISOString().slice(0, 10), "2026-10-15");

// Annual hover values are derived only from cells in the selected year.
const annualDatesFixture = trackingFixture({ records: ["2025-12-20", "2026-02-10"], intervalDays: 60 });
annualDatesFixture.detail.source_period_start = "2025-01-01";
annualDatesFixture.detail.source_period_end = "2026-12-31";
const annualDates2025 = tracking.computeDtoTrackingYear(
  annualDatesFixture.detail,
  annualDatesFixture.context,
  2025,
).rows[0];
const hoverDates2025 = tracking.getDtoTrackingYearDates(annualDates2025, new Date(2025, 11, 31));
assert.equal(hoverDates2025.lastRealization.toISOString().slice(0, 10), "2025-12-20");
const dueDateRow = {
  ...annualDates2025,
  months: annualDates2025.months.map((cell, index) => ({
    ...cell,
    dueDate: index === 0 ? new Date(2025, 0, 15) : index === 11 ? new Date(2025, 11, 30) : null,
  })),
};
const hoverDueDates = tracking.getDtoTrackingYearDates(dueDateRow, new Date(2025, 5, 1));
assert.equal(hoverDueDates.nextDueDate.toISOString().slice(0, 10), "2025-12-30");
assert.equal(hoverDueDates.lastDueDate.toISOString().slice(0, 10), "2025-12-30");

// Display names are not matrix identity: equal names retain separate subject keys.
const duplicateNames = trackingFixture({ records: ["2026-03-10", "2026-04-20"] });
duplicateNames.context.employees = [
  { ...duplicateNames.context.employees[0], key: "123", name: "José Carlos" },
  { ...duplicateNames.context.employees[0], key: "456", name: "José Carlos" },
];
duplicateNames.context.record_employee_keys = {
  "realization-0": ["123"],
  "realization-1": ["456"],
};
const duplicateRows = tracking.computeDtoTrackingYear(duplicateNames.detail, duplicateNames.context, 2026).rows;
assert.equal(tracking.getDtoTrackingRowBySubjectKey(duplicateRows, "123").months[2].realizations.length, 1);
assert.equal(tracking.getDtoTrackingRowBySubjectKey(duplicateRows, "456").months[3].realizations.length, 1);

console.log("DTO analytics, acompanhamento histórico e planejamento: cenários validados com sucesso.");
