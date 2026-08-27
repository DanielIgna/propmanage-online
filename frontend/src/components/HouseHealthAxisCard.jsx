// House Health A→G · card de ORIENTARE în Client Beta („harta casei").
// Strat de navigare peste funcțiile existente — reutilizează `/completeness`,
// deep-link către secțiunile Hub existente. ZERO scoring nou, ZERO backend nou.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { ChevronRight, ChevronDown, Info, Sparkles, Check } from "lucide-react";
import { API } from "../pages/DashShared";
import {
  HOUSE_HEALTH_AXIS, STATE_META, AXIS_DISCLAIMER,
  deriveChapterState, chapterForNextStep,
} from "../lib/houseHealthAxis";

const TONE = {
  emerald: { chip: "bg-emerald-50 text-emerald-700 border-emerald-100", dot: "#059669" },
  lime: { chip: "bg-[#F6FEE7] text-[#4d7c0f] border-[#e3f5b8]", dot: "#65a30d" },
  slate: { chip: "bg-slate-100 text-slate-400 border-slate-100", dot: "#cbd5e1" },
  amber: { chip: "bg-amber-50 text-amber-600 border-amber-100", dot: "#d97706" },
};

export const HouseHealthAxisCard = ({ prop, actions, goSection }) => {
  const [compl, setCompl] = useState(null);
  const [showLegal, setShowLegal] = useState(false);

  useEffect(() => {
    if (!prop?.id) return;
    const load = () => axios.get(`${API}/properties/${prop.id}/completeness`).then(r => setCompl(r.data)).catch(() => setCompl(false));
    load();
    window.addEventListener("propmanage:doc-uploaded", load);
    return () => window.removeEventListener("propmanage:doc-uploaded", load);
  }, [prop?.id]);

  const openChapter = (target) => {
    if (!target) return;
    if (target.startsWith("section:")) { goSection?.(target.split(":")[1]); return; }
    const act = target.split(":")[1];
    if (act === "openHealth") actions?.openHealth?.();
    else if (act === "openTwin") actions?.openTwin?.();
    else if (act === "openPropManager") actions?.openPropManager?.();
  };

  const nextChapter = compl ? chapterForNextStep(compl) : null;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white shadow-sm p-4 lg:p-5 mb-4" data-testid="hh-axis-card">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-2xl bg-slate-900 text-[#d4ff3a] flex items-center justify-center shrink-0 text-[11px] font-black">A→G</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-slate-900 leading-none">Harta casei tale (A→G)</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Cele 7 capitole ale sănătății și stării locuinței</div>
        </div>
        <button onClick={() => setShowLegal(v => !v)} data-testid="hh-axis-legal-toggle"
          className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0" aria-label="Notă legală">
          <Info className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {showLegal && (
        <p className="mt-3 text-[10px] leading-relaxed text-slate-500 rounded-2xl bg-slate-50 p-3" data-testid="hh-axis-disclaimer">
          {AXIS_DISCLAIMER}
        </p>
      )}

      {nextChapter && (
        <button onClick={() => openChapter(nextChapter.target)} data-testid="hh-axis-next-step"
          className="mt-3 w-full text-left rounded-2xl bg-[#F0FBF4] border border-[#D2F2DC] p-3 transition-transform hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-[#166534]" />
            <span className="flex-1 text-xs font-bold text-slate-700 leading-snug">
              Ești la capitolul {nextChapter.code} · Următorul pas: {compl?.next_step?.label || nextChapter.nextHint}
            </span>
            {compl?.next_step?.expected_gain != null && (
              <span className="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full text-black" style={{ background: "#d4ff3a" }}>+{compl.next_step.expected_gain}%</span>
            )}
          </div>
        </button>
      )}

      <div className="mt-3 space-y-1.5" data-testid="hh-axis-chapters">
        {HOUSE_HEALTH_AXIS.map((c) => {
          const state = compl === false ? "lipsa_date" : (compl ? deriveChapterState(c, compl) : null);
          const meta = state ? STATE_META[state] : null;
          const tone = meta ? TONE[meta.tone] : TONE.slate;
          const isNext = nextChapter?.code === c.code;
          return (
            <button key={c.code} onClick={() => openChapter(c.target)} data-testid={`hh-axis-chapter-${c.code}`}
              className={`w-full flex items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] transition-transform ${isNext ? "border-[#166534]/25 bg-[#166534]/[0.03]" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
              <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm font-black"
                style={{ background: state === "verificat" ? "#dcfce7" : state === "documentat" ? "#F6FEE7" : "#f1f5f9", color: state === "verificat" ? "#059669" : state === "documentat" ? "#4d7c0f" : "#94a3b8" }}>
                {state === "verificat" ? <Check className="w-4 h-4" /> : c.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-black text-slate-900 truncate">{c.title}</span>
                <span className="block text-[10px] text-slate-400 truncate">{c.question}</span>
              </span>
              {meta ? (
                <span data-testid={`hh-axis-state-${c.code}`} className={`shrink-0 text-[9px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full border ${tone.chip}`} title={meta.hint}>
                  {meta.label}
                </span>
              ) : (
                <span className="shrink-0 w-14 h-4 rounded-full bg-slate-100 animate-pulse" />
              )}
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>

      <button onClick={() => setShowLegal(v => !v)} className="mt-2 w-full flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400" data-testid="hh-axis-legal-link">
        Ce înseamnă A→G? <ChevronDown className={`w-3 h-3 transition-transform ${showLegal ? "rotate-180" : ""}`} />
      </button>
    </div>
  );
};

export default HouseHealthAxisCard;
