// Welcome Checklist — onboarding progress for client/specialist on first dashboard visits.
// Shows progress bar + checklist of steps + dismiss button.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Check, X, ChevronRight, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API } from "../pages/DashShared";

export const WelcomeChecklist = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const r = await axios.get(`${API}/ux/checklist`);
      setData(r.data);
    } catch (_e) { /* ignore — likely role without checklist */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markDone = async (stepId) => {
    await axios.post(`${API}/ux/checklist/step`, { step_id: stepId, done: true }).catch(() => {});
    await load();
  };

  const dismiss = async () => {
    setDismissing(true);
    await axios.post(`${API}/ux/checklist/dismiss`).catch(() => {});
    setData(null);
  };

  if (loading || !data || !data.items?.length) return null;
  if (data.dismissed) return null;
  if (data.percent >= 100) return null;

  return (
    <div className="mb-5 bg-gradient-to-br from-emerald-500/10 via-cyan-500/5 to-transparent border border-emerald-500/30 rounded-2xl p-5 relative" data-testid="welcome-checklist">
      <button
        onClick={dismiss}
        disabled={dismissing}
        data-testid="welcome-checklist-dismiss"
        className="absolute top-3 right-3 text-stone-500 hover:text-stone-300 p-1"
        title="Închide checklist-ul"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-emerald-400" />
        <span className="text-xs uppercase tracking-wider font-bold text-emerald-300">
          {data.role === "specialist" ? "Configurare cont specialist" : "Bun venit pe PropManage"}
        </span>
      </div>
      <h3 className="text-xl font-bold text-stone-100 mb-2">
        Progres: <span className="text-emerald-400 tabular-nums">{data.completed}/{data.total}</span> pași
      </h3>

      <div className="h-2 bg-stone-800 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500"
          style={{ width: `${data.percent}%` }}
          data-testid="welcome-checklist-progress"
        />
      </div>

      <ul className="space-y-1.5">
        {data.items.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-colors ${
              step.completed
                ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                : "border-stone-800 hover:border-stone-700 hover:bg-stone-800/40 text-stone-200"
            }`}
            data-testid={`welcome-step-${step.id}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
              step.completed ? "bg-emerald-500 text-stone-950" : "bg-stone-800 border border-stone-700"
            }`}>
              {step.completed ? <Check className="w-3.5 h-3.5" /> : step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium ${step.completed ? "line-through opacity-70" : ""}`}>
                {step.title}
              </div>
              {step.optional && !step.completed && (
                <div className="text-[10px] text-stone-500 italic">opțional</div>
              )}
            </div>
            {!step.completed && (
              <>
                {step.cta_route && (
                  <button
                    onClick={() => navigate(step.cta_route)}
                    data-testid={`welcome-step-go-${step.id}`}
                    className="text-xs text-cyan-300 hover:text-cyan-200 font-semibold inline-flex items-center gap-0.5"
                  >
                    Mergi <ArrowRight className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={() => markDone(step.id)}
                  data-testid={`welcome-step-mark-${step.id}`}
                  className="text-[10px] text-stone-500 hover:text-emerald-400 px-1.5 py-0.5 rounded border border-stone-700 hover:border-emerald-500/40"
                  title="Marchează ca terminat"
                >
                  ✓
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3 text-[11px] text-stone-500 flex items-center gap-1">
        <ChevronRight className="w-3 h-3" /> Apasă bifa pentru a marca manual sau „Mergi” pentru a fi dus la pagină.
      </div>
    </div>
  );
};

export default WelcomeChecklist;
