"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Indicator, JourneyItem, TrItem } from "../model/types";
import { formatDateTime, groupByMap, mapTrFact, primaryResult, statusLabel } from "../lib/journeyPresentation";
import { formatClockDuration, mapDriver, mapHelperCount, mapRepresentative,
  timelineView, type SegmentKind, type TimelineView } from "../lib/journeyTimeline";
import { ExpurgeContext, JourneyDetails } from "./JourneyDetails";
import { actionButtonClass } from "./journeyControls";

type Group = ReturnType<typeof groupByMap<JourneyItem>>[number];

function segmentColor(kind: SegmentKind, negative: boolean): string {
  if (kind === "tml") return "bg-teal-400";
  if (kind === "tr") return "bg-sky-500";
  if (kind === "ti") return "bg-violet-400";
  if (negative) return kind === "load" || kind === "physical" ? "bg-rose-200" : "bg-orange-300";
  return kind === "load" || kind === "physical" ? "bg-teal-200" : "bg-emerald-300";
}

function TimelineBar({ indicator, view, label }: {
  indicator: Indicator; view: TimelineView; label: string;
}) {
  const negative = view.closed ? view.finalTone === "negative" : view.exceeded;
  const fillColor = negative ? "bg-rose-500" : "bg-emerald-500";
  const trackColor = view.started ? "bg-slate-500/25" : "bg-slate-800";
  const state = !view.started ? "sem início" : view.closed ? "fechado" : "em andamento";
  return <div className="min-w-0 flex-1">
    <div role="img" aria-label={`${label}: ${state}, ${formatClockDuration(view.seconds)}`}
      className={`relative h-4 overflow-hidden rounded-full ${trackColor}`}>
      {indicator !== "jl" && view.started && <div className={`absolute inset-y-0 left-0 ${fillColor}`}
        style={{ width: `${view.progress}%` }} />}
      {view.segments.map((segment) => <div key={`${segment.kind}:${segment.left}`}
        title={segment.label} className={`absolute inset-y-0 ${segmentColor(segment.kind, negative)}`}
        style={{ left: `${segment.left}%`, width: `${segment.width}%` }} />)}
      {view.started && !view.closed && view.progress <= 2 && indicator !== "jl" &&
        <span className="absolute inset-y-0 left-0 w-1 rounded-full bg-emerald-300" />}
    </div>
    {indicator === "jl" && view.segments.length > 0 && <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--shell-muted)]">
      {["tml", "tr", "ti"].map((kind) => view.segments.some((segment) => segment.kind === kind) &&
        <span key={kind} className="inline-flex items-center gap-1"><i aria-hidden className={`h-2 w-2 rounded-full ${segmentColor(kind as SegmentKind, false)}`} />{kind.toUpperCase()}</span>)}
    </div>}
  </div>;
}

export function JourneyMapRow({ group, indicator, now, onOpen }: {
  group: Group; indicator: Indicator; now: number; onOpen: () => void;
}) {
  const driver = mapDriver(group);
  const driverCode = driver?.context.employeeCode ?? group.items[0]?.context.mapDriverCode;
  const driverName = driver?.context.employeeName ??
    (driverCode != null ? `Motorista #${driverCode}` : "Motorista não informado");
  const helperCount = mapHelperCount(group);
  const vehicle = driver?.context.vehicle ?? group.items[0]?.context.vehicle;
  const representative = mapRepresentative(group, indicator);
  const view = timelineView(representative, indicator, now);
  const result = representative ? primaryResult(representative, indicator) : null;
  const durationColor = !view.closed ? "text-slate-500 dark:text-slate-300" :
    view.finalTone === "positive" ? "text-emerald-700 dark:text-emerald-300" :
      view.finalTone === "negative" ? "text-rose-700 dark:text-rose-300" :
        "text-slate-500 dark:text-slate-300";
  return <article className="grid gap-4 rounded-[22px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 lg:grid-cols-[minmax(9rem,0.65fr)_minmax(12rem,1fr)_minmax(14rem,2fr)_auto_auto] lg:items-center">
    <div className="min-w-0">
      <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--shell-muted)]">Mapa</span>
      <strong className="text-lg leading-tight">{group.map ?? "—"}</strong>
      <span className="block text-xs text-[var(--shell-muted)]">Cód. veículo {vehicle ?? "—"}</span>
    </div>
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold" title={driverName}>{driverName}</p>
      <p className="mt-1 text-xs text-[var(--shell-muted)]">{helperCount} ajudante{helperCount === 1 ? "" : "s"} no recorte</p>
    </div>
    <TimelineBar indicator={indicator} view={view} label={`Barra de ${indicator.toUpperCase()} do mapa ${group.map ?? "sem número"}`} />
    <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
      <span className="text-[11px] text-[var(--shell-muted)] lg:hidden">Tempo {indicator.toUpperCase()}</span>
      <span className={`text-sm font-semibold tabular-nums ${durationColor}`}
        title={result ? `${statusLabel(result.lifecycleStatus)} · ${statusLabel(result.targetStatus)}` : "Sem duração do motorista no recorte"}>
        {formatClockDuration(view.seconds)}
      </span>
    </div>
    <button type="button" className={actionButtonClass} onClick={onOpen}
      aria-label={`Abrir detalhes de ${indicator.toUpperCase()} do mapa ${group.map ?? "sem número"}`}>
      Abrir detalhes
    </button>
  </article>;
}

export function JourneyMapDialog({ group, indicator, now, onClose }: {
  group: Group; indicator: Indicator; now: number; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const fact = indicator === "tr" ? mapTrFact(group as Group & { items: TrItem[] }) : undefined;
  const vehicle = group.items[0]?.context.vehicle;
  return <dialog ref={dialogRef} onClose={() => { if (!dialogRef.current?.open) onClose(); }}
    aria-labelledby="journey-map-dialog-title"
    className="m-auto max-h-[92vh] w-[min(96vw,76rem)] overflow-y-auto rounded-[26px] border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-0 text-[var(--shell-text)] shadow-2xl backdrop:bg-slate-950/75">
    <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--shell-accent)]">{indicator.toUpperCase()} · detalhes do mapa</p>
        <h2 id="journey-map-dialog-title" className="mt-1 text-xl font-semibold">Mapa {group.map ?? "não informado"}</h2>
        <p className="mt-1 text-xs text-[var(--shell-muted)]">{group.date} · Veículo {vehicle ?? "—"} · {group.mapOrigin ?? "origem não informada"}</p>
      </div>
      <button type="button" className={`${actionButtonClass} w-9 px-0`} onClick={() => dialogRef.current?.close()} aria-label="Fechar detalhes do mapa"><X size={18} /></button>
    </div>
    <div className="space-y-5 p-4 sm:p-6">
      {indicator === "tr" && fact && <>
        <JourneyDetails indicator="tr" item={fact} now={now} showExpurge={false} />
        <section className="rounded-2xl border border-[color:var(--shell-line)] p-4">
          <h3 className="font-semibold">Contexto do mapa</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div><dt className="text-[var(--shell-muted)]">Placa</dt><dd>{fact.context.plate ?? "—"}</dd></div>
            <div><dt className="text-[var(--shell-muted)]">Frota</dt><dd>{fact.context.fleet ?? "—"}</dd></div>
            <div><dt className="text-[var(--shell-muted)]">Supervisor</dt><dd>{fact.context.routeSupervisorName ?? fact.context.routeSupervisorCode ?? "—"}</dd></div>
            <div><dt className="text-[var(--shell-muted)]">Retorno</dt><dd>{formatDateTime(fact.mapReturnAt)}</dd></div>
          </dl>
        </section>
      </>}
      <section>
        <h3 className="font-semibold">Equipe associada</h3>
        <div className="mt-3 grid gap-3">{group.items.map((item, index) =>
          <article key={`${item.context.employeeCode ?? "unknown"}:${item.context.role ?? "unknown"}:${index}`}
            className="rounded-2xl border border-[color:var(--shell-line)] p-4">
            <h4 className="font-semibold">{item.context.employeeName ?? `Colaborador ${item.context.employeeCode ?? "não informado"}`} <span className="text-sm font-normal text-[var(--shell-muted)]">· {item.context.role ?? "função não informada"}</span></h4>
            <div className="mt-3">{indicator === "tr" ? <ExpurgeContext item={item} /> :
              <JourneyDetails indicator={indicator} item={item} now={now} />}</div>
          </article>)}</div>
      </section>
    </div>
  </dialog>;
}
