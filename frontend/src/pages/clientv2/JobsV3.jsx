// LUCRĂRI — CERERE → OFERTE → ÎN LUCRU → FINALIZAT, vizibil dintr-o privire.
// Sus: ce necesită acțiunea ta. Apoi: în desfășurare (rânduri compacte, expandabile). Istoric: colapsat.
import React, { useMemo, useState } from "react";
import { ClipboardList, MessageSquare, Clock, AlertTriangle, ChevronDown, ChevronRight, Search, Star, CircleCheck } from "lucide-react";
import { Card, Overline, H2, Primary, Secondary, Chip, Empty, Ghost } from "./ui3";
import { STAGES, stageOf, jobAction, timeAgo } from "./data3";
import { Steps, stepForStatus } from "./ui";

const STAGE_TONE = { cerere: "sky", oferte: "amber", in_lucru: "lime", finalizat: "emerald" };

// Pipeline: 4 etape cu numărători — și filtru în același timp
const Pipeline = ({ counts, filter, setFilter }) => (
  <div className="grid grid-cols-4 gap-1.5" data-testid="v3-jobs-pipeline">
    {STAGES.map((s, i) => {
      const on = filter === s.id;
      return (
        <button type="button" key={s.id} onClick={() => setFilter(on ? "all" : s.id)} data-testid={`v3-pipe-${s.id}`}
          className={`relative min-h-[68px] rounded-2xl p-2.5 text-left transition-colors ${on ? "bg-slate-900 text-white" : "bg-white border border-slate-100 hover:bg-slate-50"}`}>
          <div className={`text-[9px] font-black uppercase tracking-wide ${on ? "text-[#ccff00]" : "text-slate-400"}`}>{i + 1} · {s.label}</div>
          <div className={`xos-num text-2xl leading-none mt-1 ${on ? "text-white" : "text-slate-900"}`}>{counts[s.id] || 0}</div>
          <div className={`text-[9px] mt-0.5 leading-tight ${on ? "text-white/60" : "text-slate-400"}`}>{s.hint}</div>
          {i < 3 && <span className="hidden sm:block absolute -right-1.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs">›</span>}
        </button>
      );
    })}
  </div>
);

// Card de acțiune: titlu → ce trebuie să fac → UN buton
const ActionCard = ({ r, act, offersCount }) => {
  const a = jobAction(r, offersCount);
  const st = stageOf(r);
  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm p-4" data-testid={`v2-job-${r.id}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2"><Chip tone={STAGE_TONE[st?.id] || "slate"}>{st?.label || r.status}</Chip><span className="text-[11px] text-slate-400">{timeAgo(r.created_at)}</span></div>
          <div className="mt-1.5 text-sm font-black text-slate-900 leading-snug truncate">{r.title}</div>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{a?.why}</p>
        </div>
        <Primary onClick={() => act(a.kind, r)} tid={`v2-job-${a.kind}-${r.id}`} className="w-full sm:w-auto sm:!min-h-[40px] sm:!px-4 text-xs shrink-0">{a?.label}</Primary>
      </div>
    </div>
  );
};

// Rând compact → expandează: pașii, detalii, acțiuni secundare (chat, istoric, evaluare, dispută)
const JobRow = ({ r, act, offersCount }) => {
  const [open, setOpen] = useState(false);
  const st = stageOf(r); const a = jobAction(r, offersCount);
  const withSpec = r.specialist_id && ["assigned", "in_progress", "completed"].includes(r.status);
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden" data-testid={`v2-job-${r.id}`}>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full min-h-[60px] flex items-center gap-3 px-3.5 py-3 text-left" data-testid={`v3-job-toggle-${r.id}`}>
        <span className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0 text-xs font-black text-slate-600">{(STAGES.findIndex(s => s.id === st?.id) + 1) || "✓"}</span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-slate-900 truncate">{r.title}</span>
          <span className="block text-xs text-slate-500 truncate">{r.specialist_name ? `${r.specialist_name} · ` : ""}{a?.why || "finalizat și confirmat"}</span>
        </span>
        <Chip tone={r.status === "confirmed" ? "emerald" : STAGE_TONE[st?.id] || "slate"}>{r.status === "confirmed" ? "Confirmat" : st?.label}</Chip>
        <ChevronDown className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 space-y-3" data-testid={`v3-job-detail-${r.id}`}>
          {r.status !== "confirmed" && <Steps current={stepForStatus(r.status)} />}
          <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-500">
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Categorie</span>{r.category}</div>
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Prioritate</span>{r.priority}</div>
            <div><span className="block text-[9px] font-black uppercase text-slate-400">Buget</span>{r.budget_estimate ? `${r.budget_estimate} RON` : "—"}</div>
          </div>
          {a && r.status !== "confirmed" && a.kind !== "open" && <Primary full onClick={() => act(a.kind, r)} tid={`v2-job-${a.kind}-${r.id}`}>{a.label}</Primary>}
          <div className="grid grid-cols-3 gap-2">
            {withSpec ? <Secondary className="!min-h-[40px] text-xs" onClick={() => act("chat", r)} tid={`v2-job-chat-${r.id}`}><MessageSquare className="w-3.5 h-3.5" />Chat</Secondary> : <span />}
            <Secondary className="!min-h-[40px] text-xs" onClick={() => act("timeline", r)} tid={`v2-job-timeline-${r.id}`}><Clock className="w-3.5 h-3.5" />Istoric</Secondary>
            {r.status === "confirmed" && r.specialist_id
              ? <Secondary className="!min-h-[40px] text-xs" onClick={() => act("review", r)} tid={`v2-job-review-${r.id}`}><Star className="w-3.5 h-3.5 text-[#65a30d]" />Evaluează</Secondary>
              : withSpec && !r.disputed
                ? <Secondary className="!min-h-[40px] text-xs !text-amber-700" onClick={() => act("dispute", r)} tid={`v2-job-dispute-${r.id}`}><AlertTriangle className="w-3.5 h-3.5" />Problemă</Secondary>
                : <span />}
          </div>
          {r.disputed && <div className="text-center text-[11px] font-bold text-amber-700 bg-amber-50 rounded-full py-2">Dispută în analiză</div>}
        </div>
      )}
    </div>
  );
};

export const JobsV3 = ({ requests, act, initialFilter, offersCount = 0, firstOpenId }) => {
  const [filter, setFilter] = useState(initialFilter || "all");
  const [q, setQ] = useState("");
  const [showAllActions, setShowAllActions] = useState(false);
  const [histOpen, setHistOpen] = useState(false);
  const [limit, setLimit] = useState(20);
  const reqs = requests;
  const oc = (r) => (r.id === firstOpenId ? offersCount : 0);

  const counts = useMemo(() => { const c = {}; reqs.forEach(r => { const s = stageOf(r); if (s) c[s.id] = (c[s.id] || 0) + 1; }); return c; }, [reqs]);
  const active = reqs.filter(r => r.status !== "confirmed");
  const history = reqs.filter(r => r.status === "confirmed");
  const match = (r) => !q || r.title.toLowerCase().includes(q.toLowerCase()) || (r.specialist_name || "").toLowerCase().includes(q.toLowerCase());
  const filtered = active.filter(r => match(r) && (filter === "all" || stageOf(r)?.id === filter || (filter === "pay" && r.status === "assigned" && !r.escrow_amount) || (filter === "confirm" && r.status === "completed") || (filter === "offers" && r.status === "open")));
  const actionable = filtered.filter(r => jobAction(r, oc(r))?.urgent).sort((a, b) => (a.status === "completed" ? -1 : 1) - (b.status === "completed" ? -1 : 1));
  const others = filtered.filter(r => !jobAction(r, oc(r))?.urgent);

  if (reqs.length === 0) {
    return <div className="px-5 lg:px-0 lg:max-w-2xl"><Empty icon={ClipboardList} title="Nicio lucrare încă" body="Solicită primul serviciu — durează 1 minut. Specialiști verificați, plată protejată." cta="Solicită un serviciu" onCta={() => act("request")} tid="v2-jobs-empty" /></div>;
  }

  return (
    <div className="px-5 lg:px-0 lg:max-w-3xl space-y-4" data-testid="v2-jobs-view">
      <div className="flex items-end justify-between gap-3">
        <div><Overline>Lucrările mele</Overline><H2 className="mt-1">{active.length} active · {history.length} finalizate</H2></div>
        <Primary onClick={() => act("request")} tid="v3-jobs-new" className="!min-h-[40px] text-xs">+ Solicită</Primary>
      </div>
      <Pipeline counts={counts} filter={filter} setFilter={setFilter} />
      {reqs.length > 8 && (
        <div className="flex items-center gap-2 px-3.5 min-h-[44px] rounded-full border border-slate-200 bg-white">
          <Search className="w-4 h-4 text-slate-400" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Caută după lucrare sau specialist…" className="flex-1 text-sm outline-none bg-transparent" data-testid="v3-jobs-search" />
        </div>
      )}
      {filter !== "all" && <Ghost onClick={() => setFilter("all")} tid="v3-jobs-clear">← Toate lucrările</Ghost>}

      {actionable.length > 0 && (
        <section data-testid="v3-jobs-actionable">
          <div className="flex items-center gap-2 px-1"><span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" /><Overline>Necesită acțiunea ta ({actionable.length})</Overline></div>
          <div className="mt-2 space-y-2">
            {(showAllActions ? actionable : actionable.slice(0, 3)).map(r => <ActionCard key={r.id} r={r} act={act} offersCount={oc(r)} />)}
          </div>
          {actionable.length > 3 && (
            <Secondary className="mt-2" full onClick={() => setShowAllActions(v => !v)} tid="v3-jobs-actionable-more">{showAllActions ? "Arată mai puține" : `Arată toate (${actionable.length})`}</Secondary>
          )}
        </section>
      )}

      {others.length > 0 && (
        <section data-testid="v3-jobs-others">
          <Overline className="px-1">În desfășurare ({others.length})</Overline>
          <div className="mt-2 space-y-1.5">
            {others.slice(0, limit).map(r => <JobRow key={r.id} r={r} act={act} offersCount={oc(r)} />)}
          </div>
          {others.length > limit && <Secondary className="mt-2" full onClick={() => setLimit(l => l + 20)}>Mai multe ({others.length - limit})</Secondary>}
        </section>
      )}
      {filtered.length === 0 && <Card><p className="text-sm text-slate-500 text-center">Nicio lucrare în această etapă.</p></Card>}

      {history.length > 0 && filter === "all" && (
        <section data-testid="v3-jobs-history">
          <button type="button" onClick={() => setHistOpen(o => !o)} className="w-full min-h-[52px] flex items-center gap-3 rounded-2xl bg-slate-50 px-4 text-left" data-testid="v3-jobs-history-toggle">
            <CircleCheck className="w-4 h-4 text-[#65a30d]" /><span className="flex-1 text-sm font-bold text-slate-700">Istoric · {history.length} lucrări confirmate</span><ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${histOpen ? "rotate-180" : ""}`} />
          </button>
          {histOpen && <div className="mt-2 space-y-1.5">{history.filter(match).slice(0, 30).map(r => <JobRow key={r.id} r={r} act={act} />)}</div>}
        </section>
      )}
      <p className="text-[11px] text-slate-400 px-1 flex items-center gap-1"><ChevronRight className="w-3 h-3" /> Specialiștii de încredere cu care ai mai lucrat apar mai jos — îi poți re-angaja direct.</p>
    </div>
  );
};
