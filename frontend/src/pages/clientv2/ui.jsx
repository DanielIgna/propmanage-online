import React from "react";
import { X } from "lucide-react";

export const GREEN = "#34C759";
export const GREEN_SOFT = "#E9F9EE";

export const CTA = ({ children, onClick, testid, disabled, subtle }) => (
  <button onClick={onClick} disabled={disabled} data-testid={testid}
    className={`w-full py-3.5 rounded-full text-sm font-bold transition-transform active:scale-[0.98] disabled:opacity-50 ${
      subtle ? "bg-white text-slate-900 border border-slate-200" : "text-white shadow-lg shadow-[#34C759]/25"}`}
    style={subtle ? {} : { background: GREEN }}>
    {children}
  </button>
);

export const STEP_LABELS = ["Cerere", "Oferte", "În lucru", "Finalizat"];
export const stepForStatus = (s) => ({ open: 0, assigned: 1, in_progress: 2, completed: 3, confirmed: 3 }[s] ?? 0);

export const Steps = ({ current }) => (
  <div className="flex items-center gap-1.5">
    {STEP_LABELS.map((s, i) => (
      <React.Fragment key={s}>
        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${i <= current ? "text-white" : "bg-slate-100 text-slate-400"}`}
          style={i <= current ? { background: GREEN } : {}}>{s}</span>
        {i < 3 && <span className={`flex-1 h-0.5 rounded ${i < current ? "bg-[#34C759]" : "bg-slate-100"}`} />}
      </React.Fragment>
    ))}
  </div>
);

export const ListItem = ({ icon: Icon, label, sub, right, onClick, testid, muted }) => (
  <button onClick={onClick} data-testid={testid}
    className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform">
    <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${muted ? "bg-slate-50" : ""}`} style={muted ? {} : { background: GREEN_SOFT }}>
      <Icon className="w-5 h-5" style={{ color: muted ? "#64748B" : GREEN }} />
    </span>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-black text-slate-900">{label}</div>
      {sub && <div className="text-[10px] text-slate-400 truncate">{sub}</div>}
    </div>
    {right}
  </button>
);

export const Sheet = ({ title, onClose, children, testid }) => {
  React.useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose} data-testid={testid}>
    <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="sticky top-0 bg-white flex items-center gap-3 px-5 py-4 border-b border-slate-100 z-10">
        <h2 className="text-base font-black text-slate-900 flex-1">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center" data-testid="v2-sheet-close">
          <X className="w-4 h-4 text-slate-500" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
  );
};

export const STATUS_CHIP = {
  open: ["Deschis", "#EFF6FF", "#3B82F6"],
  assigned: ["Asignat", "#FFF7ED", "#F97316"],
  in_progress: ["În lucru", GREEN_SOFT, GREEN],
  completed: ["Finalizat", "#FAF5FF", "#A855F7"],
  confirmed: ["Confirmat", "#F0FDF4", "#16A34A"],
};

export const StatusChip = ({ status }) => {
  const [label, bg, c] = STATUS_CHIP[status] || [status, "#F1F5F9", "#64748B"];
  return <span className="text-[10px] font-bold px-2 py-1 rounded-full shrink-0" style={{ background: bg, color: c }}>{label}</span>;
};
