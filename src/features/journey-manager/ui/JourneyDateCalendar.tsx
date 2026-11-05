"use client";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { actionButtonClass, primaryButtonClass } from "./journeyControls";
type View = "days" | "months" | "years";
type Period = { from: string; to: string };
const iso = (year: number, month: number, day: number) => `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
const endOfMonth = (year:number,month:number) => iso(year,month,new Date(year,month+1,0).getDate());
const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const display = (value:string) => value.split("-").reverse().join("/");
export default function JourneyDateCalendar({from,to,onApply,onCancel}:{from:string;to:string;onApply:(from:string,to:string)=>void;onCancel:()=>void}) {
 const [view,setView]=useState<View>("days");
 const [cursor,setCursor]=useState(()=>({year:Number(from.slice(0,4)),month:Number(from.slice(5,7))-1}));
 const [selected,setSelected]=useState<Period>({from,to});
 const [anchor,setAnchor]=useState<Period|null>(null);
 const [hover,setHover]=useState<Period|null>(null);
 const [changed,setChanged]=useState(false);
 const combine=(a:Period,b:Period):Period=>({from:a.from<b.from?a.from:b.from,to:a.to>b.to?a.to:b.to});
 const preview=anchor&&hover?combine(anchor,hover):selected;
 function pick(period:Period) {
  setChanged(true);setHover(null);
  if(anchor){setSelected(combine(anchor,period));setAnchor(null);}
  else {setSelected(period);setAnchor(period);}
 }
 function switchView(next:View){setView(next);setAnchor(null);setHover(null);}
 function navigate(direction:number){setHover(null);setCursor(current=>{
  if(view!=="days")return {...current,year:Math.min(9990,Math.max(1,current.year+direction*(view==="years"?12:1)))};
  const date=new Date(current.year,current.month+direction,1);return {year:date.getFullYear(),month:date.getMonth()};
 });}
 const decade=Math.floor(cursor.year/12)*12;
 const cells: {label:string;aria:string;period:Period;muted?:boolean}[]=view==="days"?Array.from({length:42},(_,index)=>{
  const offset=(new Date(cursor.year,cursor.month,1).getDay()+6)%7;
  const day=new Date(cursor.year,cursor.month,index-offset+1);const value=iso(day.getFullYear(),day.getMonth(),day.getDate());
  return {label:String(day.getDate()),aria:display(value),period:{from:value,to:value},muted:day.getMonth()!==cursor.month};
 }):Array.from({length:12},(_,index)=>{
  const year=view==="years"?decade+index:cursor.year;
  return view==="months"?{label:months[index],aria:`${months[index]} de ${year}`,period:{from:iso(year,index,1),to:endOfMonth(year,index)}}:
   {label:String(year),aria:`Ano ${year}`,period:{from:iso(year,0,1),to:iso(year,11,31)}};
 });
 const columns=view==="days"?7:3,width=420,cellWidth=width/columns,cellHeight=view==="days"?42:55,top=view==="days"?28:0;
 return <div className="space-y-3">
 <p className="text-xs leading-5 text-[var(--shell-muted)]">Selecione um dia, mês ou ano. Para um intervalo, selecione o início e o fim e confirme. Todos os dias entre eles serão incluídos.</p>
 <div className="flex items-center justify-between gap-2">
 <button type="button" className={actionButtonClass} aria-label="Período anterior" onClick={()=>navigate(-1)}><ChevronLeft size={16}/></button>
 <span className="text-sm font-semibold">{view==="days"?`${months[cursor.month]} de ${cursor.year}`:view==="months"?cursor.year:`${decade} – ${decade+11}`}</span>
 <button type="button" className={actionButtonClass} aria-label="Próximo período" onClick={()=>navigate(1)}><ChevronRight size={16}/></button>
 </div>
 <div className="flex gap-1" aria-label="Visão do calendário">{([['days','Dias'],['months','Meses'],['years','Anos']] as const).map(([key,label])=><button type="button" key={key} aria-pressed={view===key} className={`${view===key?primaryButtonClass:actionButtonClass} !px-3 !py-1 text-xs`} onClick={()=>switchView(key)}>{label}</button>)}</div>
 <svg role="group" aria-label="Calendário de seleção do período" viewBox={`0 0 ${width} ${top+Math.ceil(cells.length/columns)*cellHeight}`} className="h-56 w-full select-none" onMouseLeave={()=>setHover(null)}>
 {view==="days"&&["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"].map((label,index)=><text key={label} x={index*cellWidth+cellWidth/2} y={17} textAnchor="middle" fontSize={11} fill="var(--shell-muted)">{label}</text>)}
 {cells.map((cell,index)=>{
 const x=(index%columns)*cellWidth,y=top+Math.floor(index/columns)*cellHeight;
 const active=cell.period.from<=preview.to&&cell.period.to>=preview.from;
 const edge=cell.period.from===preview.from||cell.period.to===preview.to;
 return <g key={cell.period.from} role="button" tabIndex={0} aria-label={cell.aria} aria-pressed={active}
 onClick={()=>pick(cell.period)} onMouseEnter={()=>{if(anchor)setHover(cell.period);}}
 onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();pick(cell.period);}}}
 className="cursor-pointer outline-none focus-visible:stroke-[var(--shell-accent)]">
 <rect x={x+3} y={y+3} width={cellWidth-6} height={cellHeight-6} rx={9} fill={active?(edge?"var(--shell-accent)":"var(--shell-accent-soft)"):"var(--shell-surface-muted)"} stroke={edge?"var(--shell-accent)":"var(--shell-line)"}/>
 <text x={x+cellWidth/2} y={y+cellHeight/2+4} textAnchor="middle" fontSize={13} fontWeight={active?700:400} fill={active&&edge?"var(--shell-contrast-ink)":cell.muted?"var(--shell-muted)":"var(--shell-text)"} stroke="none">{cell.label}</text></g>;
 })}</svg>
 <div aria-live="polite" className="rounded-xl bg-[var(--shell-surface-muted)] p-3 text-sm"><strong>{display(selected.from)}{selected.from!==selected.to?` – ${display(selected.to)}`:""}</strong><p className="mt-1 text-xs text-[var(--shell-muted)]">{anchor?"Pode confirmar esta seleção ou escolher o fim do intervalo.":"Período selecionado para consulta."}</p></div>
 <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--shell-line)] pt-3"><button type="button" className={actionButtonClass} onClick={()=>{setAnchor(null);setHover(null);setChanged(false);setSelected({from,to});}}>Restaurar</button><div className="flex gap-2"><button type="button" className={actionButtonClass} onClick={onCancel}>Cancelar</button><button type="button" className={primaryButtonClass} onClick={()=>onApply(selected.from,selected.to)}>{changed?"Confirmar período":"Confirmar"}</button></div></div>
 </div>;
}

