import type { Indicator, IndicatorResult, JourneyAuditRow } from "../model/types";

export function auditHours(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
  return (seconds / 3600).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " h";
}
export function auditDurations(row: JourneyAuditRow, indicator: Indicator): { label: string; varied: boolean } {
  const values = [...new Set(row.members.filter(m => m.included).map(m => m[indicator])
    .filter((metric): metric is IndicatorResult => metric !== null && metric.seconds !== null && metric.seconds >= 0 && metric.temporalOrderAnomaly !== true)
    .map(metric => metric.seconds as number))].sort((a, b) => a - b);
  return { label: values.length > 1 ? `${auditHours(values[0])} – ${auditHours(values.at(-1))}` : auditHours(values[0]), varied: values.length > 1 };
}
export function auditOutcome(metric: IndicatorResult | null): string {
  if (!metric) return "Sem resultado";
  if (metric.temporalOrderAnomaly) return "Anomalia temporal";
  if (metric.lifecycleStatus === "EM_ANDAMENTO") return "Em andamento";
  if (!["FINALIZADO", "CONCLUIDO"].includes(metric.lifecycleStatus ?? "") || metric.achieved === null) return "Sem resultado avaliável";
  return metric.achieved ? "Atingido" : "Não atingido";
}

export const auditColumns = [
  { key: "date", label: "Data" }, { key: "map", label: "Mapa" },
  { key: "driver", label: "Motorista" }, { key: "vehicle", label: "Veículo" },
  { key: "helpers", label: "Ajudantes" }, { key: "departure", label: "Saída carro" },
  { key: "entry", label: "Entrada carro" }, { key: "tml", label: "TML (h)" },
  { key: "tr", label: "TR (h)" }, { key: "ti", label: "TI (h)" }, { key: "jl", label: "JL (h)" },
  { key: "deliveries", label: "Entregas" }, { key: "result", label: "Resultados da análise" },
  { key: "expurge", label: "Expurgo / equipe" },
] as const;
export function auditFilterOptions<T extends { label: string }>(options: T[], search: string): T[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
  const term = normalize(search);
  return options.filter(option => normalize(option.label).includes(term));
}

export function auditSelectedValues(options: { value: string; label: string }[], checked: Set<string>, search: string): string[] | undefined {
  const selected = (search.trim() ? auditFilterOptions(options, search).filter(option => checked.has(option.value)).map(option => option.value) : [...checked]);
  return options.length > 0 && options.every(option => selected.includes(option.value)) ? undefined : selected;
}
