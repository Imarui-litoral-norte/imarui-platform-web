"use client";

import { useMemo } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { EChartsOption } from "echarts";
import DtoEChart from "@/features/dpo/ui/dto/DtoEChart";
import {
  formatDtoNumber,
  formatDtoPercentage,
  formatPercentagePointDelta,
} from "@/features/dpo/lib/dtoFormatters";
import type { DtoTimelinePoint, DtoTrend } from "@/features/dpo/model/dtoTypes";
import { DtoBadge, DtoPanel } from "@/features/dpo/ui/dto/DtoPrimitives";
import { Typography } from "@/shared/ui/typography";

export default function DtoTrendChart({
  hasDateColumn,
  timeline,
  trend,
}: {
  hasDateColumn: boolean;
  timeline: DtoTimelinePoint[];
  trend: DtoTrend | null;
}) {
  const option = useMemo<EChartsOption>(
    () => ({
      animationDuration: 450,
      color: ["#a78bfa", "#14b8a6"],
      grid: { top: 20, right: 46, bottom: 32, left: 46 },
      tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
      legend: {
        top: 0,
        right: 0,
        textStyle: { color: "#94a3b8", fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: timeline.map((point) => point.label),
        axisLine: { lineStyle: { color: "#334155" } },
        axisTick: { show: false },
        axisLabel: { color: "#94a3b8", hideOverlap: true },
      },
      yAxis: [
        {
          type: "value",
          min: 0,
          max: 100,
          axisLabel: { color: "#94a3b8", formatter: "{value}%" },
          splitLine: { lineStyle: { color: "#334155", type: "dashed" } },
        },
        {
          type: "value",
          min: 0,
          minInterval: 1,
          axisLabel: { color: "#94a3b8" },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: "Aplicações",
          type: "bar",
          yAxisIndex: 1,
          barMaxWidth: 34,
          data: timeline.map((point) => point.applications),
          itemStyle: { color: "#a78bfa", opacity: 0.65, borderRadius: [6, 6, 0, 0] },
          tooltip: { valueFormatter: (value) => formatDtoNumber(Number(value)) },
        },
        {
          name: "Aderência",
          type: "line",
          yAxisIndex: 0,
          connectNulls: false,
          smooth: 0.25,
          symbolSize: 7,
          data: timeline.map((point) => point.adherence),
          lineStyle: { width: 3, color: "#14b8a6" },
          itemStyle: { color: "#14b8a6" },
          areaStyle: { color: "rgba(20, 184, 166, 0.10)" },
          tooltip: { valueFormatter: (value) => formatDtoPercentage(Number(value)) },
        },
      ],
    }),
    [timeline],
  );

  return (
    <DtoPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography variant="overline">Evolução</Typography>
          <Typography as="h2" variant="cardTitle" className="mt-2">
            Aderência e volume por período
          </Typography>
          <Typography variant="caption" className="mt-1">
            A granularidade muda entre dia, semana e mês conforme o intervalo disponível.
          </Typography>
        </div>

        {trend ? (
          <DtoBadge
            tone={
              trend.direction === "worsening"
                ? "danger"
                : trend.direction === "improving"
                  ? "accent"
                  : "default"
            }
          >
            {trend.direction === "worsening" ? (
              <TrendingDown aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            ) : trend.direction === "improving" ? (
              <TrendingUp aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Minus aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            )}
            {formatPercentagePointDelta(trend.delta)}
          </DtoBadge>
        ) : null}
      </div>

      {timeline.length > 0 ? (
        <DtoEChart
          ariaLabel="Gráfico temporal de aderência e quantidade de aplicações"
          className="mt-5 h-72 min-w-0"
          option={option}
        />
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--shell-line-strong)] bg-[var(--shell-surface-muted)] px-4 py-8 text-center text-sm leading-6 text-[var(--shell-muted)]">
          {hasDateColumn
            ? "Não há datas válidas suficientes para montar a evolução temporal deste recorte."
            : "O campo de data não foi identificado com segurança; nenhum gráfico temporal foi fabricado."}
        </div>
      )}
    </DtoPanel>
  );
}
