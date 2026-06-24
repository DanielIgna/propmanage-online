// PropManage — Autopilot Activity Widget (last 24h)
// Shows: daily sweep result + AI match notifications + smoke test runs
// Placed inside AdminDashboard overview tab.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bot, Sparkles, Activity as ActivityIcon, ShieldCheck, RefreshCw } from "lucide-react";
import { API } from "./DashShared";

const fmtTime = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return "acum";
    if (diffMin < 60) return `acum ${diffMin}m`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `acum ${diffH}h`;
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short" });
  } catch {
    return iso;
  }
};

export const AutopilotWidget = () => {
  const [status, setStatus] = useState(null);
  const [smokeRuns, setSmokeRuns] = useState(0);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, sm] = await Promise.all([
        axios.get(`${API}/admin/autonomy/autopilot/status`).catch(() => null),
        axios.get(`${API}/admin/smoke-test/runs?limit=50`).catch(() => null),
      ]);
      setStatus(s?.data || null);
      const items = sm?.data?.items || sm?.data || [];
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      const recent = items.filter((r) => {
        const t = r.started_at || r.created_at;
        return t && new Date(t).getTime() > cutoff;
      });
      setSmokeRuns(recent.length);
    } finally {
      setLoading(false);
    }
  };

  const runSweep = async () => {
    setRunning(true);
    try {
      await axios.post(`${API}/admin/autonomy/autopilot/run-sweep`);
      await load();
    } catch (e) {
      alert("Sweep eșuat: " + (e.response?.data?.detail || e.message));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  const lastSweep = status?.last_sweep || {};
  const lastMatch = status?.last_ai_match_notification || {};
  const smokeEnabled = status?.smoke_test_monitor?.enabled;
  const matchEnabled = status?.auto_match_schedule?.enabled;
  const snapTs = status?.settings_snapshot?.last_ts;

  return (
    <div
      className="rounded-3xl p-6 mt-6 border border-[#d4ff3a]/20 bg-gradient-to-br from-[#0f1410] to-[#0a0a0b]"
      data-testid="autopilot-widget"
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4ff3a]/15 flex items-center justify-center">
            <Bot className="w-5 h-5 text-[#d4ff3a]" />
          </div>
          <div>
            <h3 className="font-serif text-xl">Autopilot Activity</h3>
            <div className="text-[10px] uppercase tracking-wider text-stone-500">
              Ultimele 24h · platforma se auto-întreține
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-[11px] text-stone-400 hover:text-stone-200 flex items-center gap-1 disabled:opacity-50"
            data-testid="autopilot-refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={runSweep}
            disabled={running}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-[#d4ff3a]/10 text-[#d4ff3a] hover:bg-[#d4ff3a]/20 border border-[#d4ff3a]/30 disabled:opacity-50"
            data-testid="autopilot-run-sweep"
          >
            {running ? "Rulează…" : "Sweep acum"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Smoke Tests last 24h */}
        <div className="rounded-2xl bg-white/5 border border-white/5 p-4" data-testid="autopilot-stat-smoke">
          <div className="flex items-center gap-2 mb-2">
            <ActivityIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] uppercase tracking-wider text-stone-400">Smoke Tests</span>
          </div>
          <div className="font-serif text-2xl">{smokeRuns}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            în ultimele 24h · {smokeEnabled ? "monitor ON" : "monitor OFF"}
          </div>
        </div>

        {/* QA findings auto-resolved */}
        <div className="rounded-2xl bg-white/5 border border-white/5 p-4" data-testid="autopilot-stat-sweep">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#d4ff3a]" />
            <span className="text-[10px] uppercase tracking-wider text-stone-400">Auto-Resolved</span>
          </div>
          <div className="font-serif text-2xl">
            {(lastSweep?.result?.qa_findings_resolved || 0) +
              (lastSweep?.result?.ai_findings_dismissed || 0)}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            ultim sweep: {fmtTime(lastSweep?.ran_at)}
          </div>
        </div>

        {/* AI matches notified */}
        <div className="rounded-2xl bg-white/5 border border-white/5 p-4" data-testid="autopilot-stat-match">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[10px] uppercase tracking-wider text-stone-400">AI Top-Matches</span>
          </div>
          <div className="font-serif text-2xl">{lastMatch?.notified_count ?? 0}</div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            {matchEnabled ? "auto-match ON" : "auto-match OFF"} · {fmtTime(lastMatch?.ran_at)}
          </div>
        </div>

        {/* Snapshot freshness */}
        <div className="rounded-2xl bg-white/5 border border-white/5 p-4" data-testid="autopilot-stat-snap">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] uppercase tracking-wider text-stone-400">Snapshot</span>
          </div>
          <div className="font-serif text-2xl">
            {snapTs ? "✓" : "—"}
          </div>
          <div className="text-[10px] text-stone-500 mt-0.5">
            {snapTs ? `actualizat ${fmtTime(snapTs)}` : "lipsește"}
          </div>
        </div>
      </div>

      <div className="mt-4 text-[10px] text-stone-500 flex items-center justify-between flex-wrap gap-2">
        <span>
          🤖 Autopilot rulează 3 module: smoke-monitor (la 30min) · daily sweep (04:15 BRC) · AI match
          real-time la fiecare cerere nouă.
        </span>
        <a
          href="/admin/autonomy"
          className="text-[#d4ff3a] hover:underline"
          data-testid="autopilot-link-autonomy"
        >
          Vezi Autonomy Engine →
        </a>
      </div>
    </div>
  );
};
