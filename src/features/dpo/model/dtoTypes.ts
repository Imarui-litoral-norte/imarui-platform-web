export type DtoFieldRole =
  | "EVALUATION"
  | "COLLABORATOR"
  | "APPLIER"
  | "DATE"
  | "CONTEXT"
  | "IGNORE";

export type DtoConfigurationSource = "AUTO" | "MANUAL";
export type DtoObservationStatus = "OBSERVED" | "NOT_OBSERVED";
export type DtoAnswerSemantic =
  | "POSITIVE"
  | "NEGATIVE"
  | "IGNORED"
  | "UNMAPPED"
  | "BLANK";

export interface DtoFormReference {
  id: string;
  name: string;
  created_at?: string | null;
  used_at?: string | null;
}

export interface DtoFormsResponse {
  forms: DtoFormReference[];
  count: number;
  discovered_at: string | null;
  cached: boolean;
}

export interface DtoObservedValue {
  normalized_value: string;
  display_value: string;
  count: number;
  semantic: DtoAnswerSemantic;
  configuration_source: DtoConfigurationSource;
}

export interface DtoColumn {
  key: string;
  label: string;
  normalized_label: string;
  role: DtoFieldRole;
  configuration_source: DtoConfigurationSource;
  observation_status: DtoObservationStatus;
  non_blank_count: number;
  observed_values: DtoObservedValue[];
  warnings: string[];
}

export interface DtoAnswer {
  column_key: string;
  label: string;
  raw_value: unknown;
  normalized_value: string | null;
  status: DtoAnswerSemantic;
}

export interface DtoRecord {
  id: string;
  index: number;
  date: string | null;
  collaborator: string | null;
  manager: string | null;
  values: Record<string, unknown>;
  answers: DtoAnswer[];
}

export interface DtoQualityIssue {
  code: string;
  message: string;
  column_key?: string | null;
  record_index?: number | null;
  values?: unknown[] | null;
}

export interface DtoFieldConfiguration {
  key: string;
  source_name: string;
  normalized_name: string;
  role: DtoFieldRole;
  configuration_source: DtoConfigurationSource;
  observation_status: DtoObservationStatus;
  first_seen_at: string;
  last_seen_at: string;
  answer_mappings: Record<string, DtoAnswerSemantic>;
  observed_values: DtoObservedValue[];
  warnings: string[];
}

export type DtoTrackingMode = "COLLABORATOR" | "ENVIRONMENT";
export type DtoEnvironmentSource = "FIELD" | "FORM";
export type DtoCollaboratorSource = "CPF" | "MAP";

export interface DtoTrackingConfiguration {
  mode: DtoTrackingMode;
  environment_source: DtoEnvironmentSource;
  collaborator_source: DtoCollaboratorSource | null;
  roster_field_key: string | null;
  realization_date_field_key: string | null;
  interval_days: number | null;
  applicable_functions: string[];
  applicant_employee_keys: string[];
  excluded_employee_keys: string[];
  new_employee_window_days: number | null;
  new_employee_first_due_days: number | null;
  excluded_collaborators: string[];
  manual_collaborators: string[];
}

export interface DtoTrackingEmployee {
  key: string;
  name: string;
  function: string | null;
  location: string | null;
  area: string | null;
  admission_date: string | null;
}

export interface DtoWorkforceFunction {
  name: string;
  employees: number;
}

export interface DtoTrackingContext {
  collaborator_source: DtoCollaboratorSource;
  available_functions: DtoWorkforceFunction[];
  employees: DtoTrackingEmployee[];
  record_employee_keys: Record<string, string[]>;
  record_applicant_keys: Record<string, string[]>;
  employees_without_cpf: number;
  unmatched_records: number;
  active_workforce_filter_name: string | null;
  active_workforce_location: string | null;
}

export type DtoPlanningRecurrence = "ONCE" | "WEEKLY" | "MONTHLY";

export interface DtoPlanningItem {
  id: string;
  form_id: string;
  title: string;
  assignee_employee_key: string;
  target_employee_keys: string[];
  start_date: string;
  end_date: string;
  recurrence: DtoPlanningRecurrence;
  target_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DtoPlanningPayload {
  title: string;
  assignee_employee_key: string;
  target_employee_keys: string[];
  start_date: string;
  end_date?: string | null;
  recurrence: DtoPlanningRecurrence;
  target_count: number;
  notes?: string | null;
}

export interface DtoPlanningResponse {
  form_id: string;
  items: DtoPlanningItem[];
}

export interface WorkforceFilterOption {
  name: string;
  employees: number;
}

export interface WorkforceFilterEmployee {
  key: string;
  name: string;
  function: string | null;
  location: string | null;
  area: string | null;
}

export interface WorkforceFilterCatalog {
  locations: WorkforceFilterOption[];
  areas: WorkforceFilterOption[];
  functions: WorkforceFilterOption[];
  employees: WorkforceFilterEmployee[];
}

export interface WorkforceTrackingFilter {
  id: string;
  name: string;
  locations: string[];
  functions: string[];
  employee_keys: string[];
  creation_password: string;
  created_at: string;
  updated_at: string;
}

export interface WorkforceTrackingFilterPayload {
  name: string;
  locations: string[];
  functions: string[];
  employee_keys: string[];
  creation_password: string;
}

export interface DtoFormConfiguration {
  schema_version: number;
  form_id: string;
  form_name: string;
  revision: number;
  updated_at: string;
  fields: DtoFieldConfiguration[];
  tracking: DtoTrackingConfiguration;
  unmapped_values_count: number;
  fields_requiring_configuration: number;
}

export interface DtoFieldOverride {
  field_key: string;
  role: DtoFieldRole;
  answer_mappings: Record<string, Exclude<DtoAnswerSemantic, "BLANK">>;
}

export interface DtoConfigurationUpdate {
  revision: number;
  fields?: DtoFieldOverride[];
  reset_fields?: string[];
  tracking?: DtoTrackingConfiguration | null;
}

export interface DtoFormDetail {
  form: DtoFormReference;
  columns: DtoColumn[];
  records: DtoRecord[];
  loaded_at: string | null;
  cached: boolean;
  quality_issues: DtoQualityIssue[];
  configuration: DtoFormConfiguration;
  source_period_start?: string | null;
  source_period_end?: string | null;
  source_updated_at?: string | null;
}

export interface DtoRefreshRequest {
  start_date: string;
  end_date: string;
}

export type DtoRefreshStatus = "pending" | "completed" | "failed";

export interface DtoRefreshJob {
  job_id: string;
  form_id: string;
  status: DtoRefreshStatus;
  created_at: string;
  checked_at?: string | null;
  total_records?: number | null;
  error_message?: string | null;
  detail?: DtoFormDetail | null;
}

export type DtoResourceStatus = "idle" | "loading" | "ready" | "empty" | "error";

export interface DtoFormResource {
  status: DtoResourceStatus;
  data: DtoFormDetail | null;
  error: string | null;
  isRefreshing: boolean;
}

export type DtoFormResourceMap = Record<string, DtoFormResource>;
export type DtoPeriodFilter = "all" | "last30" | "last90" | "currentYear" | "custom";

export interface DtoFiltersState {
  period: DtoPeriodFilter;
  startDate: string;
  endDate: string;
  collaborator: string;
  manager: string;
  search: string;
  onlyNegative: boolean;
}

export interface DtoMetrics {
  applications: number;
  positive: number;
  negative: number;
  ignored: number;
  blank: number;
  unmapped: number;
  answered: number;
  adherence: number | null;
  collaborators: number | null;
  lastApplication: Date | null;
  hasDateColumn: boolean;
  hasCollaboratorColumn: boolean;
}

export interface DtoQuestionStat {
  columnKey: string;
  label: string;
  positive: number;
  negative: number;
  ignored: number;
  unmapped: number;
  answered: number;
  negativeApplications: number;
  negativeRate: number | null;
  recurring: boolean;
}

export interface DtoRecurringGap {
  columnKey: string;
  questionLabel: string;
  applications: number;
  recordIds: string[];
  lastOccurrence: Date | null;
}

export interface DtoCollaboratorStat {
  name: string;
  applications: number;
  applicationsWithNegative: number;
  positive: number;
  negative: number;
  adherence: number | null;
  recurringGaps: DtoRecurringGap[];
  lastApplication: Date | null;
}

export interface DtoTimelinePoint {
  key: string;
  label: string;
  applications: number;
  positive: number;
  negative: number;
  adherence: number | null;
}

export interface DtoApplicationTimelinePoint {
  key: string;
  label: string;
  date: Date;
  positive: number;
  negative: number;
  adherence: number | null;
}

export interface DtoTrend {
  direction: "improving" | "worsening" | "stable";
  delta: number;
  previousLabel: string;
  currentLabel: string;
}

export type DtoTrackingStatus = "current" | "dueSoon" | "overdue" | "never";

export interface DtoTrackedSubject {
  key: string;
  name: string;
  source: "database" | "observed" | "manual" | "form";
  function: string | null;
  admissionDate: Date | null;
  isNew: boolean;
  firstRealizationPending: boolean;
  applications: number;
  lastRealization: Date | null;
  nextDueDate: Date | null;
  daysUntilDue: number | null;
  status: DtoTrackingStatus;
}

export interface DtoTrackingSummary {
  configured: boolean;
  mode: DtoTrackingMode;
  environmentSource: DtoEnvironmentSource;
  collaboratorSource: DtoCollaboratorSource;
  subjects: DtoTrackedSubject[];
  excludedSubjects: string[];
  total: number;
  current: number;
  dueSoon: number;
  overdue: number;
  never: number;
  newEmployees: number;
  realizationAdherence: number | null;
  lastRealization: Date | null;
}

export type DtoTrackingMonthStatus =
  | "realized"
  | "covered"
  | "due"
  | "missed"
  | "realizedLate"
  | "notApplicable"
  | "future"
  | "outOfSnapshot"
  | "unknown";

export interface DtoTrackingMonthCell {
  year: number;
  month: number;
  status: DtoTrackingMonthStatus;
  realizations: Date[];
  coverageRealization: Date | null;
  coverageStartDate: Date | null;
  coverageEndDate: Date | null;
  dueDate: Date | null;
  overdueDays: number | null;
}

export interface DtoTrackingYearRow {
  subject: DtoTrackedSubject;
  location: string | null;
  area: string | null;
  months: DtoTrackingMonthCell[];
  realizations: number;
  realizedMonths: number;
  coveredMonths: number;
  pendingMonths: number;
}

export interface DtoTrackingYearSummary {
  year: number;
  mode: DtoTrackingMode;
  rows: DtoTrackingYearRow[];
  availableYears: number[];
}

export interface DtoTrackingMonthSummary {
  year: number;
  month: number;
  applicable: number;
  realized: number;
  covered: number;
  due: number;
  missed: number;
  realizedLate: number;
  future: number;
  outOfSnapshot: number;
  unknown: number;
  coveragePercentage: number | null;
}

export interface DtoAttentionPoint {
  id: string;
  title: string;
  description: string;
  tone: "default" | "attention" | "danger";
}

export interface DtoPortfolioMetrics {
  forms: number;
  loadedForms: number;
  failedForms: number;
  pendingForms: number;
  applications: number | null;
  positive: number | null;
  negative: number | null;
  adherence: number | null;
  collaborators: number | null;
  partial: boolean;
}
