// CASA MEA — o singură pagină-hub cu secțiuni; pe mobil se vede DOAR secțiunea aleasă,
// pe desktop: rail stânga + conținut + panou de stare sticky.
import React, { useEffect, useRef, useState } from "react";
import {
  LayoutGrid, FileText, ClipboardList, Box, ShieldAlert, CalendarClock, Building2, IdCard, ChevronDown, Check, Settings2,
} from "lucide-react";
import { Card, Overline, Primary, Secondary, Chip, Bar, HelpDot, Ring } from "./ui3";
import { HouseMapV3 } from "./HouseMapV3";
import { buildIndicators, timeAgo } from "./data3";
import { SectionCarte, SectionDosar, SectionEchipamente, SectionRiscuri, SectionCalendar, SectionBloc, SectionPasaport } from "./HouseSectionsV3";

export const SECTIONS = [
  { id: "rezumat", label: "Rezumat", icon: LayoutGrid, sub: "harta A→G și indicatorii" },
  { id: "carte", label: "Cartea casei", icon: FileText, sub: "documentele locuinței" },
  { id: "dosar", label: "Dosar tehnic", icon: ClipboardList, sub: "clădire, detalii, diagnostice" },
  { id: "echipamente", label: "Echipamente & Twin", icon: Box, sub: "instalații și Digital Twin" },
  { id: "riscuri", label: "Sănătate & riscuri", icon: ShieldAlert, sub: "House Health, riscuri, lucrări" },
  { id: "calendar", label: "Calendar", icon: CalendarClock, sub: "revizii periodice" },
  { id: "bloc", label: "Blocul meu", icon: Building2, sub: "vecini și campanii" },
  { id: "pasaport", label: "Pașaport", icon: IdCard, sub: "profil public, partajare" },
];
// Aliasuri din vechile deep-link-uri (Property Hub)
const SECTION_ALIAS = { twin: "echipamente", istoric: "riscuri" };

// Indicatorii casei — toate scorurile, într-un singur loc, fiecare cu „?"
const Indicators = ({ d, explain }) => {
  const inds = buildIndicators(d);
  return (
    <Card tid="v3-indicators">
      <div className="flex items-center gap-2"><Overline>Indicatorii casei</Overline><span className="text-[11px] text-slate-400">· apasă ? ca să înțelegi fiecare scor</span></div>
      <div className="mt-3 grid grid-cols-2 lg:grid-cols-3 gap-2">
        {inds.map(i => (
          <div key={i.id} className="rounded-2xl bg-slate-50 p-3 min-h-[92px] flex flex-col" data-testid={`v3-ind-${i.id}`}>
            <div className="flex items-start justify-between gap-1">
              <div className="text-[11px] font-bold text-slate-600 leading-tight">{i.label}</div>
              <HelpDot onClick={() => explain(i)} tid={`v3-ind-help-${i.id}`} />
            </div>
            <div className="mt-auto flex items-end gap-1">
              <span className="xos-num text-2xl leading-none text-slate-900 font-medium">{i.value}</span>
              <span className="text-[11px] text-slate-400 mb-0.5">{i.suffix || (i.sub ? i.sub : i.max ? `/${i.max}` : "")}</span>
            </div>
            <div className="mt-2"><Bar pct={i.pct} h="h-1" /></div>
          </div>
        ))}
      </div>
    </Card>
  );
};

// Evenimentele de sistem se traduc în limbaj uman (fără jargon EN)
const EVENT_LABELS_RO = [
  [/twin\s*dna|dna attribute/i, "Detalii actualizate în cartea casei"],
  [/recommendation created/i, "Recomandare nouă pentru casa ta"],
  [/recommendation/i, "Recomandare actualizată"],
  [/document/i, "Document adăugat în cartea casei"],
  [/audit/i, "Audit tehnic actualizat"],
  [/twin/i, "Digital Twin actualizat"],
  [/sensor/i, "Senzor actualizat"],
];
const humanEvent = (title) => {
  if (!title) return "Actualizare în cartea casei";
  const hit = EVENT_LABELS_RO.find(([re]) => re.test(title));
  if (hit) return hit[1];
  if (/_/.test(title) || /\b(updated|created|deleted|added|changed|status)\b/i.test(title)) return "Actualizare în cartea casei";
  return title;
};
const groupTimeline = (items) => {
  const out = [];
  (items || []).forEach((ev) => {
    const label = humanEvent(ev.title); const last = out[out.length - 1];
    if (last && last.label === label) last.count += 1; else out.push({ ...ev, label, count: 1 });
  });
  return out;
};
const CAPS = { identity: "Identitate", health: "Sănătate", twin: "Digital Twin", works: "Lucrări", financial: "Financiar", documents: "Documente", relations: "Relații", maintenance: "Mentenanță", sensors: "Senzori", recommendations: "Recomandări AI" };

// Valoarea documentată (PVI) + profilul digital (capabilități, ultimele evenimente)
const PviDetails = ({ dna }) => {
  const [open, setOpen] = useState(false);
  const pvi = dna?.pvi; if (!pvi) return null;
  return (
    <Card tid="dna-card">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 text-left" data-testid="v3-pvi-toggle">
        <Ring value={pvi.score} size={56} />
        <div className="flex-1 min-w-0"><div className="text-sm font-black text-slate-900">Valoarea documentată (PVI)</div><div className="text-xs text-slate-500">Cât de bine poți dovedi valoarea casei · {pvi.reasons?.filter(r => r.done).length}/{pvi.reasons?.length} criterii{pvi.delta_6m > 0 ? ` · +${pvi.delta_6m} în 6 luni` : ""}</div></div>
        <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 space-y-3" data-testid="pvi-reasons">
          <div className="space-y-1.5">
            {pvi.reasons.map(r => (
              <div key={r.key} className="flex items-center gap-2 text-sm" data-testid={`pvi-reason-${r.key}`}><span className={`w-5 h-5 rounded-full flex items-center justify-center ${r.done ? "bg-[#ccff00]" : "bg-slate-100"}`}><Check className={`w-3 h-3 ${r.done ? "text-black" : "text-slate-300"}`} strokeWidth={3} /></span><span className={`flex-1 ${r.done ? "text-slate-700 font-semibold" : "text-slate-500"}`}>{r.label}</span><span className="text-xs font-mono text-slate-400">{r.points}/{r.max}</span></div>
            ))}
          </div>
          <div className="pt-3 border-t border-slate-100">
            <div className="flex flex-wrap gap-1.5" data-testid="dna-capabilities">
              {Object.entries(CAPS).map(([k, label]) => <Chip key={k} tone={dna.capabilities?.[k]?.populated ? "lime" : "slate"} tid={`dna-cap-${k}`}>{label}</Chip>)}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400" data-testid="dna-completeness">Profil digital {dna.dna_completeness}% complet</div>
          </div>
          {dna.timeline?.length > 0 && (
            <div className="pt-3 border-t border-slate-100" data-testid="dna-timeline">
              <Overline>Ultimele evenimente</Overline>
              <div className="mt-2 space-y-1.5">
                {groupTimeline(dna.timeline).slice(0, 5).map((ev, i) => (
                  <div key={i} className="flex items-start gap-2.5"><span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 bg-[#166534]" /><div className="min-w-0 flex-1"><div className="text-xs font-semibold text-slate-700 truncate">{ev.label}{ev.count > 1 ? ` ×${ev.count}` : ""}</div><div className="text-[10px] text-slate-400">{timeAgo(ev.timestamp)}</div></div></div>
                ))}
              </div>
            </div>
          )}
          <p className="text-[11px] text-slate-400">Fiecare lucrare finalizată prin PropManage adaugă automat garanții, documentație și puncte de valoare.</p>
        </div>
      )}
    </Card>
  );
};

// Panou de stare (desktop, sticky): UN scor + pasul următor
const StatusPanel = ({ d, goSection }) => {
  const c = d.completeness; if (!c) return null;
  return (
    <Card tid="hub-status-panel">
      <Overline>Cartea casei</Overline>
      <div className="mt-2 flex items-end gap-1"><span className="xos-num text-5xl leading-none text-slate-900" data-testid="hub-status-score">{c.score}</span><span className="text-sm font-bold text-slate-400 mb-1">%</span></div>
      <div className="mt-2"><Bar pct={c.score} h="h-2" /></div>
      <div className="mt-1.5 text-[11px] text-slate-400">{c.docs_count} documente · {c.missing?.length ?? 0} lucruri de completat</div>
      {c.next_step && <button type="button" onClick={() => goSection("carte")} className="mt-3 w-full text-left rounded-2xl bg-[#F6FEE7] border border-[#D2F2DC] p-3 min-h-[56px]" data-testid="hub-status-next-step"><div className="text-[10px] font-black uppercase text-[#166534]">Pasul următor</div><div className="text-xs font-bold text-slate-800 mt-0.5 flex items-center gap-2">{c.next_step.label}<Chip tone="dark">+{c.next_step.expected_gain}%</Chip></div></button>}
    </Card>
  );
};

export const HouseV3 = ({ d, prop, properties, section, setSection, explain, act, go, setSelectedPropId, reloadRequests }) => {
  const chipsRef = useRef(null);
  const secId = SECTION_ALIAS[section] || section;
  useEffect(() => { chipsRef.current?.querySelector(`[data-sec="${secId}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }); }, [secId]);
  if (!prop) {
    return (
      <div className="px-5 lg:px-0 lg:max-w-2xl" data-testid="v2-property-empty">
        <Card><Building2 className="w-8 h-8 text-slate-300" /><p className="mt-2 text-sm font-black text-slate-900">Nicio proprietate încă</p><p className="text-xs text-slate-500 mt-0.5">Adaugă prima proprietate ca să deblochezi Casa mea.</p><Primary className="mt-3" onClick={() => act("addProperty")} tid="v2-prop-empty-cta">Adaugă proprietatea</Primary></Card>
      </div>
    );
  }
  const cur = SECTIONS.find(s => s.id === secId) || SECTIONS[0];
  const goSection = (id) => { setSection(id); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const body = {
    rezumat: <div className="space-y-4" data-testid="v3-sec-rezumat"><HouseMapV3 completeness={d.completeness} mode="full" onGo={goSection} tid="v3-house-map-full" /><Indicators d={d} explain={explain} /><PviDetails dna={d.dna} /></div>,
    carte: <SectionCarte d={d} prop={prop} act={act} goSection={goSection} />,
    dosar: <SectionDosar d={d} prop={prop} />,
    echipamente: <SectionEchipamente d={d} prop={prop} act={act} explain={explain} />,
    riscuri: <SectionRiscuri d={d} act={act} explain={explain} go={go} />,
    calendar: <SectionCalendar properties={properties} prop={prop} onRequestCreated={reloadRequests} />,
    bloc: <SectionBloc properties={properties} onRequestsChanged={reloadRequests} />,
    pasaport: <SectionPasaport prop={prop} />,
  }[cur.id];

  return (
    <div data-testid="v2-property-view">
      {/* Header proprietate — compact, o singură dată */}
      <div className="px-5 lg:px-0 flex items-center gap-3">
        <span className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center shrink-0"><Building2 className="w-5 h-5 text-[#ccff00]" /></span>
        <div className="flex-1 min-w-0">
          <h1 className="xos-display text-xl lg:text-3xl font-medium tracking-tight text-slate-900 leading-none truncate">{prop.name}</h1>
          <div className="text-xs text-slate-500 mt-1 truncate">{prop.address || "adresă necompletată"}</div>
        </div>
        {properties.length > 1 && <select value={prop.id} onChange={e => setSelectedPropId(e.target.value)} className="hidden sm:block text-xs font-bold border border-slate-200 rounded-full px-3 min-h-[40px] bg-white text-slate-700 max-w-[180px]" data-testid="v2-prop-selector">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>}
        <Secondary className="!min-h-[40px] text-xs" onClick={() => act("manage")} tid="v2-hub-manage"><Settings2 className="w-4 h-4" /><span className="hidden sm:inline">Administrează</span></Secondary>
      </div>
      {properties.length > 1 && (
        <div className="sm:hidden px-5 mt-3 flex items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500 shrink-0">Proprietatea:</span>
          <select value={prop.id} onChange={e => setSelectedPropId(e.target.value)} className="flex-1 min-w-0 text-xs font-bold border border-slate-200 rounded-full px-3 min-h-[40px] bg-white text-slate-700" data-testid="v2-prop-selector-mobile">{properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </div>
      )}

      {/* Mobil: sub-navigare orizontală sticky (o secțiune pe ecran) */}
      <div ref={chipsRef} className="lg:hidden sticky top-0 z-30 mt-4 px-5 py-2 xos-topbar flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" data-testid="hub-subnav-mobile">
        {SECTIONS.map(s => (
          <button type="button" key={s.id} data-sec={s.id} onClick={() => goSection(s.id)} data-testid={`hub-tab-${s.id}`}
            className={`shrink-0 min-h-[40px] px-3.5 rounded-full text-xs font-bold border transition-colors ${secId === s.id ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-slate-200"}`}>{s.label}</button>
        ))}
      </div>

      <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <nav className="hidden lg:block lg:col-span-3 xl:col-span-2 lg:sticky lg:top-6 space-y-0.5" data-testid="hub-subnav">
          {SECTIONS.map(s => (
            <button type="button" key={s.id} onClick={() => goSection(s.id)} data-testid={`hub-subnav-${s.id}`}
              className={`w-full min-h-[44px] flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-colors ${secId === s.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              <s.icon className="w-4 h-4 shrink-0" /><span className="min-w-0"><span className="block text-xs font-bold">{s.label}</span><span className={`block text-[10px] truncate ${secId === s.id ? "text-white/60" : "text-slate-400"}`}>{s.sub}</span></span>
            </button>
          ))}
        </nav>
        <div id={`hub-section-${cur.id}`} className="px-5 lg:px-0 lg:col-span-6 xl:col-span-7 min-w-0">
          <div className="lg:hidden mb-3 px-1"><Overline>{cur.label}</Overline><p className="text-xs text-slate-500">{cur.sub}</p></div>
          {body}
        </div>
        <aside className="hidden lg:block lg:col-span-3 lg:sticky lg:top-6 space-y-4" data-testid="hub-context-panel"><StatusPanel d={d} goSection={goSection} /></aside>
      </div>
    </div>
  );
};
