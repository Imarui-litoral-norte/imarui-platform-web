"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { computeRecordMetrics } from "@/features/dpo/lib/dtoAnalytics";
import {
  formatDtoDate,
  formatDtoNumber,
  formatDtoPercentage,
  parseDtoDate,
} from "@/features/dpo/lib/dtoFormatters";
import type {
  DtoColumn,
  DtoRecord,
} from "@/features/dpo/model/dtoTypes";
import DtoApplicationDetails from "@/features/dpo/ui/dto/DtoApplicationDetails";
import {
  DtoButton,
  DtoPanel,
} from "@/features/dpo/ui/dto/DtoPrimitives";
import { Typography } from "@/shared/ui/typography";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const SELECT_CLASS_NAME =
  "h-9 rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] px-3 text-sm text-[var(--shell-text)] outline-none focus:border-[color:var(--shell-accent)]";

function getRecordKey(record: DtoRecord): string {
  return `${record.id}-${record.index}`;
}

function RecordSummary({ record, historicalDates }: { record: DtoRecord; historicalDates: boolean }) {
  const metrics = computeRecordMetrics(record);
  const historical = historicalDates && Boolean(record.historical_date);

  return (
    <>
      <div><span className="block text-xs text-[var(--shell-muted)]">{historical ? "Data histórica" : "Data"}</span><strong className={`mt-1 block text-sm ${historical ? "text-violet-700 dark:text-violet-300" : "text-[var(--shell-text)]"}`}>{formatDtoDate(historical ? record.historical_date : record.date)}{historical ? " · histórico" : ""}</strong></div>
      <div><span className="block text-xs text-[var(--shell-muted)]">Colaborador</span><strong className="mt-1 block break-words text-sm text-[var(--shell-text)]">{record.collaborator || "—"}</strong></div>
      <div><span className="block text-xs text-[var(--shell-muted)]">Aplicador</span><strong className="mt-1 block break-words text-sm text-[var(--shell-text)]">{record.manager || "—"}</strong></div>
      <div><span className="block text-xs text-[var(--shell-muted)]">Aderência</span><strong className="mt-1 block text-sm text-[var(--shell-accent)]">{formatDtoPercentage(metrics.adherence)}</strong></div>
      <div><span className="block text-xs text-[var(--shell-muted)]">Negativas</span><strong className="mt-1 block text-sm text-[var(--shell-danger)]">{formatDtoNumber(metrics.negative)}</strong></div>
    </>
  );
}

export default function DtoApplicationsHistory({
  columns,
  records,
  historicalDates = false,
}: {
  columns: DtoColumn[];
  records: DtoRecord[];
  historicalDates?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const showHistoricalDates = historicalDates;
  const orderedRecords = useMemo(
    () =>
      [...records].sort((left, right) => {
        const leftDate = parseDtoDate(left.date)?.getTime() ?? Number.NEGATIVE_INFINITY;
        const rightDate = parseDtoDate(right.date)?.getTime() ?? Number.NEGATIVE_INFINITY;
        return rightDate - leftDate || right.index - left.index;
      }),
    [records],
  );
  const totalPages = Math.max(1, Math.ceil(orderedRecords.length / pageSize));
  const normalizedPage = Math.min(page, totalPages);
  const startIndex = (normalizedPage - 1) * pageSize;
  const visibleRecords = orderedRecords.slice(startIndex, startIndex + pageSize);

  function toggleRecord(record: DtoRecord) {
    const key = getRecordKey(record);
    setExpandedKey((current) => (current === key ? null : key));
  }

  return (
    <DtoPanel className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Typography variant="overline">Histórico de aplicações</Typography>
          <Typography as="h2" variant="cardTitle" className="mt-2">
            Registros individuais
          </Typography>
          <Typography variant="caption" className="mt-1">
            A listagem mostra apenas campos gerenciais. Abra uma aplicação para
            consultar todos os metadados e respostas originais.
          </Typography>
        </div>
        <label className="flex items-center gap-2 text-xs text-[var(--shell-muted)]">
          Itens por página
          <select
            className={SELECT_CLASS_NAME}
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
      </div>

      {visibleRecords.length > 0 ? (
        <>
          <div className="mt-5 hidden overflow-hidden rounded-[22px] border border-[color:var(--shell-line)] md:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--shell-surface-muted)] text-xs text-[var(--shell-muted)]">
                <tr>
                  <th className="px-4 py-3 font-semibold">{showHistoricalDates ? "Data / histórico" : "Data"}</th>
                  <th className="px-4 py-3 font-semibold">Colaborador</th>
                  <th className="px-4 py-3 font-semibold">Aplicador</th>
                  <th className="px-4 py-3 font-semibold">Aderência</th>
                  <th className="px-4 py-3 font-semibold">Negativas</th>
                  <th className="px-4 py-3 text-right font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.map((record) => {
                  const recordMetrics = computeRecordMetrics(record);
                  const key = getRecordKey(record);
                  const expanded = expandedKey === key;
                  return (
                    <Fragment key={key}>
                      <tr className="border-t border-[color:var(--shell-line)] bg-[var(--shell-surface)]">
                        <td className={`px-4 py-3 ${showHistoricalDates && record.historical_date ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" : "text-[var(--shell-text)]"}`}>{showHistoricalDates && record.historical_date ? <>{formatDtoDate(record.historical_date)} <span className="text-xs">· histórico</span></> : formatDtoDate(record.date)}</td>
                        <td className="max-w-52 break-words px-4 py-3 text-[var(--shell-text)]">{record.collaborator || "—"}</td>
                        <td className="max-w-52 break-words px-4 py-3 text-[var(--shell-text)]">{record.manager || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--shell-accent)]">{formatDtoPercentage(recordMetrics.adherence)}</td>
                        <td className="px-4 py-3 font-semibold text-[var(--shell-danger)]">{formatDtoNumber(recordMetrics.negative)}</td>
                        <td className="px-4 py-3 text-right">
                          <DtoButton size="sm" aria-expanded={expanded} onClick={() => toggleRecord(record)}>
                            {expanded ? "Fechar" : "Ver"}
                            {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                          </DtoButton>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="border-t border-[color:var(--shell-line)] bg-[var(--shell-surface)]">
                          <td colSpan={6} className="p-4">
                            <DtoApplicationDetails columns={columns} record={record} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-5 space-y-3 md:hidden">
            {visibleRecords.map((record) => {
              const key = getRecordKey(record);
              const expanded = expandedKey === key;
              return (
                <article key={key} className="rounded-[22px] border border-[color:var(--shell-line)] bg-[var(--shell-surface-muted)] p-4">
                  <div className="grid grid-cols-2 gap-3"><RecordSummary record={record} historicalDates={showHistoricalDates} /></div>
                  <DtoButton className="mt-4 w-full" aria-expanded={expanded} onClick={() => toggleRecord(record)}>
                    {expanded ? "Fechar detalhes" : "Abrir detalhes"}
                    {expanded ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
                  </DtoButton>
                  {expanded ? <div className="mt-4"><DtoApplicationDetails columns={columns} record={record} /></div> : null}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--shell-line-strong)] bg-[var(--shell-surface-muted)] px-4 py-8 text-center text-sm leading-6 text-[var(--shell-muted)]">
          Nenhuma aplicação corresponde aos filtros atuais.
        </div>
      )}

      {orderedRecords.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--shell-surface-muted)] px-4 py-3">
          <p className="text-xs text-[var(--shell-muted)]">
            Página {normalizedPage} de {totalPages} · {orderedRecords.length} aplicação(ões)
          </p>
          <div className="flex gap-2">
            <DtoButton size="sm" disabled={normalizedPage <= 1} onClick={() => setPage(normalizedPage - 1)}>Anterior</DtoButton>
            <DtoButton size="sm" disabled={normalizedPage >= totalPages} onClick={() => setPage(normalizedPage + 1)}>Próxima</DtoButton>
          </div>
        </div>
      ) : null}
    </DtoPanel>
  );
}
