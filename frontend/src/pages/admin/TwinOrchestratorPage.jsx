// TwinOrchestratorPage — Phase 2.1 read-only AI orchestrator for digital twins.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Sparkles, ChevronLeft, Loader2, Brain, AlertTriangle, RefreshCw,
  Eye, Activity, ChevronRight, CheckCircle2, X as XIcon,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const LIFECYCLE_COLOR = {
  active:    "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  draft:     "bg-blue-500/15 border-blue-500/40 text-blue-300",
  stale:     "bg-amber-500/15 border-amber-500/40 text-amber-300",
  abandoned: "bg-red-500/15 border-red-500/40 text-red-300",
};

const PRIORITY_COLOR = {
  high:   "bg-red-500/15 border-red-500/40 text-red-300",
  medium: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  low:    "bg-stone-500/15 border-stone-500/40 text-stone-300",
};

const TwinOrchestratorPage = () => {
  const [status, setStatus] = useState(null);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTwin, setSelectedTwin] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, o] = await Promise.all([
          ax.get("/api/admin/twin-orchestrator/status"),
          ax.get("/api/admin/twin-orchestrator/overview"),
        ]);
        setStatus(s.data);
        setOverview(o.data);
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3" data-testid="to-back">
          <ChevronLeft className="w-3.5 h-3.5" /> Înapoi la Admin Dashboard
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-cyan-300" />
          </div>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="to-title">
              Twin <span className="italic gradient-text">Orchestrator</span> AI
            </h1>
            <p className="text-sm text-stone-400 mt-2 max-w-3xl">
              Agent AI care înțelege întreaga viață a fiecărui Digital Twin. <strong>SUGGEST permission</strong> — generează insights, niciodată execută.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-stone-400 flex items-center justify-center gap-2 py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă twin-urile...
          </div>
        ) : (
          <>
            {/* PHASE BANNER */}
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 mb-5 flex items-start gap-3" data-testid="to-phase-banner">
              <Eye className="w-5 h-5 text-cyan-300 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-stone-300">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-cyan-200">{status?.phase}</strong>
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-mono ${status?.feature_flag_value ? "bg-emerald-500/15 text-emerald-300" : "bg-stone-500/15 text-stone-300"}`}>
                    Flag: {String(status?.feature_flag_value)}
                  </span>
                  <span className="text-[10px] uppercase px-2 py-0.5 rounded-full border bg-violet-500/15 border-violet-500/30 text-violet-300">
                    Permission: {status?.permission_level}
                  </span>
                </div>
                <div className="mt-2">{status?.note}</div>
              </div>
            </div>

            {/* KPIs */}
            {overview && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5" data-testid="to-overview">
                <KPI label="Total twins" value={overview.total_twins} color="cyan" />
                <KPI label="Active" value={overview.by_lifecycle?.active || 0} color="emerald" />
                <KPI label="Stale (>60z)" value={overview.stale_count} color="amber" />
                <KPI label="Abandoned (>180z)" value={overview.abandoned_count} color="red" />
              </div>
            )}

            {/* COMPLETENESS BUCKETS */}
            {overview?.by_completeness && (
              <div className="mb-5 bg-[#0e0e10] border border-white/10 rounded-2xl p-4" data-testid="to-completeness">
                <div className="text-xs uppercase tracking-wider text-stone-400 mb-3">Distribuție Completeness</div>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {Object.entries(overview.by_completeness).map(([range, count]) => (
                    <div key={range} className="bg-white/[0.02] border border-white/10 rounded-lg p-2 text-center">
                      <div className="text-[10px] text-stone-500">{range}%</div>
                      <div className="text-lg font-mono text-white mt-1">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SAMPLE TWINS */}
            <div className="bg-[#0e0e10] border border-white/10 rounded-2xl overflow-hidden" data-testid="to-twins-list">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-stone-400">
                  Sample twins ({overview?.sample?.length || 0} din {overview?.total_twins || 0})
                </div>
              </div>
              <div className="divide-y divide-white/5">
                {(overview?.sample || []).map((t) => (
                  <button key={t.twin_id} onClick={() => setSelectedTwin(t)}
                    className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors flex items-center gap-3"
                    data-testid={`to-twin-${t.twin_id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono text-[10px] text-stone-500">{t.twin_id?.slice(0, 12)}</span>
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded border ${LIFECYCLE_COLOR[t.lifecycle_status] || LIFECYCLE_COLOR.active}`}>
                          {t.lifecycle_status}
                        </span>
                        <span className="text-[10px] text-stone-500">Completeness: <strong className="text-stone-300">{t.completeness_score}%</strong></span>
                      </div>
                      <div className="text-sm text-white truncate">{t.name}</div>
                      {t.last_activity_at && <div className="text-[10px] text-stone-500">Ultim: {new Date(t.last_activity_at).toLocaleString("ro-RO")}</div>}
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-600" />
                  </button>
                ))}
                {(!overview?.sample || overview.sample.length === 0) && (
                  <div className="px-4 py-8 text-center text-stone-500 text-sm">Niciun twin în sistem.</div>
                )}
              </div>
            </div>

            <div className="mt-6 bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-3 text-xs text-cyan-100 flex items-start gap-2">
              <Brain className="w-3.5 h-3.5 shrink-0 mt-0.5 text-cyan-300" />
              <div>
                Pentru a genera <strong>AI insights</strong> per twin (Claude Sonnet), activează feature flag <code className="bg-white/10 px-1 rounded">enable_twin_orchestrator</code> în <Link to="/admin/settings" className="underline">Admin Settings</Link>.
                Cache: 6h per twin. Cost: ~0.012€/insight (~0.50€/lună la 40 twins active).
              </div>
            </div>
          </>
        )}
      </div>

      {selectedTwin && (
        <TwinInsightModal
          twin={selectedTwin}
          flagOn={status?.feature_flag_value}
          onClose={() => setSelectedTwin(null)}
        />
      )}
    </div>
  );
};

const KPI = ({ label, value, color }) => {
  const cls = {
    cyan:    "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
    emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
    amber:   "border-amber-500/30 bg-amber-500/5 text-amber-300",
    red:     "border-red-500/30 bg-red-500/5 text-red-300",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-mono mt-2 text-white">{value}</div>
    </div>
  );
};

const TwinInsightModal = ({ twin, flagOn, onClose }) => {
  const [detail, setDetail] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await ax.get(`/api/admin/twin-orchestrator/twin/${twin.twin_id}`);
        setDetail(data);
      } catch (e) { setError(e?.response?.data?.detail || "Eroare la încărcare twin"); }
      finally { setLoading(false); }
    })();
  }, [twin.twin_id]);

  const genInsights = async (force = false) => {
    setGenerating(true);
    setError(null);
    try {
      const { data } = await ax.post(`/api/admin/twin-orchestrator/twin/${twin.twin_id}/insights?force_refresh=${force}`);
      setInsights(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "Eroare la generare insights");
    } finally { setGenerating(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-sm" data-testid="to-insight-modal">
      <div className="bg-[#0a0a0b] border border-cyan-500/30 rounded-2xl max-w-2xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <h2 className="font-serif text-lg text-white truncate max-w-md">{twin.name}</h2>
              <p className="text-[11px] text-stone-500 font-mono">{twin.twin_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center" data-testid="to-modal-close">
            <XIcon className="w-4 h-4 text-stone-400" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-4">
          {loading && <div className="text-center text-stone-400 py-6"><Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Se încarcă...</div>}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> {error}
            </div>
          )}
          {detail && (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat label="Lifecycle" value={detail.lifecycle_status} />
                <Stat label="Completeness" value={`${detail.completeness_score}%`} />
                <Stat label="Maintenance logs" value={detail.maintenance_summary?.total || 0} />
                <Stat label="Engagement" value={`${detail.engagement?.comments || 0} 💬 · ${detail.engagement?.pins || 0} 📍`} />
              </div>

              {detail.maintenance_summary?.recent?.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2">Maintenance recente</div>
                  <div className="space-y-1">
                    {detail.maintenance_summary.recent.map((m, i) => (
                      <div key={i} className="bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 text-xs">
                        <div className="flex items-center gap-2"><span className="text-stone-400">{m.type}</span><span className="text-stone-500">·</span><span className="text-stone-300">{m.status}</span><span className="ml-auto text-[10px] text-stone-500">{m.created_at && new Date(m.created_at).toLocaleDateString("ro-RO")}</span></div>
                        {m.summary && <div className="text-stone-400 mt-1">{m.summary}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI INSIGHTS */}
              <div className="border-t border-white/10 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                    <Brain className="w-3.5 h-3.5" /> AI Insights (Claude)
                  </div>
                  {flagOn ? (
                    <button onClick={() => genInsights(insights ? true : false)} disabled={generating}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-xs hover:bg-cyan-500/25 disabled:opacity-50"
                      data-testid="to-gen-insights">
                      {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {insights ? "Refresh" : "Generează"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-300">⚠ Feature flag OFF</span>
                  )}
                </div>
                {insights && (
                  <div className="space-y-2">
                    {insights.from_cache && <div className="text-[10px] text-stone-500">📦 din cache (6h)</div>}
                    {insights.insights?.summary && (
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3 text-sm text-stone-200">{insights.insights.summary}</div>
                    )}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <Stat label="Risk score" value={`${insights.insights?.risk_score ?? "—"}/100`} />
                      <Stat label="Opportunity score" value={`${insights.insights?.opportunity_score ?? "—"}/100`} />
                    </div>
                    {insights.insights?.suggestions?.length > 0 && (
                      <div className="space-y-1.5">
                        {insights.insights.suggestions.map((s, i) => (
                          <div key={i} className="bg-white/[0.02] border border-white/10 rounded-lg p-3" data-testid={`to-suggestion-${i}`}>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[s.priority] || PRIORITY_COLOR.low}`}>{s.priority}</span>
                              <span className="text-[10px] text-stone-500">· {s.category}</span>
                            </div>
                            <div className="text-sm text-white">{s.title}</div>
                            <div className="text-xs text-stone-400 mt-1">{s.rationale}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!insights && !generating && flagOn && (
                  <div className="text-center py-4 text-stone-500 text-xs">Apasă "Generează" pentru analiza AI a acestui twin (cost ~0.012€).</div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const Stat = ({ label, value }) => (
  <div className="bg-white/[0.02] border border-white/10 rounded-lg p-2">
    <div className="text-[10px] uppercase tracking-wider text-stone-500">{label}</div>
    <div className="text-sm font-mono text-white mt-0.5">{value}</div>
  </div>
);

export default TwinOrchestratorPage;
