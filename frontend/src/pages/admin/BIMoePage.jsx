// Sprint F — BI-MOE Admin Dashboard. Read-only analytics.
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  TrendingUp, AlertTriangle, DollarSign, Users, Target, Award,
  Activity, BarChart3, Loader2, RefreshCcw, Lightbulb, Crown,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const BIMoePage = () => {
  const [tab, setTab] = useState("overview");
  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="bi-moe-page">
      <h1 className="font-serif text-3xl mb-1">📊 Business Intelligence — Sprint F</h1>
      <p className="text-sm text-stone-400 mb-6">Analize agregate, recomandări pentru optimizare. <strong className="text-amber-300">READ-ONLY</strong> — nicio decizie automată.</p>
      <div className="flex gap-2 mb-6 border-b border-white/10 overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: Activity },
          { id: "demand", label: "Demand Index", icon: TrendingUp },
          { id: "fees", label: "Fee Analytics", icon: DollarSign },
          { id: "funnel", label: "Funnel", icon: Target },
          { id: "specialists", label: "Performance", icon: Award },
          { id: "candidates", label: "Premium Candidates", icon: Crown },
          { id: "alerts", label: "Alerts", icon: AlertTriangle },
          { id: "clients", label: "Clienți", icon: Users },
        ].map(t => {
          const I = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 whitespace-nowrap ${tab === t.id ? "border-[#d4ff3a] text-[#d4ff3a]" : "border-transparent text-stone-400 hover:text-stone-200"}`} data-testid={`bi-tab-${t.id}`}>
              <I className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>
      {tab === "overview" && <OverviewTab />}
      {tab === "demand" && <DemandTab />}
      {tab === "fees" && <FeesTab />}
      {tab === "funnel" && <FunnelTab />}
      {tab === "specialists" && <SpecialistsTab />}
      {tab === "candidates" && <CandidatesTab />}
      {tab === "alerts" && <AlertsTab />}
      {tab === "clients" && <ClientsTab />}
    </div>
  );
};

const useFetch = (url) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const refresh = () => {
    setLoading(true);
    axios.get(url).then(r => setData(r.data)).catch(() => setData({ error: true })).finally(() => setLoading(false));
  };
  useEffect(() => { refresh(); }, [url]);
  return { data, loading, refresh };
};

const Card = ({ title, children, testid }) => (
  <div className="glass rounded-2xl p-5" data-testid={testid}>
    {title && <h3 className="font-serif text-lg mb-3">{title}</h3>}
    {children}
  </div>
);

const KPI = ({ label, value, sub, color = "text-[#d4ff3a]", testid }) => (
  <div className="glass rounded-xl p-4" data-testid={testid}>
    <div className="text-[10px] uppercase text-stone-500 tracking-wider mb-1">{label}</div>
    <div className={`text-2xl font-bold tabular-nums ${color}`}>{value}</div>
    {sub && <div className="text-[10px] text-stone-500 mt-1">{sub}</div>}
  </div>
);

const OverviewTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/overview`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  if (data?.error) return <div className="text-red-300">Eroare</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total useri" value={data.total_users} testid="kpi-total-users" />
        <KPI label="Specialiști activi" value={data.active_specialists} />
        <KPI label="Clienți activi" value={data.active_clients} />
        <KPI label="Useri noi (30z)" value={data.new_users_30d} color="text-emerald-400" />
        <KPI label="Cereri noi (30z)" value={data.new_requests_30d} />
        <KPI label="Finalizate (30z)" value={data.completed_30d} color="text-emerald-400" />
        <KPI label="Cereri deschise" value={data.open_requests} color="text-amber-400" />
        <KPI label="Revenue (30z, RON)" value={data.revenue_30d_ron.toLocaleString("ro-RO")} sub={`${data.completion_rate_30d_pct}% completion`} />
      </div>
    </div>
  );
};

const DemandTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/demand-index?days=30`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  if (data?.error) return <div className="text-red-300">Eroare</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="Top Categorii (cereri vs specialiști)" testid="demand-categories">
        <div className="space-y-1.5">
          {(data.categories || []).slice(0, 12).map(c => (
            <div key={c.category} className="flex items-center justify-between text-xs gap-2" data-testid={`cat-${c.category}`}>
              <span className="text-stone-300 truncate flex-1">{c.category}</span>
              <span className="tabular-nums text-stone-400 w-12 text-right">{c.requests} cer.</span>
              <span className="tabular-nums text-stone-500 w-14 text-right">{c.specialists} spec.</span>
              {c.alert && <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded-full ${c.alert === "no_specialists" ? "bg-red-500/20 text-red-300" : c.alert === "undersupplied" ? "bg-amber-500/20 text-amber-300" : "bg-blue-500/20 text-blue-300"}`}>{c.alert.replace("_", " ")}</span>}
            </div>
          ))}
        </div>
      </Card>
      <Card title="Top Zone" testid="demand-zones">
        <div className="space-y-1.5">
          {(data.zones || []).slice(0, 12).map(z => (
            <div key={z.zone} className="flex items-center justify-between text-xs">
              <span className="text-stone-300 truncate flex-1">{z.zone}</span>
              <span className="tabular-nums text-stone-400">{z.requests}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

const FeesTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/fee-analytics?days=30`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  if (data?.error) return <div className="text-red-300">Eroare</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="Total oferte" value={data.total_offers} />
        <KPI label="Win rate" value={`${data.win_rate_pct}%`} color="text-emerald-400" />
        <KPI label="Avg fee câștigat" value={`${data.avg_fee_won_ron} RON`} />
        <KPI label="Revenue (RON)" value={data.revenue_from_fees_ron.toLocaleString("ro-RO")} color="text-[#d4ff3a]" />
      </div>
      {(data.recommendations || []).length > 0 && (
        <Card title="Recomandări (auto-analizate)" testid="fee-recommendations">
          {data.recommendations.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-stone-200 mb-2" data-testid={`reco-${i}`}>
              <Lightbulb className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" /> {r.msg}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
};

const FunnelTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/conversion-funnel?days=30`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  return (
    <Card title={`Conversion Funnel (${data.window_days} zile)`} testid="funnel-chart">
      <div className="space-y-3">
        {data.steps.map((s, i) => (
          <div key={s.name} data-testid={`funnel-step-${i}`}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-stone-300">{s.name}</span>
              <span className="text-stone-400 tabular-nums">{s.count} · <strong className="text-[#d4ff3a]">{s.pct_of_total}%</strong></span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#d4ff3a] to-[#a8e028]" style={{ width: `${s.pct_of_total}%` }} />
            </div>
          </div>
        ))}
        <div className="text-xs text-stone-500 pt-2">Completion rate: <strong className="text-[#d4ff3a]">{data.completion_rate_pct}%</strong> · Abandonate: {data.abandoned}</div>
      </div>
    </Card>
  );
};

const SpecialistsTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/specialist-performance?limit=10`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card title="🏆 Top 10 Performance" testid="spec-top">
        {(data.top || []).map((s, i) => (
          <div key={s.specialist_id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
            <span className="text-stone-500 w-6">#{i + 1}</span>
            <span className="text-stone-200 flex-1 truncate">{s.name}</span>
            <span className="text-stone-400 tabular-nums">★{s.rating}</span>
            <span className="text-[#d4ff3a] font-semibold tabular-nums">{s.performance_score}</span>
          </div>
        ))}
      </Card>
      <Card title="⚠️ Bottom 10 (verifică manual)" testid="spec-bottom">
        {(data.bottom || []).map((s) => (
          <div key={s.specialist_id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5 last:border-0">
            <span className="text-stone-200 flex-1 truncate">{s.name}</span>
            <span className="text-stone-400 tabular-nums">★{s.rating}</span>
            {s.low_rating_flag && <AlertTriangle className="w-3 h-3 text-red-400" />}
            <span className="text-red-300 font-semibold tabular-nums">{s.performance_score}</span>
          </div>
        ))}
      </Card>
    </div>
  );
};

const CandidatesTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/premium-candidates`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  return (
    <Card title="Candidați PREMIUM (gata sau aproape)" testid="premium-candidates-list">
      <div className="text-xs text-stone-500 mb-3">Praguri: {data.thresholds?.min_completed_jobs} joburi · rating {data.thresholds?.min_rating} · {data.thresholds?.min_reviews} recenzii</div>
      {(data.items || []).length === 0 && <div className="text-xs text-stone-500 italic">Niciun candidat la cel puțin 60% din praguri.</div>}
      <div className="space-y-2">
        {(data.items || []).map(c => (
          <div key={c.id} className="bg-white/3 rounded-xl p-3 text-sm" data-testid={`candidate-${c.id}`}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold">{c.name}</span>
              <span className={`text-xs ${c.ready ? "text-emerald-400" : "text-amber-300"}`}>{c.overall_pct}% {c.ready && "✓ READY"}</span>
            </div>
            <div className="text-xs text-stone-400">Tier curent: <strong>{c.current_tier}</strong> · ★{c.rating} · {c.completed_jobs} joburi · {c.reviews} reviews</div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const AlertsTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/alerts`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  if ((data.items || []).length === 0) return <Card title="🟢 Niciun alert"><div className="text-xs text-stone-500">Platforma rulează normal.</div></Card>;
  return (
    <div className="space-y-2" data-testid="alerts-list">
      {data.items.map((a, i) => (
        <div key={i} className={`glass rounded-2xl p-4 border ${a.severity === "high" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5"}`} data-testid={`alert-${i}`}>
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 mt-0.5 ${a.severity === "high" ? "text-red-400" : "text-amber-300"}`} />
            <div>
              <div className="text-xs uppercase tracking-wider text-stone-500 mb-1">{a.type.replace(/_/g, " ")}</div>
              <div className="text-sm text-stone-200">{a.msg}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const ClientsTab = () => {
  const { data, loading } = useFetch(`${API}/api/admin/bi/client-analysis?days=90`);
  if (loading) return <Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" />;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="Clienți cu cereri" value={data.total_clients_with_requests} />
      <KPI label="Avg cereri/client" value={data.avg_requests_per_client} />
      <KPI label="Repeat clients" value={data.repeat_clients} color="text-emerald-400" sub={`${data.repeat_rate_pct}% repeat rate`} />
      <KPI label="One-time clients" value={data.one_time_clients} color="text-amber-400" />
    </div>
  );
};

export default BIMoePage;
