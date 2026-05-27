// Public Status page — live system health for prospect / customer transparency.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
import { API } from "./DashShared";

const COMP_LABELS = {
  api: "API",
  database: "Bază de date",
  ai_concierge: "AI Concierge",
  payments: "Plăți (Stripe)",
  email: "Notificări email",
};

const COMP_META = {
  operational: { label: "Funcțional", color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/40", icon: CheckCircle2 },
  limited: { label: "Funcționalitate redusă", color: "text-amber-400 bg-amber-500/20 border-amber-500/40", icon: AlertTriangle },
  degraded: { label: "Degradat", color: "text-amber-400 bg-amber-500/20 border-amber-500/40", icon: AlertTriangle },
  outage: { label: "Indisponibil", color: "text-red-400 bg-red-500/20 border-red-500/40", icon: XCircle },
};

const GLOBAL_STATUS = {
  operational: { label: "Toate sistemele funcționează", color: "text-emerald-400", bg: "from-emerald-500/20 to-emerald-500/5" },
  degraded: { label: "Funcționare parțial degradată", color: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5" },
  outage: { label: "Întrerupere serviciu", color: "text-red-400", bg: "from-red-500/20 to-red-500/5" },
};

export const StatusPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/public/status`);
      setData(r.data);
    } catch {/* ignore */} finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] text-stone-200 grain flex items-center justify-center" data-testid="status-page-loading">
        <div className="text-stone-400 italic">Verific starea serviciilor...</div>
      </div>
    );
  }

  const meta = GLOBAL_STATUS[data.status] || GLOBAL_STATUS.operational;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-200 grain" data-testid="status-page">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-[#d4ff3a] mb-6">
          <ArrowLeft className="w-3 h-3" /> Înapoi acasă
        </Link>

        <div className="flex items-center gap-3 mb-1">
          <Activity className="w-6 h-6 text-[#d4ff3a]" />
          <h1 className="font-serif text-4xl text-white">PropManage Status</h1>
        </div>
        <p className="text-stone-400 text-sm mb-6">Stare live a serviciilor platformei · auto-refresh 60s</p>

        {/* Hero status */}
        <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${meta.bg} p-6 mb-6`} data-testid="status-hero">
          <div className="flex items-center gap-3 mb-2">
            <span className={`w-3 h-3 rounded-full ${data.status === "operational" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
            <div className={`text-xl font-semibold ${meta.color}`}>{meta.label}</div>
            <button onClick={load} className="ml-auto p-2 rounded-lg hover:bg-white/5 text-stone-400" data-testid="status-refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="text-stone-400 text-xs">
            Verificat ultima oară: {data.checked_at ? new Date(data.checked_at).toLocaleString("ro-RO") : "—"}
          </div>
          {data.uptime_pct_90d != null && (
            <div className="mt-3 text-xs text-stone-300">
              Uptime ultimele 90 zile: <span className="text-[#d4ff3a] font-semibold">{data.uptime_pct_90d}%</span>
            </div>
          )}
        </div>

        {/* Components */}
        <div className="space-y-2 mb-6" data-testid="status-components">
          {Object.entries(data.components || {}).map(([k, v]) => {
            const cm = COMP_META[v] || COMP_META.operational;
            const Icon = cm.icon;
            return (
              <div key={k} className={`rounded-xl border ${cm.color} p-3 flex items-center gap-3`} data-testid={`status-comp-${k}`}>
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-medium text-white">{COMP_LABELS[k] || k}</span>
                <span className="ml-auto text-xs uppercase tracking-wider font-bold opacity-80">{cm.label}</span>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-stone-800 bg-stone-900/40 p-4 text-xs text-stone-400">
          <div className="font-semibold text-stone-300 mb-1">Despre această pagină</div>
          <p>Pagină live actualizată automat la fiecare minut. Pentru incidente majore, vom posta detalii suplimentare aici și vom notifica prin email utilizatorii cu cont activ.</p>
          <p className="mt-2">Probleme persistente? Scrie la <a href="mailto:admin@propmanage.io" className="text-[#d4ff3a]">admin@propmanage.io</a>.</p>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
