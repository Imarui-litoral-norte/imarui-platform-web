"use client";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ArrowDownAZ, ArrowUpAZ, Search, X } from "lucide-react";
import { auditFilterOptions, auditSelectedValues } from "../lib/journeyAudit";
import type { JourneyAudit } from "../model/types";
import { actionButtonClass, fieldClass, primaryButtonClass } from "./journeyControls";

export default function JourneyAuditColumnFilter({ column, label, options, selected, anchor, onApply, onClear, onSort, onClose }: {
  column: string; label: string; options: JourneyAudit["facets"][string]; selected?: string[];
  anchor: { left: number; top: number; theme: CSSProperties }; onApply: (values: string[] | undefined) => void;
  onClear: () => void; onSort: (direction: "asc" | "desc") => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(() => new Set(selected ?? options.map(option => option.value)));
  const ref = useRef<HTMLElement>(null), input = useRef<HTMLInputElement>(null);
  const visible = useMemo(() => auditFilterOptions(options, search), [options, search]);
  const allVisible = visible.length > 0 && visible.every(option => checked.has(option.value));
  useEffect(() => { input.current?.focus(); }, []);
  const id = `audit-filter-${column}`;
  return createPortal(<div className="fixed inset-0 z-[120]" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={ref} role="dialog" aria-modal="true" aria-labelledby={id}
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "Tab") {
          const nodes = ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]');
          if (!nodes?.length) return;
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }}
      className="fixed flex max-h-[calc(100vh-16px)] w-[min(340px,calc(100vw-16px))] flex-col rounded-xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-3 text-sm text-[var(--shell-text)] shadow-2xl"
      style={{ ...anchor.theme, left: anchor.left, top: anchor.top, maxHeight: `calc(100dvh - ${anchor.top + 8}px)` }}>
      <header className="mb-2 flex items-center justify-between gap-2"><h3 id={id} className="font-semibold">Filtrar {label}</h3><button type="button" className={actionButtonClass} aria-label="Fechar filtro da coluna" onClick={onClose}><X size={14} /></button></header>
      <button type="button" className={`${actionButtonClass} mb-1 justify-start`} onClick={() => onSort("asc")}><ArrowDownAZ size={15} /> Ordenar crescente · A → Z</button>
      <button type="button" className={`${actionButtonClass} mb-2 justify-start`} onClick={() => onSort("desc")}><ArrowUpAZ size={15} /> Ordenar decrescente · Z → A</button>
      <button type="button" className={`${actionButtonClass} mb-3 justify-start`} disabled={selected === undefined} onClick={onClear}>Limpar filtro de {label}</button>
      <label className="relative mb-2"><span className="sr-only">Pesquisar valores de {label}</span><Search size={14} className="pointer-events-none absolute left-3 top-3 text-[var(--shell-muted)]" /><input ref={input} className={`${fieldClass} pl-9`} value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar valores…" aria-label={`Pesquisar valores de ${label}`} /></label>
      <label className="flex items-center gap-2 rounded-lg px-2 py-2 font-medium"><input type="checkbox" checked={allVisible} disabled={!visible.length} onChange={() => setChecked(previous => { const next = new Set(previous); visible.forEach(option => allVisible ? next.delete(option.value) : next.add(option.value)); return next; })} /> Selecionar todos{search ? " os encontrados" : ""}</label>
      <div className="min-h-16 max-h-60 overflow-auto rounded-lg border border-[color:var(--shell-line)] py-1" aria-label={`Valores disponíveis de ${label}`}>
        {visible.map(option => <label key={option.value} className="flex cursor-pointer items-start gap-2 px-2 py-1.5 hover:bg-[var(--shell-surface-muted)]"><input className="mt-0.5 shrink-0" type="checkbox" checked={checked.has(option.value)} onChange={() => setChecked(previous => { const next = new Set(previous); if (next.has(option.value)) next.delete(option.value); else next.add(option.value); return next; })} /><span className="min-w-0 flex-1 break-words">{option.label}</span><span className="shrink-0 text-xs tabular-nums text-[var(--shell-muted)]">{option.count}</span></label>)}
        {!visible.length && <p className="px-3 py-4 text-xs text-[var(--shell-muted)]">Nenhum valor encontrado para os demais filtros.</p>}
      </div>
      <p className="mt-2 text-xs text-[var(--shell-muted)]">{search.trim() ? visible.filter(option => checked.has(option.value)).length : checked.size} selecionados{search.trim() ? " na pesquisa" : ""} · opções de todos os mapas compatíveis com os outros filtros.</p>
      <footer className="mt-3 flex justify-end gap-2"><button type="button" className={actionButtonClass} onClick={onClose}>Cancelar</button><button type="button" className={primaryButtonClass} onClick={() => onApply(auditSelectedValues(options, checked, search))}>Aplicar</button></footer>
    </section>
  </div>, document.body);
}
