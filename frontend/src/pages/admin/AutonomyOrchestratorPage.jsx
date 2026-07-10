// AutonomyOrchestratorPage — dispecerul transversal de autonomie (Sprint 1).
// Route: /admin/orchestrator
import React, { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Workflow, ChevronLeft, Loader2, RefreshCcw, Zap, Clock, CheckCircle2,
  AlertTriangle, ShieldAlert, Play, Timer, Gauge, MailWarning, FlaskConical,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const OUTCOME_META = {
  auto_resolved: { label: "Auto-rezolvat", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  retry_scheduled: { label: "Retry programat", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" },
  monitored: { label: "Monitorizat", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  escalated: { label: "Escaladat la om", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  error: { label: "Eroare playbook", color: "bg-red-500/15 text-red-300 border-red-500/30" },
  skipped_disabled: { label: "Playbook oprit", color: "bg-stone-500/15 text-stone-300 border-stone-500/30" },
};

const PLAYBOOK_ICON = {
  smoke_fail_to_qa: FlaskConical,
  autonomy_reflex: Gauge,
  webhook_retry_guardian: MailWarning,
};

const StatCard = ({ icon: Icon, label, value, accent }) => (
  <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-4" data-testid={`orch-stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
    <div className="flex items-center gap-2 text-xs text-stone-400 uppercase tracking-wider">
      <Icon className={`w-3.5 h-3.5 ${accent}`} /> {label}
    </div>
    <div className="text-2xl font-bold text-white mt-1.5">{value}</div>
  </div>
);

const PlaybookCard = ({ pb, onToggle, onSimulate, simulating }) => {
  const Icon = PLAYBOOK_ICON[pb.id] || Workflow;
  const oc = OUTCOME_META[pb.last_outcome] || null;
  return (
    <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-4 flex flex-col gap-3" data-testid={`playbook-${pb.id}`}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-violet-500/15 border border-violet-500/30">
          <Icon className="w-4 h-4 text-violet-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white">{pb.name}</div>
          <div className="text-xs text-stone-400 mt-1 leading-relaxed">{pb.description}</div>
        </div>
        <button
          onClick={() => onToggle(pb)}
          className={`relative w-10 h-5.5 h-6 rounded-full transition-colors ${pb.enabled ? "bg-emerald-500" : "bg-stone-700"}`}
          title={pb.enabled ? "Dezactivează" : "Activează"}
          data-testid={`toggle-${pb.id}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${pb.enabled ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-stone-400">
        <span className="px-2 py-0.5 rounded-lg bg-stone-800">{pb.runs_total} rulări</span>
        {pb.last_run_at && <span className="px-2 py-0.5 rounded-lg bg-stone-800">ultima: {new Date(pb.last_run_at).toLocaleString("ro-RO")}</span>}
        {oc && <span className={`px-2 py-0.5 rounded-lg border ${oc.color}`}>{oc.label}</span>}
        <div className="flex-1" />
        <button
          onClick={() => onSimulate(pb.signal_kind)}
          disabled={simulating || !pb.enabled}
          className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white flex items-center gap-1 font-medium"
          data-testid={`simulate-${pb.id}`}
        >
          {simulating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Simulează
        </button>
      </div>
    </div>
  );
};

const LedgerEntry = ({ e }) => {
  const oc = OUTCOME_META[e.outcome] || OUTCOME_META.monitored;
  return (
    <div className="border border-stone-800 rounded-2xl p-4 bg-stone-900/30" data-testid={`ledger-entry-${e.id}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-white">{e.playbook_name}</span>
        {e.test && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">TEST</span>}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-lg border ${oc.color}`}>{oc.label}</span>
        <div className="flex-1" />
        {(e.minutes_saved || 0) > 0 && (
          <span className="text-[11px] text-emerald-300 flex items-center gap-1"><Timer className="w-3 h-3" /> ~{e.minutes_saved} min salvate</span>
        )}
        <span className="text-[11px] text-stone-500">{new Date(e.ts).toLocaleString("ro-RO")}</span>
      </div>
      {(e.steps || []).length > 0 && (
        <div className="mt-2.5 space-y-1.5">
          {e.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              {s.ok
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                : <AlertTriangle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />}
              <div>
                <span className="text-stone-300 font-medium">{s.action}</span>
                <span className="text-stone-500"> — {s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function AutonomyOrchestratorPage() {
  const [overview, setOverview] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, l] = await Promise.all([
        ax.get("/api/admin/orchestrator/overview"),
        ax.get("/api/admin/orchestrator/ledger", { params: { limit: 50 } }),
      ]);
      setOverview(o.data);
      setLedger(l.data?.items || []);
    } catch (e) {
      setMsg(`❌ ${e?.response?.data?.detail || e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (pb) => {
    try {
      await ax.post(`/api/admin/orchestrator/playbooks/${pb.id}/toggle`, { enabled: !pb.enabled });
      setOverview(o => ({ ...o, playbooks: o.playbooks.map(x => x.id === pb.id ? { ...x, enabled: !pb.enabled } : x) }));
    } catch (e) { setMsg(`❌ ${e?.response?.data?.detail || e.message}`); }
  };

  const simulate = async (kind) => {
    setSimulating(true);
    setMsg(null);
    try {
      const r = await ax.post(`/api/admin/orchestrator/simulate/${kind}`);
      const out = r.data?.ledger?.outcome;
      setMsg(`✅ Semnal '${kind}' simulat → ${OUTCOME_META[out]?.label || out}. Vezi ledger-ul de mai jos.`);
      await load();
    } catch (e) {
      setMsg(`❌ ${e?.response?.data?.detail || e.message}`);
    } finally {
      setSimulating(false);
    }
  };

  const forceRetryTick = async () => {
    try {
      const r = await ax.post("/api/admin/orchestrator/retry-tick");
      setMsg(`🔁 Retry tick: ${r.data.processed} procesate, ${r.data.sent} trimise, ${r.data.rescheduled} reprogramate, ${r.data.failed_permanent} eșuate definitiv.`);
      await load();
    } catch (e) { setMsg(`❌ ${e?.response?.data?.detail || e.message}`); }
  };

  return (
    <div className="min-h-screen bg-stone-950 p-4 lg:p-8" data-testid="orchestrator-page">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 flex-wrap mb-6">
          <Link to="/admin" className="text-stone-500 hover:text-white flex items-center gap-1 text-sm" data-testid="orch-back-link">
            <ChevronLeft className="w-4 h-4" /> Admin
          </Link>
          <span className="text-stone-700">·</span>
          <Workflow className="w-5 h-5 text-violet-400" />
          <h1 className="text-xl lg:text-2xl font-bold text-white">Autonomy Orchestrator</h1>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">Sprint 1 · Self-Healing</span>
          <div className="flex-1" />
          <Link to="/admin/autonomy" className="px-3 py-1.5 text-xs rounded-lg border border-stone-700 text-stone-300 hover:text-white flex items-center gap-1.5" data-testid="orch-to-autonomy">
            <Gauge className="w-3.5 h-3.5" /> Autonomy Engine
          </Link>
          <button onClick={forceRetryTick} className="px-3 py-1.5 text-xs rounded-lg border border-stone-700 text-stone-300 hover:text-white flex items-center gap-1.5" data-testid="orch-retry-tick">
            <RefreshCcw className="w-3.5 h-3.5" /> Forțează retry tick
          </button>
        </div>

        {msg && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-stone-900/60 border border-stone-700 text-sm text-stone-200" data-testid="orch-message">{msg}</div>
        )}

        {loading && !overview ? (
          <div className="p-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-stone-500" /></div>
        ) : overview && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <StatCard icon={Zap} label="Acțiuni azi" value={overview.today.actions} accent="text-violet-400" />
              <StatCard icon={Timer} label="Minute salvate azi" value={`~${overview.today.minutes_saved}`} accent="text-emerald-400" />
              <StatCard icon={CheckCircle2} label="Auto-rezolvate azi" value={overview.today.auto_resolved} accent="text-emerald-400" />
              <StatCard icon={ShieldAlert} label="Escaladări azi" value={overview.today.escalated} accent="text-rose-400" />
              <StatCard icon={Clock} label="Minute salvate total" value={`~${overview.total_minutes_saved}`} accent="text-cyan-400" />
            </div>

            <div className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">Playbook-uri active</div>
            <div className="grid lg:grid-cols-3 gap-3 mb-8">
              {overview.playbooks.map(pb => (
                <PlaybookCard key={pb.id} pb={pb} onToggle={toggle} onSimulate={simulate} simulating={simulating} />
              ))}
            </div>

            <div className="flex items-center gap-2 mb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-stone-500">Ledger — ce a făcut orchestratorul</div>
              {overview.retry_pending > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30" data-testid="orch-retry-pending">
                  {overview.retry_pending} retry în coadă
                </span>
              )}
            </div>
            {ledger.length === 0 ? (
              <div className="p-10 text-center text-sm text-stone-500 border border-dashed border-stone-800 rounded-2xl" data-testid="orch-ledger-empty">
                Niciun eveniment încă. Simulează un semnal din cardurile de mai sus pentru a vedea cascada completă.
              </div>
            ) : (
              <div className="space-y-3" data-testid="orch-ledger-list">
                {ledger.map(e => <LedgerEntry key={e.id} e={e} />)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
