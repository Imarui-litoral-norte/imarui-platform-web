"use client";

import { useCallback, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, RefreshCw, Settings2, TriangleAlert } from "lucide-react";
import { useDtoForm } from "@/features/dpo/model/useDtoForm";
import {
  formatDtoDate,
  formatDtoDateTime,
  formatDtoNumber,
  formatDtoPercentage,
} from "@/features/dpo/lib/dtoFormatters";
import type {
  DtoConfigurationUpdate,
  DtoFormDetail,
  DtoFormResource,
  DtoRefreshJob,
  DtoRefreshRequest,
} from "@/features/dpo/model/dtoTypes";
import DtoApplicationsHistory from "@/features/dpo/ui/dto/DtoApplicationsHistory";
import DtoCollaborators from "@/features/dpo/ui/dto/DtoCollaborators";
import DtoConfigurationPanel from "@/features/dpo/ui/dto/DtoConfigurationPanel";
import DtoCriticalQuestions from "@/features/dpo/ui/dto/DtoCriticalQuestions";
import DtoFilters from "@/features/dpo/ui/dto/DtoFilters";
import DtoTrendChart from "@/features/dpo/ui/dto/DtoTrendChart";
import DtoTrackingPanel from "@/features/dpo/ui/dto/DtoTrackingPanel";
import DtoPlanningPanel from "@/features/dpo/ui/dto/DtoPlanningPanel";
import DtoRefreshDialog from "@/features/dpo/ui/dto/DtoRefreshDialog";
import {
  DtoBadge,
  DtoButton,
  DtoMetricCard,
  DtoPanel,
  DtoStatePanel,
} from "@/features/dpo/ui/dto/DtoPrimitives";
import { Typography } from "@/shared/ui/typography";
import { useFormManagerConfig } from "@/features/dpo/model/formManagerConfig";

type ActiveTab = "analysis" | "tracking" | "planning" | "configuration";

function DtoQualityIssues({
  detail,
  onConfigure,
}: {
  detail: DtoFormDetail;
  onConfigure: () => void;
}) {
  const pendingFields = detail.configuration.fields_requiring_configuration;
  const technicalIssues = detail.quality_issues.filter(
    (issue) => issue.code !== "form_without_records",
  );
  if (technicalIssues.length === 0 && pendingFields === 0) return null;

  return (
    <DtoPanel className="border-[color:var(--shell-line-strong)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--shell-muted)]"
          />
          <div className="min-w-0">
            <Typography as="h2" variant="cardTitle">
              Parametrização necessária
            </Typography>
            <Typography variant="supportingText" className="mt-2">
              {pendingFields > 0
                ? `${pendingFields} campo(s) possuem valores ainda não parametrizados ou exigem revisão.`
                : "O serviço registrou alertas técnicos durante a leitura do formulário."} Valores desconhecidos permanecem fora da aderência até uma decisão explícita.
            </Typography>
            {technicalIssues.length > 0 ? (
              <details className="mt-3 text-sm text-[var(--shell-muted)]">
                <summary className="cursor-pointer font-semibold text-[var(--shell-text)]">
                  Ver detalhes técnicos ({technicalIssues.length})
                </summary>
                <ul className="mt-3 space-y-2">
                  {technicalIssues.map((issue, index) => (
                    <li
                      key={`${issue.code}-${issue.column_key || "form"}-${issue.record_index ?? index}`}
                      className="rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-3 py-2"
                    >
                      <span className="font-semibold text-[var(--shell-text)]">
                        {issue.column_key || "Formulário"}
                      </span>
                      : {issue.message}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        </div>
        <DtoButton tone="accent" onClick={onConfigure}>
          <Settings2 aria-hidden="true" />
          Configurar campos
        </DtoButton>
      </div>
    </DtoPanel>
  );
}

export default function DtoFormAnalysis({
  detail,
  onBack,
  onRetry,
  onRefreshData,
  onSaveConfiguration,
  resource,
}: {
  detail: DtoFormDetail;
  onBack: () => void;
  onRetry: () => Promise<unknown>;
  onRefreshData: (
    period: DtoRefreshRequest,
    onProgress: (job: DtoRefreshJob) => void,
    signal: AbortSignal,
  ) => Promise<DtoFormDetail>;
  onSaveConfiguration: (update: DtoConfigurationUpdate) => Promise<unknown>;
  resource: DtoFormResource;
}) {
  const config = useFormManagerConfig();
  const [activeTab, setActiveTab] = useState<ActiveTab>("analysis");
  const [configurationNeedsAttention, setConfigurationNeedsAttention] = useState(false);
  const [refreshDialogOpen, setRefreshDialogOpen] = useState(false);
  const closeRefreshDialog = useCallback(() => setRefreshDialogOpen(false), []);
  const analysis = useDtoForm(detail);
  const {
    attentionPoints,
    collaborators,
    filteredRecords,
    filterOptions,
    filters,
    metrics,
    questions,
    resetFilters,
    timeline,
    trend,
    updateFilter,
  } = analysis;

  function openConfiguration(needsAttention = false) {
    setConfigurationNeedsAttention(needsAttention);
    setActiveTab("configuration");
  }

  return (
    <div className="space-y-4">
      <DtoPanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-4xl">
            <DtoButton size="sm" onClick={onBack}>
              <ArrowLeft aria-hidden="true" />
              Voltar à visão geral
            </DtoButton>
            <Typography variant="overline" className="mt-5">
              {config.managerTitle}
            </Typography>
            <Typography as="h2" variant="sectionTitle" className="mt-2 break-words">
              {detail.form.name}
            </Typography>
            <Typography variant="supportingText" className="mt-2">
              A análise usa uma única configuração semântica e o mesmo conjunto de aplicações filtradas. As respostas originais do SAVI são preservadas.
            </Typography>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DtoButton
              tone="accent"
              disabled={resource.isRefreshing}
              onClick={() => setRefreshDialogOpen(true)}
            >
              <RefreshCw
                aria-hidden="true"
                className={resource.isRefreshing ? "animate-spin" : ""}
              />
              {resource.isRefreshing ? "Atualizando dados" : "Atualizar dados"}
            </DtoButton>
            {resource.isRefreshing ? <DtoBadge tone="accent">Atualizando</DtoBadge> : null}
            {detail.cached ? <DtoBadge>Cache do serviço</DtoBadge> : null}
            {detail.configuration.fields_requiring_configuration > 0 ? (
              <DtoBadge tone="danger">Configuração pendente</DtoBadge>
            ) : null}
            <span className="text-xs text-[var(--shell-muted)]">
              Carga: {formatDtoDateTime(detail.loaded_at)}
            </span>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] px-4 py-3 text-sm text-[var(--shell-muted)]">
          {detail.source_period_start && detail.source_period_end ? (
            <>
              Período do snapshot: <strong className="text-[var(--shell-text)]">{formatDtoDate(detail.source_period_start)} a {formatDtoDate(detail.source_period_end)}</strong>
              {detail.source_updated_at ? ` · exportado em ${formatDtoDateTime(detail.source_updated_at)}` : ""}
            </>
          ) : (
            <>Ainda não há snapshot local. Use <strong className="text-[var(--shell-text)]">Atualizar dados</strong> para escolher o primeiro período.</>
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Modo do formulário">
          <DtoButton
            role="tab"
            aria-selected={activeTab === "analysis"}
            tone={activeTab === "analysis" ? "accent" : "default"}
            onClick={() => setActiveTab("analysis")}
          >
            Análise
          </DtoButton>
          <DtoButton
            role="tab"
            aria-selected={activeTab === "tracking"}
            tone={activeTab === "tracking" ? "accent" : "default"}
            onClick={() => setActiveTab("tracking")}
          >
            <Activity aria-hidden="true" />
            Acompanhamento
          </DtoButton>
          <DtoButton
            role="tab"
            aria-selected={activeTab === "planning"}
            tone={activeTab === "planning" ? "accent" : "default"}
            onClick={() => setActiveTab("planning")}
          >
            <CalendarDays aria-hidden="true" />
            Planejamento
          </DtoButton>
          <DtoButton
            role="tab"
            aria-selected={activeTab === "configuration"}
            tone={activeTab === "configuration" ? "accent" : "default"}
            onClick={() => openConfiguration(false)}
          >
            <Settings2 aria-hidden="true" />
            Configuração
          </DtoButton>
        </div>

        {resource.error ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)] px-4 py-3 text-sm text-[var(--shell-danger)]">
            <p className="min-w-0 flex-1">
              A última tentativa falhou; os dados anteriores continuam em uso. {resource.error}
            </p>
            <DtoButton tone="danger" size="sm" onClick={() => void onRetry()}>
              <RefreshCw aria-hidden="true" />
              Repetir carga
            </DtoButton>
          </div>
        ) : null}
      </DtoPanel>

      {refreshDialogOpen ? (
        <DtoRefreshDialog
          formName={detail.form.name}
          onClose={closeRefreshDialog}
          onRefresh={onRefreshData}
        />
      ) : null}

      {activeTab === "configuration" ? (
        <DtoConfigurationPanel
          key={`${detail.configuration.revision}-${configurationNeedsAttention ? "attention" : "all"}`}
          configuration={detail.configuration}
          initialNeedsAttention={configurationNeedsAttention}
          onSave={onSaveConfiguration}
        />
      ) : activeTab === "tracking" ? (
        <DtoTrackingPanel
          detail={detail}
          onConfigure={() => openConfiguration(false)}
        />
      ) : activeTab === "planning" ? (
        <DtoPlanningPanel detail={detail} />
      ) : (
        <>
          <DtoQualityIssues detail={detail} onConfigure={() => openConfiguration(true)} />

          {detail.records.length === 0 ? (
            <DtoStatePanel
              title={detail.source_updated_at ? "Nenhuma resposta no período" : "Dados ainda não atualizados"}
              description={
                detail.source_updated_at
                  ? "O arquivo foi validado, mas o SAVI não devolveu aplicações para o período escolhido. Você pode selecionar outro intervalo em Atualizar dados."
                  : `O formulário de ${config.singular} foi descoberto no SAVI, mas ainda não possui um snapshot local. Escolha o período no botão Atualizar dados.`
              }
            />
          ) : (
            <>
              <DtoFilters
                collaborators={filterOptions.collaborators}
                filteredCount={filteredRecords.length}
                filters={filters}
                hasCollaboratorColumn={filterOptions.hasCollaboratorColumn}
                hasDateColumn={filterOptions.hasDateColumn}
                hasManagerColumn={filterOptions.hasManagerColumn}
                managers={filterOptions.managers}
                onReset={resetFilters}
                onUpdate={updateFilter}
                totalCount={detail.records.length}
              />

              <section aria-labelledby="dto-kpis-title">
                <h2 id="dto-kpis-title" className="sr-only">Indicadores de {config.singular}</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <DtoMetricCard label="Aplicações" value={formatDtoNumber(metrics.applications)} hint="No recorte atual." />
                  <DtoMetricCard label="Aderência" tone="accent" value={formatDtoPercentage(metrics.adherence)} hint="Positivas / (positivas + negativas)." />
                  <DtoMetricCard label="Respostas positivas" tone="accent" value={formatDtoNumber(metrics.positive)} />
                  <DtoMetricCard label="Respostas negativas" tone={metrics.negative > 0 ? "danger" : "default"} value={formatDtoNumber(metrics.negative)} />
                  <DtoMetricCard label="Colaboradores" value={metrics.collaborators === null ? "Não identificado" : formatDtoNumber(metrics.collaborators)} />
                  <DtoMetricCard label="Última aplicação" value={metrics.hasDateColumn ? metrics.lastApplication ? formatDtoDate(metrics.lastApplication) : "Sem data válida" : "Não identificada"} />
                </div>
              </section>

              <DtoPanel className="p-5 sm:p-6">
                <Typography variant="overline">Oportunidades prioritárias</Typography>
                <Typography as="h2" variant="cardTitle" className="mt-2">
                  Pontos de atenção derivados dos dados
                </Typography>
                <Typography variant="caption" className="mt-1">
                  Regras determinísticas: maior volume negativo por pergunta, piora entre períodos comparáveis, recorrência real e valores não parametrizados.
                </Typography>
                {attentionPoints.length > 0 ? (
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {attentionPoints.map((point) => (
                      <article
                        key={point.id}
                        className={`rounded-[22px] border p-4 ${point.tone === "danger" ? "border-[color:var(--shell-danger)] bg-[var(--shell-danger-bg)]" : "border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)]"}`}
                      >
                        <h3 className={`text-sm font-semibold ${point.tone === "danger" ? "text-[var(--shell-danger)]" : "text-[var(--shell-text)]"}`}>{point.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--shell-muted)]">{point.description}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--shell-line-strong)] bg-[var(--shell-surface-muted)] px-4 py-6 text-center text-sm text-[var(--shell-muted)]">
                    Não há evidência suficiente neste recorte para gerar um ponto de atenção determinístico.
                  </div>
                )}
              </DtoPanel>

              <DtoTrendChart
                hasDateColumn={filterOptions.hasDateColumn}
                timeline={timeline}
                trend={trend}
              />

              <div className="grid items-start gap-4 xl:grid-cols-2">
                <DtoCriticalQuestions questions={questions} />
                <DtoCollaborators
                  collaborators={collaborators}
                  columns={detail.columns}
                  filters={filters}
                  formName={detail.form.name}
                  records={filteredRecords}
                />
              </div>

              <DtoApplicationsHistory columns={detail.columns} records={filteredRecords} historicalDates={Boolean(config.supportsHistoricalDate)} />
            </>
          )}
        </>
      )}
    </div>
  );
}
