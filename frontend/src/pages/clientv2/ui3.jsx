// Primitive vizuale Client Beta (UX aprobat) — ADN PropManage: Outfit/Plus Jakarta, lime #ccff00, obsidian în dark.
import React from "react";
import { ChevronRight, ChevronDown, CircleHelp, Check, X } from "lucide-react";
import { LIME } from "./ui";

export const Card = ({ children, className = "", tid, tone }) => (
  <div data-testid={tid}
    className={`rounded-3xl border p-4 lg:p-5 ${tone === "accent" ? "border-[#166534]/20 bg-[#F6FEE7]" : tone === "dark" ? "border-transparent bg-slate-900 text-white" : "border-slate-100 bg-white shadow-sm"} ${className}`}>
    {children}
  </div>
);

export const Overline = ({ children, className = "" }) => (
  <div className={`text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 ${className}`}>{children}</div>
);

export const H2 = ({ children, className = "" }) => (
  <h2 className={`xos-display text-lg lg:text-xl font-semibold tracking-tight text-slate-900 leading-tight ${className}`}>{children}</h2>
);

export const Primary = ({ children, onClick, tid, className = "", full, disabled, type = "button" }) => (
  <button type={type} onClick={onClick} disabled={disabled} data-testid={tid}
    className={`${full ? "w-full" : ""} inline-flex items-center justify-center gap-1.5 min-h-[44px] px-5 rounded-full text-sm font-black text-black active:scale-[0.98] transition-transform shadow-[0_10px_30px_-12px_rgba(204,255,0,0.55)] disabled:opacity-50 ${className}`}
    style={{ background: LIME }}>
    {children}
  </button>
);

export const Secondary = ({ children, onClick, tid, className = "", full, disabled }) => (
  <button type="button" onClick={onClick} disabled={disabled} data-testid={tid}
    className={`${full ? "w-full" : ""} inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-full text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-transform disabled:opacity-50 ${className}`}>
    {children}
  </button>
);

export const Ghost = ({ children, onClick, tid, className = "" }) => (
  <button type="button" onClick={onClick} data-testid={tid}
    className={`inline-flex items-center gap-1 min-h-[40px] px-2 text-xs font-bold text-[#166534] hover:underline ${className}`}>
    {children}
  </button>
);

const TONES = {
  lime: "bg-[#F6FEE7] text-[#166534] border-[#D2F2DC]",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
  slate: "bg-slate-100 text-slate-500 border-slate-100",
  amber: "bg-amber-50 text-amber-700 border-amber-100",
  rose: "bg-rose-50 text-rose-700 border-rose-100",
  sky: "bg-sky-50 text-sky-700 border-sky-100",
  dark: "bg-slate-900 text-[#ccff00] border-slate-900",
};
export const Chip = ({ tone = "slate", children, tid, className = "" }) => (
  <span data-testid={tid} className={`inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase tracking-wide ${TONES[tone]} ${className}`}>{children}</span>
);

export const Bar = ({ pct = 0, tone = LIME, h = "h-1.5" }) => (
  <div className={`${h} rounded-full bg-slate-100 overflow-hidden`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
    <div className={`${h} rounded-full transition-all duration-700`} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: tone }} />
  </div>
);

export const Ring = ({ value = 0, max = 100, size = 72, label }) => {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const pct = Math.min(1, (Number(value) || 0) / max);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" style={{ width: size, height: size }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LIME} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - c * pct} style={{ transition: "stroke-dashoffset .8s ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="xos-num text-2xl leading-none text-slate-900 font-medium">{value}</span>
        {label && <span className="text-[9px] font-bold text-slate-400 mt-0.5">{label}</span>}
      </div>
    </div>
  );
};

// Rând de listă cu țintă de atingere ≥ 56px (o mână, pe telefon)
export const Row = ({ icon: Icon, title, sub, right, onClick, tid, chevron = true, className = "" }) => (
  <button type="button" onClick={onClick} data-testid={tid}
    className={`w-full min-h-[56px] flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3.5 py-3 text-left active:scale-[0.99] transition-transform hover:bg-slate-50 ${className}`}>
    {Icon && <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-[#166534]" /></span>}
    <span className="flex-1 min-w-0">
      <span className="block text-sm font-bold text-slate-900 truncate">{title}</span>
      {sub && <span className="block text-xs text-slate-500 truncate">{sub}</span>}
    </span>
    {right}
    {chevron && <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />}
  </button>
);

export const Stat = ({ value, label, sub, onClick, tid }) => (
  <button type="button" onClick={onClick} data-testid={tid}
    className="min-h-[72px] rounded-2xl border border-slate-100 bg-white p-3 text-left hover:bg-slate-50 active:scale-[0.99] transition-transform">
    <div className="xos-num text-2xl leading-none text-slate-900 font-medium">{value}</div>
    <div className="mt-1 text-xs font-bold text-slate-700 leading-tight">{label}</div>
    {sub && <div className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">{sub}</div>}
  </button>
);

// Bottom sheet (mobil) / dialog centrat (desktop)
export const Sheet = ({ title, sub, onClose, children, tid, wide }) => {
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/45" onClick={onClose} data-testid={tid}>
      <div className={`w-full ${wide ? "sm:max-w-2xl" : "sm:max-w-md"} bg-white rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="mx-auto w-10 h-1 rounded-full bg-slate-200 mt-2 sm:hidden" />
        <div className="sticky top-0 bg-white flex items-start gap-3 px-5 py-4 border-b border-slate-100 z-10">
          <div className="flex-1 min-w-0">
            <h2 className="xos-display text-base font-semibold text-slate-900 leading-tight">{title}</h2>
            {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center shrink-0" data-testid="v3-sheet-close" aria-label="Închide">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        <div className="p-5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>{children}</div>
      </div>
    </div>
  );
};

// „Ce înseamnă acest scor?" + „Cum îl îmbunătățesc?" — la cerere
export const ExplainSheet = ({ ind, onClose, onGo }) => (
  <Sheet title={ind.label} sub="Ce înseamnă și cum îl îmbunătățești" onClose={onClose} tid="v3-explain-sheet">
    <div className="flex items-center gap-4">
      {typeof ind.value === "number" ? <Ring value={ind.value} max={ind.max || 100} size={80} label={ind.suffix || `/${ind.max || 100}`} />
        : <span className="w-20 h-20 rounded-2xl bg-slate-900 text-[#ccff00] flex flex-col items-center justify-center shrink-0"><span className="xos-num text-2xl">{ind.value}</span><span className="text-[9px] font-bold">{ind.sub}</span></span>}
      <div className="min-w-0">
        <Overline>Ce înseamnă?</Overline>
        <p className="mt-1 text-sm text-slate-700 leading-relaxed">{ind.meaning}</p>
      </div>
    </div>
    {ind.how?.length > 0 && (
      <div className="mt-5">
        <Overline>Cum a rezultat?</Overline>
        <div className="mt-2 space-y-2">
          {ind.how.map((h, i) => {
            const done = h.max ? h.points >= h.max : false;
            return (
              <div key={i} className="flex items-center gap-2.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-[#ccff00]" : "bg-slate-100"}`}>
                  <Check className={`w-3 h-3 ${done ? "text-black" : "text-slate-300"}`} strokeWidth={3} />
                </span>
                <span className={`flex-1 text-sm ${done ? "text-slate-700 font-semibold" : "text-slate-500"}`}>{h.label}{!done && h.hint ? <span className="block text-[11px] text-slate-400">{h.hint}</span> : null}</span>
                <span className="text-xs font-mono text-slate-400">{h.points}/{h.max}</span>
              </div>
            );
          })}
        </div>
      </div>
    )}
    {ind.improve && (
      <div className="mt-5 rounded-2xl bg-[#F6FEE7] border border-[#D2F2DC] p-4">
        <Overline className="!text-[#166534]">Cum îl îmbunătățesc?</Overline>
        <p className="mt-1 text-sm font-bold text-slate-900">{ind.improve}</p>
        {ind.go && <Primary className="mt-3" full onClick={() => onGo(ind.go)} tid="v3-explain-go">Mergi acolo <ChevronRight className="w-4 h-4" /></Primary>}
      </div>
    )}
  </Sheet>
);

export const HelpDot = ({ onClick, tid }) => (
  <button type="button" onClick={onClick} data-testid={tid} aria-label="Ce înseamnă?"
    className="w-9 h-9 -m-1 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50">
    <CircleHelp className="w-4 h-4" />
  </button>
);

// Acordeon: header-ul spune ce e înăuntru (recognition over recall)
export const Fold = ({ icon: Icon, title, summary, open, onToggle, children, tid }) => (
  <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden" data-testid={tid}>
    <button type="button" onClick={onToggle} className="w-full min-h-[64px] flex items-center gap-3 px-4 py-3 text-left" data-testid={tid ? `${tid}-toggle` : undefined}>
      {Icon && <span className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-[#166534]" /></span>}
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-black text-slate-900">{title}</span>
        {summary && <span className="block text-xs text-slate-500 truncate">{summary}</span>}
      </span>
      <ChevronDown className={`w-4 h-4 text-slate-300 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
    </button>
    {open && <div className="px-4 pb-4 pt-1">{children}</div>}
  </div>
);

export const Empty = ({ icon: Icon, title, body, cta, onCta, tid }) => (
  <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-6 text-center" data-testid={tid}>
    {Icon && <Icon className="w-8 h-8 mx-auto text-slate-300" />}
    <div className="mt-2 text-sm font-black text-slate-900">{title}</div>
    {body && <p className="mt-1 text-xs text-slate-500 leading-relaxed">{body}</p>}
    {cta && <Primary className="mt-4" onClick={onCta}>{cta}</Primary>}
  </div>
);
