// AIGovernancePage — Phase 1 observability-only dashboard.
//
// Single pane of glass for all AI agents: registry, costs, audit trail.
// READ-ONLY. No agent modifications possible from this UI.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Shield, ChevronLeft, Loader2, Brain, Activity, Coins,
  History, AlertTriangle, Users, Eye, Sparkles,
  ArchiveRestore, CheckCircle2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const LIFECYCLE_COLOR = {
  active:       "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  legacy:       "bg-amber-500/10 border-amber-500/40 text-amber-300",
  experimental: "bg-blue-500/10 border-blue-500/40 text-blue-300",
  deprecated:   "bg-red-500/10 border-red-500/40 text-red-300",
};

const PERMISSION_COLOR = {
  read:                       "bg-stone-500/10 border-stone-500/40 text-stone-300",
  suggest:                    "bg-blue-500/10 border-blue-500/40 text-blue-300",
  "execute-with-approval":    "bg-amber-500/10 border-amber-500/40 text-amber-300",
  execute:                    "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  autonomous:                 "bg-violet-500/10 border-violet-500/40 text-violet-300",
};

const CATEGORY_LABEL = {
  control_plane:  "Control Plane",
  development:    "Development",
  quality:        "Quality",
  security:       "Security",
  knowledge:      "Knowledge",
  memory:         "Memory",
  reporting:      "Reporting",
  marketplace:    "Marketplace",
  concierge:      "Concierge",
  investigation:  "Investigation",
};

const TABS = [
  { id: "agents",   label: "Agenți",       icon: Users },
  { id: "costs",    label: "Costuri",      icon: Coins },
  { id: "audit",    label: "Audit Trail",  icon: History },
];

const AIGovernancePage = () => {
  const [tab, setTab] = useState("agents");
  const [summary, setSummary] = useState(null);
  const [agents, setAgents] = useState([]);
  const [costs, setCosts] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, a, c, au] = await Promise.all([
          ax.get("/api/admin/ai-governance/summary"),
          ax.get("/api/admin/ai-governance/agents"),
          ax.get("/api/admin/ai-governance/costs"),
          ax.get("/api/admin/ai-governance/audit-trail"),
        ]);
        setSummary(s.data);
        setAgents(a.data.agents || []);
        setCosts(c.data);
        setAudit(au.data.events || []);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3" data-testid="gov-back">
          <ChevronLeft className="w-3.5 h-3.5" /> Înapoi la Admin Dashboard
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-violet-300" />
          </div>
          <div className="flex-1">
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="gov-title">
              AI <span className="italic gradient-text">Governance</span> Center
            </h1>
            <p className="text-sm text-stone-400 mt-2 max-w-3xl">
              Observability layer over the entire AI ecosystem. <strong>Read-only Phase 1</strong> — agenții nu pot fi modificați de aici.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-stone-400 flex items-center justify-center gap-2 py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă ecosistemul...
          </div>
        ) : (
          <>
            {/* SUMMARY KPIs */}
            {summary && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6" data-testid="gov-summary">
                <KPI label="Agenți activi" value={summary.by_lifecycle?.active || 0} icon={Brain} color="emerald" />
                <KPI label="Legacy" value={summary.by_lifecycle?.legacy || 0} icon={ArchiveRestore} color="amber" />
                <KPI label="Activitate 24h" value={summary.global_activity_24h} icon={Activity} color="violet" />
                <KPI label="Activitate 7d" value={summary.global_activity_7d} icon={Activity} color="blue" />
                <KPI label="Cost lunar est." value={`~${costs?.estimated_total_monthly_eur ?? 0}€`} icon={Coins} color="amber" />
              </div>
            )}

            {/* PHASE BANNER */}
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/5 p-4 mb-6 flex items-start gap-3" data-testid="gov-phase-banner">
              <Eye className="w-5 h-5 text-violet-300 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-stone-300">
                <strong className="text-violet-200">{summary?.phase}</strong> — {summary?.note}
              </div>
            </div>

            {/* TABS */}
            <div className="flex flex-wrap gap-2 mb-4">
              {TABS.map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-colors ${
                      tab === t.id ? "bg-white/10 border-white/30 text-white" : "bg-[#0e0e10] border-white/10 text-stone-400 hover:text-white"
                    }`}
                    data-testid={`gov-tab-${t.id}`}
                  >
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-6">
              {tab === "agents" && <AgentsTab agents={agents} />}
              {tab === "costs"  && <CostsTab costs={costs} />}
              {tab === "audit"  && <AuditTab events={audit} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const KPI = ({ label, value, icon: Icon, color }) => {
  const cls = {
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-300",
    violet:  "border-violet-500/30 bg-violet-500/5 text-violet-300",
    blue:    "border-blue-500/30 bg-blue-500/5 text-blue-300",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider">{label}</div>
        <Icon className="w-4 h-4 opacity-60" />
      </div>
      <div className="text-2xl font-mono mt-2 text-white">{value}</div>
    </div>
  );
};

const AgentsTab = ({ agents }) => {
  // Group by category
  const grouped = agents.reduce((acc, a) => {
    (acc[a.category] = acc[a.category] || []).push(a);
    return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([cat, list]) => (
        <div key={cat} data-testid={`gov-cat-${cat}`}>
          <h3 className="text-xs uppercase tracking-wider text-stone-400 mb-2">{CATEGORY_LABEL[cat] || cat} ({list.length})</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            {list.map(a => (
              <div key={a.slug} className="bg-white/[0.02] border border-white/10 rounded-xl p-4" data-testid={`gov-agent-${a.slug}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-[10px] text-stone-500">{a.slug}</span>
                  <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border ${LIFECYCLE_COLOR[a.lifecycle]}`}>{a.lifecycle}</span>
                  <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border ${PERMISSION_COLOR[a.permission_level]}`}>{a.permission_level}</span>
                </div>
                <div className="text-sm font-semibold text-white">{a.name}</div>
                <div className="text-xs text-stone-400 mt-1">{a.purpose}</div>
                <div className="mt-3 flex items-center gap-3 text-[10px] text-stone-500 flex-wrap">
                  <span><Activity className="w-3 h-3 inline mr-0.5" /> 24h: <strong className="text-stone-300">{a.live?.items_24h ?? 0}</strong></span>
                  <span>7d: <strong className="text-stone-300">{a.live?.items_7d ?? 0}</strong></span>
                  <span>Total: <strong className="text-stone-300">{a.live?.total_items ?? 0}</strong></span>
                  {a.live?.latest_activity_at && (
                    <span className="ml-auto">Ultim: {new Date(a.live.latest_activity_at).toLocaleString("ro-RO")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const CostsTab = ({ costs }) => {
  if (!costs) return null;
  return (
    <div className="space-y-4">
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-100 flex items-start gap-2" data-testid="gov-costs-disclaimer">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-300" />
        <div>{costs.disclaimer}</div>
      </div>
      <div className="text-sm">
        Cost lunar total estimat: <strong className="text-2xl font-mono text-amber-300 ml-2">~{costs.estimated_total_monthly_eur}€</strong>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-stone-500 border-b border-white/10">
            <tr>
              <th className="text-left px-2 py-2">Agent</th>
              <th className="text-left px-2 py-2">Provider</th>
              <th className="text-right px-2 py-2">Apeluri 7d</th>
              <th className="text-right px-2 py-2">Estimat lunar (apeluri)</th>
              <th className="text-right px-2 py-2">€/apel</th>
              <th className="text-right px-2 py-2">Cost lunar</th>
            </tr>
          </thead>
          <tbody>
            {costs.breakdown.map(b => (
              <tr key={b.slug} className="border-b border-white/5 hover:bg-white/[0.02]" data-testid={`gov-cost-${b.slug}`}>
                <td className="px-2 py-2 text-white">{b.name}</td>
                <td className="px-2 py-2 text-violet-300 font-mono">{b.provider}</td>
                <td className="px-2 py-2 text-right text-stone-300 font-mono">{b.calls_last_7d}</td>
                <td className="px-2 py-2 text-right text-stone-300 font-mono">{b.estimated_monthly_calls}</td>
                <td className="px-2 py-2 text-right text-stone-500 font-mono">{b.avg_eur_per_call}</td>
                <td className="px-2 py-2 text-right text-amber-300 font-mono font-semibold">~{b.estimated_monthly_eur}€</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const KIND_COLOR = {
  qa:         "bg-blue-500/10 border-blue-500/40 text-blue-300",
  ai_finding: "bg-violet-500/10 border-violet-500/40 text-violet-300",
  ai_scan:    "bg-violet-500/10 border-violet-500/40 text-violet-300",
  security:   "bg-red-500/10 border-red-500/40 text-red-300",
  autonomy:   "bg-emerald-500/10 border-emerald-500/40 text-emerald-300",
  match:      "bg-amber-500/10 border-amber-500/40 text-amber-300",
  briefing:   "bg-stone-500/10 border-stone-500/40 text-stone-300",
  digest:     "bg-stone-500/10 border-stone-500/40 text-stone-300",
  smoke_test: "bg-blue-500/10 border-blue-500/40 text-blue-300",
};

const AuditTab = ({ events }) => {
  if (!events || events.length === 0) {
    return <div className="text-center py-10 text-stone-500 text-sm">Niciun eveniment în audit trail.</div>;
  }
  return (
    <div className="space-y-2" data-testid="gov-audit-list">
      {events.map((e, i) => (
        <div key={i} className="bg-white/[0.02] border border-white/10 rounded-xl px-4 py-3 flex items-start gap-3" data-testid={`gov-audit-${i}`}>
          <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border shrink-0 ${KIND_COLOR[e.kind] || "bg-stone-500/10 border-stone-500/40 text-stone-300"}`}>{e.kind}</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white truncate">{e.title}</div>
            <div className="text-[10px] text-stone-500 mt-0.5 font-mono">{e.source}</div>
          </div>
          {e.at && <div className="text-[10px] text-stone-500 shrink-0">{new Date(e.at).toLocaleString("ro-RO")}</div>}
        </div>
      ))}
    </div>
  );
};

export default AIGovernancePage;
