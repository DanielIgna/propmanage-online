// Public Status page — live system health for prospect / customer transparency.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ArrowLeft, Activity, CheckCircle2, AlertTriangle, XCircle, RefreshCw, TrendingUp } from "lucide-react";
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

// ============= UPTIME SPARKLINE =============
const UptimeSparkline = ({ history }) => {
  if (!history?.days?.length) return null;
  const days = history.days;
  const summary = history.summary || {};
  const W = 600;
  const H = 80;
  const PAD = 4;

  // Treat null (no data) as 100 for line continuity, but render bar marker only when pings>0.
  const points = days.map((d, i) => {
    const x = PAD + (i / Math.max(1, days.length - 1)) * (W - PAD * 2);
    const v = d.uptime_pct == null ? 100 : d.uptime_pct;
    // Map 95-100% range to full height; below 95 amplified.
    const norm = Math.max(0, Math.min(1, (v - 90) / 10));
    const y = PAD + (1 - norm) * (H - PAD * 2);
    return { x, y, day: d, v };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${H - PAD} L ${PAD} ${H - PAD} Z`;

  const overallPct = summary.uptime_pct;
  const trackingSince = summary.tracking_since;
  const daysOfData = days.filter(d => d.pings > 0).length;

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/[0.04] to-transparent p-6 mb-6" data-testid="uptime-sparkline-card">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Uptime ultimele 30 zile</h2>
          </div>
          <div className="text-xs text-stone-400">
            {daysOfData === 0
              ? "Începem să colectăm date — graficul se umple în timp."
              : `${summary.pings_total} probe înregistrate · tracking de la ${new Date(trackingSince).toLocaleDateString("ro-RO")}`}
          </div>
        </div>
        {overallPct != null && (
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Disponibilitate medie</div>
            <div className="font-mono text-2xl font-semibold text-emerald-300" data-testid="uptime-overall-pct">{overallPct}%</div>
          </div>
        )}
      </div>

      {/* SVG sparkline */}
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none" data-testid="uptime-svg">
          <defs>
            <linearGradient id="upgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* baseline 99.9% reference */}
          <line x1={PAD} y1={PAD + 0.01 * (H - PAD * 2)} x2={W - PAD} y2={PAD + 0.01 * (H - PAD * 2)} stroke="#34d39933" strokeDasharray="2 4" />
          <path d={areaD} fill="url(#upgrad)" />
          <path d={pathD} fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              {p.day.pings > 0 && (
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={p.v < 99 ? 2.5 : 1.5}
                  fill={p.v >= 99 ? "#34d399" : p.v >= 95 ? "#fbbf24" : "#f87171"}
                />
              )}
              <title>
                {new Date(p.day.date).toLocaleDateString("ro-RO", { day: "2-digit", month: "short" })} · {p.day.pings === 0 ? "fără date" : `${p.day.uptime_pct}% (${p.day.pings} probe)`}
              </title>
            </g>
          ))}
        </svg>
      </div>

      {/* Day strip — last 30 days mini cells */}
      <div className="mt-3 grid grid-cols-30 gap-0.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }} data-testid="uptime-strip">
        {days.map((d, i) => {
          let cls = "bg-white/5"; // no data
          if (d.pings > 0) {
            if (d.uptime_pct >= 99) cls = "bg-emerald-400/80";
            else if (d.uptime_pct >= 95) cls = "bg-amber-400/80";
            else cls = "bg-red-400/80";
          }
          return (
            <div
              key={i}
              className={`h-3 rounded-sm ${cls}`}
              title={`${new Date(d.date).toLocaleDateString("ro-RO", { day: "2-digit", month: "short" })} · ${d.pings === 0 ? "fără date" : d.uptime_pct + "%"}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] uppercase tracking-wider text-stone-500">
        <span>{new Date(days[0].date).toLocaleDateString("ro-RO", { day: "2-digit", month: "short" })}</span>
        <span className="hidden sm:inline">Verde ≥99% · Amber ≥95% · Roșu &lt;95% · Gri = fără date</span>
        <span>azi</span>
      </div>
    </div>
  );
};

export const StatusPage = () => {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/public/status`);
      setData(r.data);
    } catch {/* ignore */} finally { setLoading(false); }
    try {
      const h = await axios.get(`${API}/public/status-history?days=30`);
      setHistory(h.data);
    } catch {/* ignore */}
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

        {/* Sparkline 30-day uptime */}
        <UptimeSparkline history={history} />

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
