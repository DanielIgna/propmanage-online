import React, { useState } from "react";
import axios from "axios";
import { ArrowLeft, PaintRoller, Building, Briefcase, Wrench, Zap, Wind, Palette, Hammer, PartyPopper } from "lucide-react";
import { API } from "../DashShared";
import { formatApiError } from "../../auth";
import { GREEN, GREEN_SOFT, CTA, AmountInput } from "./ui";

const CATS = [
  ["zugravit", "Zugrăvit", PaintRoller], ["parchet", "Parchet", Building], ["faianta", "Faianță / Gresie", Building],
  ["handyman", "Handyman", Briefcase], ["gips_carton", "Gips-carton", Hammer], ["hvac", "HVAC / Climatizare", Wind],
  ["electric", "Electric", Zap], ["plumbing", "Sanitar", Wrench], ["interior_design", "Design Interior", Palette],
];

// Wizard „Solicită" — o întrebare pe ecran (model Client Junior), POST real la /requests
export const RequestWizard = ({ property, onClose, onCreated }) => {
  const [step, setStep] = useState(0);
  // budget_estimate is a string during editing (avoids cursor jump / "0" prefix); parsed at submit.
  const [form, setForm] = useState({ category: "", title: "", description: "", priority: "normal", budget_estimate: "200" });
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      const payload = { ...form, budget_estimate: parseFloat(form.budget_estimate) || 0, property_id: property.id, photos: [] };
      const { data } = await axios.post(`${API}/requests`, payload);
      onCreated(data);
      setDone(true);
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: GREEN_SOFT }} data-testid="v2-wizard-done">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: GREEN }}>
            <PartyPopper className="w-9 h-9 text-white" />
          </span>
          <h1 className="text-2xl font-black text-slate-900">Am primit cererea ta!</h1>
          <p className="mt-2 text-sm text-slate-600 max-w-xs">Specialiștii verificați vor trimite oferte. Te anunțăm imediat ce apar.</p>
        </div>
        <div className="px-5 pb-8 max-w-md mx-auto w-full">
          <CTA testid="v2-wizard-go-jobs" onClick={() => onClose("jobs")}>Mergi la lucrările mele</CTA>
        </div>
      </div>
    );
  }

  const steps = [
    {
      q: "Ce serviciu ai nevoie?",
      valid: !!form.category,
      body: (
        <div className="grid grid-cols-2 gap-2.5">
          {CATS.map(([id, label, Icon]) => (
            <button key={id} onClick={() => setForm(f => ({ ...f, category: id }))} data-testid={`v2-wiz-cat-${id}`}
              className={`rounded-2xl border-2 p-3.5 text-left transition-colors ${form.category === id ? "border-[#34C759] bg-[#34C759]/5" : "border-slate-200 bg-white"}`}>
              <Icon className="w-5 h-5" style={{ color: GREEN }} />
              <div className="mt-1.5 text-xs font-bold text-slate-900">{label}</div>
            </button>
          ))}
        </div>
      ),
    },
    {
      q: "Descrie pe scurt lucrarea",
      valid: form.title.trim().length >= 3 && form.description.trim().length >= 3,
      body: (
        <div className="space-y-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titlu (ex: Zugrăvit living)"
            className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 text-sm outline-none focus:border-[#34C759]" data-testid="v2-wiz-title" />
          <textarea rows={4} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalii: suprafață, culori, termen…"
            className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 text-sm outline-none focus:border-[#34C759]" data-testid="v2-wiz-desc" />
        </div>
      ),
    },
    {
      q: "Cât de urgentă e lucrarea?",
      valid: true,
      body: (
        <div className="space-y-3">
          {[["normal", "Program normal", "specialiștii răspund în 24-48h"], ["urgent", "🔥 Urgent", "apare primul în lista specialiștilor"]].map(([v, l, s]) => (
            <button key={v} onClick={() => setForm(f => ({ ...f, priority: v }))} data-testid={`v2-wiz-prio-${v}`}
              className={`w-full rounded-2xl border-2 p-4 text-left ${form.priority === v ? "border-[#34C759] bg-[#34C759]/5" : "border-slate-200 bg-white"}`}>
              <div className="text-sm font-black text-slate-900">{l}</div>
              <div className="text-[11px] text-slate-400">{s}</div>
            </button>
          ))}
          <label className="block text-xs font-bold text-slate-500 pt-1">Buget estimat (RON)
            <AmountInput value={form.budget_estimate}
              onChange={(raw) => setForm(f => ({ ...f, budget_estimate: raw }))}
              className="mt-1.5 w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 text-sm font-normal outline-none focus:border-[#34C759]" data-testid="v2-wiz-budget" />
          </label>
        </div>
      ),
    },
  ];
  const s = steps[step];

  return (
    <div className="fixed inset-0 z-50 bg-[#FAFBFA] flex flex-col" data-testid="v2-wizard">
      <div className="flex items-center gap-3 px-4 py-3.5 bg-white border-b border-slate-100">
        <button onClick={() => (step === 0 ? onClose() : setStep(step - 1))} data-testid="v2-wiz-back"><ArrowLeft className="w-5 h-5 text-slate-700" /></button>
        <span className="flex-1 text-center text-sm font-bold text-slate-900">Solicitare nouă · {property?.name}</span>
        <span className="w-5" />
      </div>
      <div className="h-1.5 bg-slate-100"><div className="h-full rounded-r-full transition-all" style={{ width: `${((step + 1) / (steps.length + 1)) * 100}%`, background: GREEN }} /></div>
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-28 max-w-md mx-auto w-full">
        <div key={step} className="cv2-fade">
          <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: GREEN }}>Pasul {step + 1} din {steps.length}</div>
          <h2 className="mt-1 text-2xl font-black text-slate-900 leading-snug">{s.q}</h2>
          <div className="mt-5">{s.body}</div>
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-gradient-to-t from-white via-white to-transparent">
        <div className="max-w-md mx-auto">
          <CTA disabled={!s.valid || loading} testid="v2-wiz-continue"
            onClick={() => (step < steps.length - 1 ? setStep(step + 1) : submit())}>
            {loading ? "Se trimite…" : step < steps.length - 1 ? "Continuă" : "Trimite cererea"}
          </CTA>
        </div>
      </div>
    </div>
  );
};
