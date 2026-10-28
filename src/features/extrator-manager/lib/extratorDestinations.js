export const DEFAULT_DESTINATION_FILTERS = Object.freeze({
  search: "",
  owner: "__all__",
  base: "__all__",
  period: "__all__",
  enabled: "__all__",
  source: "__all__",
});

export function buildDestinationDefaultForm(destinationMeta) {
  const defaultRule = destinationMeta?.default_rule || {};
  const firstBase = destinationMeta?.base_options?.[0]?.id || "";
  const firstListenOption =
    destinationMeta?.listen_period_options_by_base?.[firstBase]?.[0]?.id ||
    destinationMeta?.listen_period_default ||
    "todos";

  return {
    id: "",
    base: firstBase,
    nome: "",
    senha: "",
    caminho: "",
    enabled: true,
    listenPeriodType: firstListenOption,
    listenPeriodModes: [],
    prefixo: defaultRule.prefixo || "",
    sufixo: defaultRule.sufixo || "",
    includeRotina: Boolean(defaultRule.include_rotina),
    stackPath: Boolean(defaultRule.stack_path),
    separator: defaultRule.sep || "",
    rotinaSeparador: defaultRule.rotina_separador || "_",
    extensaoArquivo: defaultRule.extensao_arquivo || ".csv",
    mesFormato: defaultRule.mes_formato || "completo",
    mesAbreviacaoTamanho: String(defaultRule.mes_abreviacao_tamanho || 3),
    mesCaixa: defaultRule.mes_caixa || "minusculo",
    mesSemAcento: Boolean(defaultRule.mes_sem_acento),
    dataOrdem: defaultRule.data_ordem || "dmy",
    dataSeparador: defaultRule.data_separador || "_",
    arquivoTemplateAnual: defaultRule.arquivo_template_anual ?? "{ano}",
    arquivoTemplateMensal: defaultRule.arquivo_template_mensal || "{mes_nome}",
    arquivoTemplateDiario: defaultRule.arquivo_template_diario || "{dia}",
    arquivoTemplatePeriodo:
      defaultRule.arquivo_template_periodo ||
      "{data_inicial}{sep_nome}{data_final}",
    arquivoTemplateSemPeriodo:
      defaultRule.arquivo_template_sem_periodo || "{rotina}",
    pastaTemplateAnual: defaultRule.pasta_template_anual ?? "{ano}",
    pastaTemplateMensal: defaultRule.pasta_template_mensal || "{ano}",
    pastaTemplateDiario:
      defaultRule.pasta_template_diario || "{ano}\\{mes_nome}",
    pastaTemplatePeriodo: defaultRule.pasta_template_periodo || "{ano}",
    pastaTemplateSemPeriodo: defaultRule.pasta_template_sem_periodo || "",
  };
}

export function buildDestinationFormFromRule(rule) {
  return {
    id: rule.id || "",
    base: rule.base || "",
    nome: rule.nome || "",
    senha: "",
    caminho: rule.caminho || "",
    enabled: Boolean(rule.enabled),
    listenPeriodType: rule.listen_period_type || "todos",
    listenPeriodModes: rule.listen_period_modes || [],
    prefixo: rule.prefixo || "",
    sufixo: rule.sufixo || "",
    includeRotina: Boolean(rule.include_rotina),
    stackPath: Boolean(rule.stack_path),
    separator: rule.sep || "",
    rotinaSeparador: rule.rotina_separador || "_",
    extensaoArquivo: rule.extensao_arquivo || ".csv",
    mesFormato: rule.mes_formato || "completo",
    mesAbreviacaoTamanho: String(rule.mes_abreviacao_tamanho || 3),
    mesCaixa: rule.mes_caixa || "minusculo",
    mesSemAcento: Boolean(rule.mes_sem_acento),
    dataOrdem: rule.data_ordem || "dmy",
    dataSeparador: rule.data_separador || "_",
    arquivoTemplateAnual: rule.arquivo_template_anual ?? "{ano}",
    arquivoTemplateMensal: rule.arquivo_template_mensal || "",
    arquivoTemplateDiario: rule.arquivo_template_diario || "",
    arquivoTemplatePeriodo: rule.arquivo_template_periodo || "",
    arquivoTemplateSemPeriodo: rule.arquivo_template_sem_periodo || "",
    pastaTemplateAnual: rule.pasta_template_anual ?? "{ano}",
    pastaTemplateMensal: rule.pasta_template_mensal || "",
    pastaTemplateDiario: rule.pasta_template_diario || "",
    pastaTemplatePeriodo: rule.pasta_template_periodo || "",
    pastaTemplateSemPeriodo: rule.pasta_template_sem_periodo || "",
  };
}

export function serializeDestinationForm(form, password) {
  return {
    id: form.id || undefined,
    base: form.base,
    nome: form.nome,
    senha: password,
    caminho: form.caminho,
    enabled: form.enabled,
    listen_period_type: form.listenPeriodType,
    listen_period_modes: form.listenPeriodModes,
    prefixo: form.prefixo,
    sufixo: form.sufixo,
    include_rotina: form.includeRotina,
    stack_path: form.stackPath,
    sep: form.separator,
    rotina_separador: form.rotinaSeparador,
    extensao_arquivo: form.extensaoArquivo,
    mes_formato: form.mesFormato,
    mes_abreviacao_tamanho: Number.parseInt(
      form.mesAbreviacaoTamanho || "3",
      10,
    ),
    mes_caixa: form.mesCaixa,
    mes_sem_acento: form.mesSemAcento,
    data_ordem: form.dataOrdem,
    data_separador: form.dataSeparador,
    arquivo_template_anual: form.arquivoTemplateAnual,
    arquivo_template_mensal: form.arquivoTemplateMensal,
    arquivo_template_diario: form.arquivoTemplateDiario,
    arquivo_template_periodo: form.arquivoTemplatePeriodo,
    arquivo_template_sem_periodo: form.arquivoTemplateSemPeriodo,
    pasta_template_anual: form.pastaTemplateAnual,
    pasta_template_mensal: form.pastaTemplateMensal,
    pasta_template_diario: form.pastaTemplateDiario,
    pasta_template_periodo: form.pastaTemplatePeriodo,
    pasta_template_sem_periodo: form.pastaTemplateSemPeriodo,
  };
}

function stripAccents(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function applyMonthCase(value, caseMode) {
  const rawValue = String(value ?? "");
  if (caseMode === "maiusculo") {
    return rawValue.toUpperCase();
  }
  if (caseMode === "titulo") {
    return rawValue.charAt(0).toUpperCase() + rawValue.slice(1).toLowerCase();
  }
  return rawValue.toLowerCase();
}

function formatMonthName(rule, monthIndex, forcedFormat = "", forcedCase = "") {
  const months = [
    "janeiro",
    "fevereiro",
    "marco",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
  ];
  const selectedFormat = String(
    forcedFormat || rule?.mesFormato || "completo",
  ).toLowerCase();
  const abbrSize = Math.min(
    Math.max(Number(rule?.mesAbreviacaoTamanho || 3), 1),
    12,
  );
  const baseName = months[Math.max(0, Math.min(monthIndex, 11))] || months[0];
  const formattedName =
    selectedFormat === "abreviado" ? baseName.slice(0, abbrSize) : baseName;
  const withoutAccent = rule?.mesSemAcento
    ? stripAccents(formattedName)
    : formattedName;
  return applyMonthCase(
    withoutAccent,
    forcedCase || rule?.mesCaixa || "minusculo",
  );
}

function formatDate(rule, date) {
  const separator = String(rule?.dataSeparador ?? "_");
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear());
  if (rule?.dataOrdem === "ymd") {
    return [year, month, day].join(separator);
  }
  if (rule?.dataOrdem === "mdy") {
    return [month, day, year].join(separator);
  }
  return [day, month, year].join(separator);
}

function buildTemplateContext(rule, periodType) {
  const monthIndex = periodType === "anual" ? 0 : 2;
  const sampleDate = new Date(2026, monthIndex, periodType === "anual" ? 1 : 5);
  const sampleStart = new Date(2026, periodType === "anual" ? 0 : 2, 1);
  const sampleEnd = new Date(2026, periodType === "anual" ? 11 : 2, 31);
  const routineSeparator = rule?.rotinaSeparador || "_";
  return {
    rotina: String(rule?.base || "03_11_40").replace(
      /[_\s-]+/g,
      routineSeparator,
    ),
    extensao: rule?.extensaoArquivo || ".csv",
    ano: "2026",
    ano_abreviado: "26",
    mes_nome: formatMonthName(rule, monthIndex),
    mes_nome_completo: formatMonthName(rule, monthIndex, "completo"),
    mes_nome_abreviado: formatMonthName(rule, monthIndex, "abreviado"),
    mes_nome_maiusculo: formatMonthName(rule, monthIndex, "completo", "maiusculo"),
    mes_nome_abreviado_maiusculo: formatMonthName(
      rule,
      monthIndex,
      "abreviado",
      "maiusculo",
    ),
    mes_numero: String(monthIndex + 1).padStart(2, "0"),
    mes_numero_sem_zero: String(monthIndex + 1),
    dia: periodType === "anual" ? "" : "05",
    dia_sem_zero: periodType === "anual" ? "" : "5",
    data: formatDate(rule, sampleDate),
    data_inicial: formatDate(rule, sampleStart),
    data_final: formatDate(rule, sampleEnd),
    sep_nome: rule?.separator || "",
    periodo_legado: periodType === "anual" ? "2026" : formatMonthName(rule, 2),
  };
}

function renderTemplate(template, context) {
  return String(template || "").replace(/\{([^{}]+)\}/g, (_, token) =>
    Object.prototype.hasOwnProperty.call(context, token) ? context[token] : "",
  );
}

function sanitizePreviewComponent(value) {
  return String(value || "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
}

export function buildDestinationPreviewPath(rule, periodType) {
  const context = buildTemplateContext(rule, periodType);
  const fileTemplates = {
    anual: rule?.arquivoTemplateAnual,
    mensal: rule?.arquivoTemplateMensal,
    diario: rule?.arquivoTemplateDiario,
    periodo: rule?.arquivoTemplatePeriodo,
    sem_periodo: rule?.arquivoTemplateSemPeriodo,
  };
  const folderTemplates = {
    anual: rule?.pastaTemplateAnual,
    mensal: rule?.pastaTemplateMensal,
    diario: rule?.pastaTemplateDiario,
    periodo: rule?.pastaTemplatePeriodo,
    sem_periodo: rule?.pastaTemplateSemPeriodo,
  };
  const folder = renderTemplate(folderTemplates[periodType], context)
    .split(/[\\/]/)
    .filter(Boolean)
    .map(sanitizePreviewComponent)
    .join("\\");
  const file = sanitizePreviewComponent(
    renderTemplate(fileTemplates[periodType], context),
  );
  const extension = rule?.extensaoArquivo || ".csv";
  const fileWithExtension = file.endsWith(extension) ? file : `${file}${extension}`;
  const basePath = String(rule?.caminho || "D:\\Relatorios\\Promax").replace(
    /[\\/]$/,
    "",
  );
  return [basePath, folder, fileWithExtension].filter(Boolean).join("\\");
}
