// Health Score Badge — visual signal for specialist quality (Excelent / Bun / În progres).
// Color scheme mirrors backend tier mapping: emerald (>=80) / amber (>=50) / rose (<50).
import React, { useState } from "react";
import { ShieldCheck, Star, CheckCircle2, AlertTriangle, X } from "lucide-react";

const TIER_STYLES = {
  excellent:  { ring: "ring-emerald-500/40", text: "text-emerald-300", bg: "bg-emerald-500/15", dot: "bg-emerald-400" },
  good:       { ring: "ring-amber-500/40",   text: "text-amber-300",   bg: "bg-amber-500/15",   dot: "bg-amber-400" },
  developing: { ring: "ring-rose-500/40",    text: "text-rose-300",    bg: "bg-rose-500/15",    dot: "bg-rose-400" },
};

export const HealthScoreBadge = ({ health, size = "md", showLabel = true, withDetails = true }) => {
  const [open, setOpen] = useState(false);
  if (!health || typeof health.score !== "number") return null;
  const s = TIER_STYLES[health.tier] || TIER_STYLES.developing;
  const isSm = size === "sm";

  return (
    <>
      <button
        onClick={(e) => { if (withDetails) { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
        type="button"
        className={`inline-flex items-center gap-1.5 ${isSm ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"} rounded-full ${s.bg} ${s.text} ring-1 ${s.ring} uppercase tracking-wider font-bold ${withDetails ? "hover:brightness-125" : ""}`}
        data-testid={`health-badge-${health.tier}`}
        title={`Health Score: ${health.score}/100`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {showLabel && <span>{health.label}</span>}
        <span className="opacity-50">·</span>
        <span className="tabular-nums">{health.score}</span>
      </button>

      {open && withDetails && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-stone-900 border border-white/10 rounded-2xl p-5 w-full max-w-sm" data-testid="health-detail-modal">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-stone-500 font-semibold">Health Score</div>
                <div className={`text-3xl font-serif ${s.text}`}>{health.score}<span className="text-base text-stone-500">/100</span></div>
                <div className={`text-xs ${s.text} mt-0.5 font-medium`}>{health.label}</div>
              </div>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5 text-stone-500" /></button>
            </div>

            <p className="text-[11px] text-stone-400 mb-3 leading-relaxed">
              Scor calculat din rating, recenzii, verificare, rata de finalizare la timp și dispute. Folosește-l ca semnal de încredere.
            </p>

            <div className="space-y-2 text-xs">
              <HealthRow icon={Star} label="Rating mediu" value={`${(health.components?.rating || 0).toFixed(1)} ★`} ok={(health.components?.rating || 0) >= 4} />
              <HealthRow icon={Star} label="Recenzii" value={`${health.components?.reviews || 0}`} ok={(health.components?.reviews || 0) >= 5} />
              <HealthRow icon={ShieldCheck} label="Cont verificat" value={health.components?.verified ? "DA" : "Nu"} ok={!!health.components?.verified} />
              <HealthRow icon={CheckCircle2} label="Lucrări finalizate" value={`${health.components?.completed_jobs || 0} / ${health.components?.total_jobs || 0}`} ok={(health.components?.completed_jobs || 0) >= 3} />
              <HealthRow icon={AlertTriangle} label="Dispute" value={`${health.components?.disputes || 0}`} ok={(health.components?.disputes || 0) === 0} bad={(health.components?.disputes || 0) > 0} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const HealthRow = ({ icon: Icon, label, value, ok, bad }) => (
  <div className={`flex items-center justify-between rounded-lg px-2 py-1.5 ${ok ? "bg-emerald-500/10" : bad ? "bg-rose-500/10" : "bg-white/[0.03]"}`}>
    <div className="flex items-center gap-2">
      <Icon className={`w-3.5 h-3.5 ${ok ? "text-emerald-400" : bad ? "text-rose-400" : "text-stone-500"}`} />
      <span className="text-stone-300">{label}</span>
    </div>
    <span className={`font-mono tabular-nums ${ok ? "text-emerald-300" : bad ? "text-rose-300" : "text-stone-400"}`}>{value}</span>
  </div>
);

export default HealthScoreBadge;
