import React from "react";
import { Check, Search, Briefcase, Bell, Settings } from "lucide-react";

export const CJ_GREEN = "#34C759";

// ── QuestionCard: o singură întrebare pe ecran (Hick's Law) ──────────────────
export const QuestionCard = ({ question, hint, children }) => (
  <div className="px-5 pt-6" data-testid="cj-question-card">
    <h2 className="text-2xl font-black text-slate-900 leading-snug">{question}</h2>
    {hint && <p className="mt-1.5 text-sm text-slate-500">{hint}</p>}
    <div className="mt-5 space-y-3">{children}</div>
  </div>
);

// ── OptionRadio: opțiune mare, ușor de atins, feedback verde ─────────────────
export const OptionRadio = ({ label, selected, onSelect, testid }) => (
  <button onClick={onSelect} data-testid={testid}
    className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-left transition-colors ${
      selected ? "border-[#34C759] bg-[#34C759]/5" : "border-slate-200 bg-white active:bg-slate-50"}`}>
    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
      selected ? "border-[#34C759] bg-[#34C759]" : "border-slate-300 bg-white"}`}>
      {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
    </span>
    <span className={`text-base ${selected ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{label}</span>
  </button>
);

// ── StickyCTA: buton principal mereu vizibil jos ─────────────────────────────
export const StickyCTA = ({ label, onClick, disabled, secondary, testid }) => (
  <div className="fixed bottom-0 left-0 right-0 z-40 px-5 pb-5 pt-3 bg-gradient-to-t from-white via-white to-transparent">
    <div className="max-w-md mx-auto space-y-2">
      <button onClick={onClick} disabled={disabled} data-testid={testid || "cj-sticky-cta"}
        className={`w-full py-4 rounded-full text-base font-bold transition-all ${
          disabled ? "bg-slate-200 text-slate-400" : "bg-[#34C759] text-white active:scale-[0.98] shadow-lg shadow-[#34C759]/30"}`}>
        {label}
      </button>
      {secondary && (
        <button onClick={secondary.onClick} data-testid="cj-secondary-cta"
          className="w-full py-2 text-sm font-semibold text-rose-500">{secondary.label}</button>
      )}
    </div>
  </div>
);

// ── BottomNav: max 4 destinații (Hick's Law) ─────────────────────────────────
const NAV_ITEMS = [
  ["home", "Solicită", Search],
  ["jobs", "Lucrările mele", Briefcase],
  ["notifications", "Notificări", Bell],
  ["settings", "Setări", Settings],
];

export const BottomNav = ({ active, onChange }) => (
  <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100" data-testid="cj-bottom-nav">
    <div className="max-w-md mx-auto grid grid-cols-4">
      {NAV_ITEMS.map(([id, label, Icon]) => (
        <button key={id} onClick={() => { window.scrollTo({ top: 0 }); onChange(id); }} data-testid={`cj-nav-${id}`}
          className="flex flex-col items-center gap-1 py-2.5">
          <Icon className="w-5 h-5" style={{ color: active === id ? CJ_GREEN : "#94a3b8" }} strokeWidth={active === id ? 2.5 : 2} />
          <span className={`text-[10px] ${active === id ? "font-bold text-[#34C759]" : "font-medium text-slate-400"}`}>{label}</span>
        </button>
      ))}
    </div>
  </nav>
);

// ── CategoryCard: tile de serviciu cu icon pe fundal verde pal ───────────────
export const CategoryCard = ({ icon: Icon, label, sub, onClick, testid, wide }) => (
  <button onClick={onClick} data-testid={testid}
    className={`${wide ? "w-full" : "w-36 shrink-0"} rounded-2xl border border-slate-100 bg-white p-4 text-left active:scale-[0.97] transition-transform shadow-sm`}>
    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: "rgba(52,199,89,0.12)" }}>
      <Icon className="w-5 h-5" style={{ color: CJ_GREEN }} />
    </span>
    <div className="mt-3 text-sm font-bold text-slate-900 leading-tight">{label}</div>
    {sub && <div className="mt-0.5 text-[11px] text-slate-400">{sub}</div>}
  </button>
);
