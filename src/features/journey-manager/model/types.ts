export type Indicator = "tml" | "tr" | "ti" | "jl";
export type JourneyMode = "ponto" | "mpd";
export type ExpurgeFilter = "all" | "not_expurged" | "expurged";

export interface JourneyContext {
  date: string;
  map: number | null;
  mapOrigin: string | null;
  registration: number | null;
  employeeCode: number | null;
  role: string | null;
  employeeName: string | null;
  vehicle: number | null;
  plate: string | null;
  fleet: string | null;
  mapDriverCode: number | null;
  routeSupervisorCode: number | null;
  routeSupervisorName: string | null;
}

export interface IndicatorResult {
  secondsDifference: number | null;
  seconds: number | null;
  targetSeconds: number | null;
  lifecycleStatus: string | null;
  targetStatus: string | null;
  achieved: boolean | null;
  temporalOrderAnomaly: boolean | null;
}

export interface Expurge {
  present: boolean | null;
  count: number | null;
  ids: string | null;
  types: string | null;
  reasons: string | null;
  observations: string | null;
  flags: {
    stoppedMap: boolean | null;
    considerRv: boolean | null;
    recharge: boolean | null;
    historical: boolean | null;
    general: boolean | null;
  } | null;
}

export interface JourneyItem {
  context: JourneyContext;
  snapshotAt: string | null;
  expurge: Expurge;
}

export interface Checklist {
  count: number | null;
  totalSeconds: number | null;
  effectiveSeconds: number | null;
  effectiveStartedAt: string | null;
  effectiveEndedAt: string | null;
  adherent: boolean | null;
}

export interface TmlItem extends JourneyItem {
  mode: JourneyMode | null;
  pointOrigin: string | null;
  entryAt: string | null;
  morningAt: string | null;
  mapDepartureAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  tml: IndicatorResult;
  loadChecklist: Checklist | null;
  maintenanceChecklist: Checklist | null;
  totalChecklistSeconds: number | null;
}

export interface TrItem extends JourneyItem {
  mapDepartureAt: string | null;
  mapReturnAt: string | null;
  plannedSeconds: number | null;
  tr: IndicatorResult;
  dispersion: number | null;
}

export interface TiItem extends JourneyItem {
  mode: JourneyMode | null;
  mapDepartureAt: string | null;
  vehicleEntryAt: string | null;
  physicalCloseAt: string | null;
  financialCloseAt: string | null;
  pointOrigin: string | null;
  pointExitAt: string | null;
  endedAt: string | null;
  operationalStage: string | null;
  physicalClose: IndicatorResult;
  financialClose: IndicatorResult;
  ti: IndicatorResult;
  sourcePhysicalSeconds: number | null;
  sourceFinancialSeconds: number | null;
  sourceInternalSeconds: number | null;
}

export interface JlItem extends JourneyItem {
  mode: JourneyMode | null;
  pointJourneyDate: string | null;
  pointOrigin: string | null;
  morningAt: string | null;
  pointEntryAt: string | null;
  mapDepartureAt: string | null;
  mapReturnAt: string | null;
  physicalCloseAt: string | null;
  financialCloseAt: string | null;
  pointExitAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  operationalStage: string | null;
  tml: IndicatorResult;
  tr: IndicatorResult;
  physicalClose: IndicatorResult;
  financialClose: IndicatorResult;
  ti: IndicatorResult;
  jl: IndicatorResult;
  componentSumSeconds: number | null;
  divergenceSeconds: number | null;
}

export interface PeriodResponse<T extends JourneyItem> {
  from: string;
  to: string;
  snapshotAt: string | null;
  items: T[];
}

export interface JourneyQuery {
  indicator: Indicator;
  from: string;
  to: string;
  mode: JourneyMode;
  map: string;
  employeeCode: string;
  role: "all" | "motorista" | "ajudante";
  expurge: ExpurgeFilter;
}

export type JourneyResponse = PeriodResponse<TmlItem> | PeriodResponse<TrItem> |
  PeriodResponse<TiItem> | PeriodResponse<JlItem>;

export type AnalysisRole = "motorista" | "ajudante";
export interface JourneyCounts {
  total: number; attained: number; notAttained: number; pending: number;
  unavailable: number; evaluated: number; adherence: number | null;
  distinctMaps: number; expurged: number; anomalies: number;
}
export interface JourneyDay { date: string; counts: JourneyCounts }
export interface JourneyCollaborator {
  employeeCode: number; employeeName: string; role: string; counts: JourneyCounts;
}
export interface JourneyHistory {
  from: string; to: string; contextFrom: string; contextTo: string; asOf: string;
  snapshotAt: string | null; population: "MAP" | "MAP_EMPLOYEE"; role: AnalysisRole;
  hasLiveOrigin: boolean; summary: JourneyCounts; daily: JourneyDay[];
  collaborators: JourneyCollaborator[]; previousYearDaily: JourneyDay[];
}
