export const EXTRATOR_PERIOD_LABELS = Object.freeze({
  anual: "Anual",
  mensal: "Mensal",
  data_dia_especifico: "Dia especifico",
  periodo_especifico: "Periodo especifico",
  sem_periodo: "Sem periodo",
});

function normalizeString(value) {
  return String(value ?? "").trim();
}

export function getBasePeriodMeta(reportsMeta, base) {
  return reportsMeta?.[base] || null;
}

export function buildDefaultPeriodState(periodMeta) {
  const periodType = normalizeString(periodMeta?.padrao);
  const preset = periodMeta?.presets?.[periodType] || {};

  return {
    periodType,
    periodMode: normalizeString(preset?.padrao),
    monthReference: "",
    yearReference: "",
    date: "",
    startDate: "",
    endDate: "",
  };
}

export function derivePeriodState(currentState, periodMeta) {
  if (!periodMeta) {
    return {
      periodType: "",
      periodMode: "",
      monthReference: "",
      yearReference: "",
      date: "",
      startDate: "",
      endDate: "",
    };
  }

  const availableTypes = (periodMeta.opcoes || []).map((option) => option.id);
  const nextPeriodType = availableTypes.includes(currentState.periodType)
    ? currentState.periodType
    : normalizeString(periodMeta.padrao);
  const preset = periodMeta.presets?.[nextPeriodType] || {};
  const availableModes = (preset.opcoes || []).map((option) => option.id);
  const nextPeriodMode = availableModes.includes(currentState.periodMode)
    ? currentState.periodMode
    : normalizeString(preset.padrao);

  return {
    ...currentState,
    periodType: nextPeriodType,
    periodMode: nextPeriodMode,
  };
}

export function buildPeriodArgs(periodState) {
  const payload = {};

  if (periodState.periodMode === "ano_referencia" && periodState.yearReference) {
    payload.ano = periodState.yearReference;
  }

  if (periodState.periodMode === "mes_referencia" && periodState.monthReference) {
    payload.mes_referencia = periodState.monthReference;
  }

  if (periodState.periodMode === "data_especifica" && periodState.date) {
    payload.data = periodState.date;
  }

  if (periodState.periodMode === "periodo_especifico") {
    if (periodState.startDate) {
      payload.data_inicial = periodState.startDate;
    }
    if (periodState.endDate) {
      payload.data_final = periodState.endDate;
    }
  }

  return payload;
}

export function serializeTaskForRequest(base, periodState) {
  return {
    base,
    period_type: periodState.periodType || null,
    period_mode: periodState.periodMode || null,
    period_args: buildPeriodArgs(periodState),
  };
}

export function hydratePeriodStateFromItem(item) {
  return {
    periodType: normalizeString(item?.period_type || item?.periodo_tipo),
    periodMode: normalizeString(item?.period_mode || item?.periodo_modo),
    yearReference: normalizeString(item?.period_args?.ano || item?.ano),
    monthReference: normalizeString(
      item?.period_args?.mes_referencia || item?.mes_referencia || item?.mesReferencia,
    ),
    date: normalizeString(item?.period_args?.data || item?.data),
    startDate: normalizeString(
      item?.period_args?.data_inicial || item?.data_inicial || item?.dataInicial,
    ),
    endDate: normalizeString(
      item?.period_args?.data_final || item?.data_final || item?.dataFinal,
    ),
  };
}

export function buildPeriodSummary(periodState, periodMeta) {
  const typeLabel =
    (periodMeta?.opcoes || []).find((option) => option.id === periodState.periodType)
      ?.label || EXTRATOR_PERIOD_LABELS[periodState.periodType] || "Sem periodo";
  const modeLabel =
    (periodMeta?.presets?.[periodState.periodType]?.opcoes || []).find(
      (option) => option.id === periodState.periodMode,
    )?.label || periodState.periodMode || "Padrao";

  if (periodState.periodMode === "ano_referencia" && periodState.yearReference) {
    return `${typeLabel}: ${modeLabel} (${periodState.yearReference})`;
  }

  if (periodState.periodMode === "mes_referencia" && periodState.monthReference) {
    return `${typeLabel}: ${modeLabel} (${periodState.monthReference})`;
  }

  if (periodState.periodMode === "data_especifica" && periodState.date) {
    return `${typeLabel}: ${modeLabel} (${periodState.date})`;
  }

  if (
    periodState.periodMode === "periodo_especifico" &&
    periodState.startDate &&
    periodState.endDate
  ) {
    return `${typeLabel}: ${periodState.startDate} ate ${periodState.endDate}`;
  }

  return `${typeLabel}: ${modeLabel}`;
}
