import React from "react";
import { Check, Search, Briefcase, Bell, Settings, ChevronRight, ShieldCheck, Clock, BadgeCheck } from "lucide-react";

// Verde AA-compliant: green-700 pe alb = 4.99:1 (WCAG AA text normal)
export const CJ_GREEN = "#166534";
export const CJ_GREEN_SOFT = "rgba(21,128,61,0.08)";

// ── QuestionCard: o singură întrebare pe ecran (Hick's Law) ──────────────────
export const QuestionCard = ({ question, hint, children }) => (
  <div className="px-5 pt-6" data-testid="cj-question-card">
    <h2 className="text-2xl font-black text-slate-900 leading-snug">{question}</h2>
    {hint && <p className="mt-1.5 text-sm text-slate-500">{hint}</p>}
    <div className="mt-5 space-y-3">{children}</div>
  </div>
);

// ── OptionRadio: opțiune mare (≥56px), feedback instant ──────────────────────
export const OptionRadio = ({ label, selected, onSelect, testid }) => (
  <button onClick={onSelect} data-testid={testid} role="radio" aria-checked={selected}
    className={`w-full min-h-[56px] flex items-center gap-3 px-4 py-4 rounded-2xl border-2 text-left transition-colors ${
      selected ? "border-[#166534] bg-[#166534]/5" : "border-slate-200 bg-white active:bg-slate-50"}`}>
    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
      selected ? "border-[#166534] bg-[#166534]" : "border-slate-300 bg-white"}`}>
      {selected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
    </span>
    <span className={`text-base ${selected ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>{label}</span>
  </button>
);

// ── StickyCTA: un singur buton principal, mereu vizibil (Fitts) ──────────────
export const StickyCTA = ({ label, onClick, disabled, secondary, testid }) => (
  <div className="fixed bottom-0 left-0 right-0 z-[60] px-5 pb-5 pt-3 bg-gradient-to-t from-white via-white to-transparent">
    <div className="max-w-md mx-auto space-y-2">
      <button onClick={onClick} disabled={disabled} data-testid={testid || "cj-sticky-cta"} aria-disabled={disabled}
        className={`w-full min-h-[52px] py-4 rounded-full text-base font-bold transition-all ${
          disabled ? "bg-slate-200 text-slate-500" : "bg-[#166534] text-white active:scale-[0.98] shadow-lg shadow-[#166534]/30"}`}>
        {label}
      </button>
      {secondary && (
        <button onClick={secondary.onClick} data-testid="cj-secondary-cta"
          className="w-full min-h-[44px] py-2 text-sm font-semibold text-rose-600">{secondary.label}</button>
      )}
    </div>
  </div>
);

// ── StepDots: pași clickabili cu stare + label vizibil (Nielsen: recunoaștere) ─
export const StepDots = ({ total, current, labels, shortLabels, onJump }) => (
  <ol className="flex items-start gap-2.5" aria-label={`Pasul ${current + 1} din ${total}`} data-testid="cj-step-dots">
    {Array.from({ length: total }).map((_, i) => {
      const done = i < current;
      return (
        <li key={i} className="flex flex-col items-center gap-0.5">
          <button onClick={() => done && onJump(i)} disabled={!done} title={labels?.[i]}
            data-testid={`cj-step-dot-${i}`} aria-label={`${labels?.[i] || `Pasul ${i + 1}`}${done ? " — completat, apasă pentru a edita" : i === current ? " — pasul curent" : ""}`}
            aria-current={i === current ? "step" : undefined}
            className={`min-w-[28px] min-h-[28px] rounded-full text-[11px] font-black flex items-center justify-center transition-colors ${
              done ? "bg-[#166534] text-white cursor-pointer cj-dot-pop" :
              i === current ? "border-2 border-[#166534] text-[#166534] bg-white" :
              "border-2 border-slate-200 text-slate-400 bg-white"}`}>
            {done ? <Check className="w-3.5 h-3.5" strokeWidth={3.5} /> : i + 1}
          </button>
          {shortLabels?.[i] && (
            <span className={`text-[9px] font-bold leading-none ${i === current ? "text-[#166534]" : "text-slate-500"}`}>{shortLabels[i]}</span>
          )}
        </li>
      );
    })}
  </ol>
);

// ── TextField: câmp cu label vizibil permanent (Nielsen — recunoaștere) ──────
export const TextField = ({ label, optional, value, onChange, onBlur, error, type = "text", autoComplete, placeholder, testid, inputMode }) => (
  <label className="block">
    <span className="text-sm font-bold text-slate-900">
      {label} {optional && <span className="font-medium text-slate-500">(opțional)</span>}
    </span>
    <input value={value} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} type={type} inputMode={inputMode}
      autoComplete={autoComplete} placeholder={placeholder} data-testid={testid} aria-label={label} aria-invalid={!!error}
      className={`mt-1.5 w-full min-h-[52px] px-4 py-3.5 rounded-2xl border-2 bg-white text-base text-slate-900 outline-none transition-colors ${
        error ? "border-rose-400 focus:border-rose-500" : "border-slate-200 focus:border-[#166534]"}`} />
    <span aria-live="polite" className="block min-h-[2px]">
      {error && <span className="mt-1 block text-xs font-semibold text-rose-600" data-testid={`${testid}-error`}>{error}</span>}
    </span>
  </label>
);

// ── TrustStrip: 3 elemente de încredere, o singură linie ─────────────────────
const TRUST = [
  [ShieldCheck, "Specialiști verificați"],
  [Clock, "Răspuns în 24h"],
  [BadgeCheck, "Gratuit, fără obligații"],
];

export const TrustStrip = () => (
  <div className="px-5 mt-4 flex items-center justify-between gap-2" data-testid="cj-trust-strip">
    {TRUST.map(([Icon, label]) => (
      <span key={label} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
        <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: CJ_GREEN }} aria-hidden="true" />{label}
      </span>
    ))}
  </div>
);

// ── BottomNav: max 4 destinații (Hick), target ≥48px (Fitts) ─────────────────
const NAV_ITEMS = [
  ["home", "Solicită", Search],
  ["jobs", "Lucrările mele", Briefcase],
  ["notifications", "Notificări", Bell],
  ["settings", "Setări", Settings],
];

export const BottomNav = ({ active, onChange }) => (
  <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-100" data-testid="cj-bottom-nav" aria-label="Navigare principală">
    <div className="max-w-md mx-auto grid grid-cols-4">
      {NAV_ITEMS.map(([id, label, Icon]) => (
        <button key={id} onClick={() => { window.scrollTo({ top: 0 }); onChange(id); }} data-testid={`cj-nav-${id}`}
          aria-label={label} aria-current={active === id ? "page" : undefined}
          className="flex flex-col items-center gap-1 py-3 min-h-[56px]">
          <Icon className="w-5 h-5" style={{ color: active === id ? CJ_GREEN : "#64748b" }} strokeWidth={active === id ? 2.5 : 2} aria-hidden="true" />
          <span className={`text-[10px] ${active === id ? "font-bold text-[#166534]" : "font-medium text-slate-500"}`}>{label}</span>
        </button>
      ))}
    </div>
  </nav>
);

// ── CategoryCard: tile de serviciu suport ────────────────────────────────────
export const CategoryCard = ({ icon: Icon, label, sub, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid} aria-label={`Solicită ${label}`}
    className="w-full min-h-[56px] rounded-2xl border border-slate-200 bg-white p-4 text-left active:scale-[0.97] transition-transform shadow-sm">
    <span className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: CJ_GREEN_SOFT }}>
      <Icon className="w-5 h-5" style={{ color: CJ_GREEN }} aria-hidden="true" />
    </span>
    <div className="mt-3 text-sm font-bold text-slate-900 leading-tight">{label}</div>
    {sub && <div className="mt-0.5 text-[11px] text-slate-500">{sub}</div>}
  </button>
);

// ── FeaturedCard: serviciile strategice PropManage (Digital Twin, Design) ────
export const FeaturedCard = ({ icon: Icon, label, sub, badge, onClick, testid }) => (
  <button onClick={onClick} data-testid={testid} aria-label={`Solicită ${label}`}
    className="w-full min-h-[72px] flex items-center gap-4 rounded-2xl border-2 border-[#166534]/25 bg-white p-4 text-left active:scale-[0.98] transition-transform shadow-sm">
    <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: CJ_GREEN }}>
      <Icon className="w-6 h-6 text-white" aria-hidden="true" />
    </span>
    <span className="flex-1 min-w-0">
      <span className="block text-[10px] font-black uppercase tracking-wide text-[#166534]">{badge}</span>
      <span className="block text-base font-black text-slate-900 leading-tight">{label}</span>
      <span className="block mt-0.5 text-xs text-slate-500">{sub}</span>
    </span>
    <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" aria-hidden="true" />
  </button>
);
