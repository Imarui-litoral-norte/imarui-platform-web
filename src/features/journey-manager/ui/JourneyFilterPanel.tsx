"use client";
import { useEffect, useState } from "react";
import { journeyApi } from "../api/journeyApi";
import type { JourneyQuery, JourneyViewFilters, JourneyFilterOptions } from "../model/types";
import { actionButtonClass, fieldClass, primaryButtonClass } from "./journeyControls";
export const emptyViewFilters = (): JourneyViewFilters => ({origin:"all", excludedVehicles:[], excludedEmployees:[], includedEmployees:[], expurgeType:"", expurgeReason:"", expurgeObservation:""});
function Choices({title, options, selected, onChange}: {title:string; options:Record<string,string>; selected:string[]; onChange:(value:string[])=>void}) {
 const [search,setSearch]=useState("");
 return <details className="rounded-xl border border-[color:var(--shell-line)] p-3"><summary className="cursor-pointer text-sm font-semibold">{title} · {selected.length}</summary>
 <input aria-label={`Pesquisar ${title}`} placeholder="Pesquisar…" className={`${fieldClass} my-2`} value={search} onChange={e=>setSearch(e.target.value)}/>
 <div className="max-h-44 space-y-2 overflow-y-auto">{Object.entries({...Object.fromEntries(selected.map(v=>[v,options[v] ?? v])),...options}).filter(([,label])=>label.toLocaleLowerCase().includes(search.toLocaleLowerCase())).map(([value,label])=><label key={value} className="flex items-start gap-2 text-xs"><input type="checkbox" checked={selected.includes(value)} onChange={e=>onChange(e.target.checked?[...selected,value]:selected.filter(v=>v!==value))}/>{label}</label>)}</div>
 {selected.length>0&&<button type="button" className={`${actionButtonClass} mt-2`} onClick={()=>onChange([])}>Limpar seleção</button>}</details>;
}
export default function JourneyFilterPanel({query,onApply}:{query:JourneyQuery;onApply:(query:JourneyQuery)=>void}) {
 const [draft,setDraft]=useState(query);
 const [options,setOptions]=useState<JourneyFilterOptions>({vehicles:{},employees:{},types:{},reasons:{},observations:{}});
 const [notice,setNotice]=useState("");
 useEffect(()=>{queueMicrotask(()=>setDraft(query));},[query]);
 useEffect(()=>{try { const saved=JSON.parse(localStorage.getItem("journey-manual-exclusions")??"null"); if(saved)queueMicrotask(()=>setDraft(current=>({...current,viewFilters:{...emptyViewFilters(),...current.viewFilters,excludedVehicles:saved.vehicles??[],excludedEmployees:saved.employees??[]}}))); } catch {} },[]);
 useEffect(()=>{const controller=new AbortController(); queueMicrotask(()=>setNotice("Carregando opções do período…")); journeyApi.filterOptions(query,controller.signal).then(value=>{setOptions(value);setNotice("");}).catch(e=>{if(!controller.signal.aborted)setNotice(e.message);});return()=>controller.abort();},[query]);
 const filters=draft.viewFilters??emptyViewFilters();
 const change=(patch:Partial<JourneyViewFilters>)=>setDraft({...draft,viewFilters:{...filters,...patch}});
 return <aside aria-label="Filtros globais da análise" className="sticky top-4 flex max-h-[calc(100dvh-6rem)] flex-col rounded-2xl border border-[color:var(--shell-line)] bg-[var(--shell-surface)] p-4">
 <h2 className="text-lg font-semibold">Filtros da análise</h2><p className="my-2 text-xs text-[var(--shell-muted)]">Aplicados aos indicadores, gráficos e auditoria. As exclusões manuais alteram apenas a visualização.</p>
 <form className="flex min-h-0 flex-col" onSubmit={e=>{e.preventDefault();localStorage.setItem("journey-manual-exclusions",JSON.stringify({vehicles:filters.excludedVehicles,employees:filters.excludedEmployees}));onApply(draft);}}><div className="min-h-0 space-y-3 overflow-y-auto pr-1">
 <label className="block text-sm">Origem<select className={fieldClass} value={filters.origin} onChange={e=>change({origin:e.target.value as JourneyViewFilters["origin"]})}><option value="all">LIVE e histórico</option><option value="LIVE">Operacional LIVE</option><option value="HISTORICO">Histórico fechado</option></select></label>
 {query.indicator!=="tr"&&<label className="block text-sm">Modo<select className={fieldClass} value={draft.mode} onChange={e=>setDraft({...draft,mode:e.target.value as JourneyQuery["mode"]})}><option value="ponto">Ponto</option><option value="mpd">MPD</option></select></label>}
 <label className="block text-sm">Mapa<input className={fieldClass} type="number" min="1" placeholder="Todos" value={draft.map} onChange={e=>setDraft({...draft,map:e.target.value})}/></label>
 <label className="block text-sm">Função<select className={fieldClass} value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value as JourneyQuery["role"]})}><option value="all">Todos</option><option value="motorista">Motoristas</option><option value="ajudante">Ajudantes</option></select></label>
 <label className="block text-sm">Expurgo da base<select className={fieldClass} value={draft.expurge} onChange={e=>setDraft({...draft,expurge:e.target.value as JourneyQuery["expurge"]})}><option value="all">Todos</option><option value="not_expurged">Não expurgados</option><option value="expurged">Expurgados</option></select></label>
 {([['expurgeType','Tipo de expurgo','types'],['expurgeReason','Justificativa do expurgo','reasons'],['expurgeObservation','Observações do expurgo','observations']] as const).map(([key,label,source])=><label key={key} className="block text-sm">{label}<input className={fieldClass} list={`journey-${key}`} placeholder="Todos · pesquisar texto" value={filters[key]} onChange={e=>change({[key]:e.target.value})}/><datalist id={`journey-${key}`}>{Object.keys(options[source]).map(v=><option key={v} value={v}/>)}</datalist></label>)}
 <Choices title="Excluir veículos" options={options.vehicles} selected={filters.excludedVehicles} onChange={excludedVehicles=>change({excludedVehicles})}/>
 <Choices title="Excluir matrículas" options={{__blank__:"(Matrícula vazia)",...options.employees}} selected={filters.excludedEmployees} onChange={excludedEmployees=>change({excludedEmployees})}/>
 <Choices title="Mostrar somente matrículas" options={{__blank__:"(Matrícula vazia)",...options.employees}} selected={filters.includedEmployees} onChange={includedEmployees=>change({includedEmployees})}/>
 <p className="text-xs text-[var(--shell-muted)]">{notice||"Opções de todos os mapas do período. Lista sem seleção inclui todos; exclusões têm prioridade."}</p>
 </div><div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--shell-line)] pt-3"><button type="button" className={actionButtonClass} onClick={()=>setDraft({...query,map:"",employeeCode:"",role:"all",expurge:"all",viewFilters:emptyViewFilters()})}>Limpar</button><button className={primaryButtonClass} type="submit">Aplicar filtros</button></div></form></aside>;
}
