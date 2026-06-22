// Admin Overview — Autopilot Activity card (last 24h)
// Matches AdminCard style (light + dark mode).
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Bot, Sparkles, Activity as ActivityIcon, ShieldCheck, RefreshCw, Zap } from "lucide-react";
import { AdminCard } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

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

const StatCell = ({ icon: Icon, label, value, sub, tid, tone = "violet" }) => {
  const tones = {
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    cyan: "bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  };
  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50"
      data-testid={tid}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-medium">
          {label}
        </div>
        <div className="text-2xl font-bold leading-tight mt-0.5">{value}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>
      </div>
    </div>
  );
};

export const AutopilotActivityCard = () => {
  const [status, setStatus] = useState(null);
  const [smokeRuns, setSmokeRuns] = useState(0);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, sm] = await Promise.all([
        axios.get(`${API}/admin/autonomy/autopilot/status`).catch(() => null),
        axios.get(`${API}/admin/smoke-test/history?limit=80`).catch(() => null),
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
  const resolved =
    (lastSweep?.result?.qa_findings_resolved || 0) + (lastSweep?.result?.ai_findings_dismissed || 0);

  return (
    <AdminCard
      testid="autopilot-activity-card"
      title={
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4 text-violet-500" />
          <span>Autopilot Activity</span>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-normal">
            ultimele 24h
          </span>
        </div>
      }
      action={
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="text-[11px] px-2 py-1 rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 flex items-center gap-1 disabled:opacity-50"
            data-testid="autopilot-refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={runSweep}
            disabled={running}
            className="text-[11px] px-3 py-1.5 rounded-md bg-violet-500 text-white hover:bg-violet-600 disabled:opacity-50 flex items-center gap-1"
            data-testid="autopilot-run-sweep"
          >
            <Zap className="w-3 h-3" />
            {running ? "Rulează…" : "Sweep acum"}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCell
          icon={ActivityIcon}
          tone="cyan"
          label="Smoke Tests"
          value={smokeRuns}
          sub={`în 24h · monitor ${smokeEnabled ? "ON" : "OFF"}`}
          tid="autopilot-stat-smoke"
        />
        <StatCell
          icon={Sparkles}
          tone="green"
          label="Auto-Resolved"
          value={resolved}
          sub={`ultim sweep: ${fmtTime(lastSweep?.ran_at)}`}
          tid="autopilot-stat-sweep"
        />
        <StatCell
          icon={Bot}
          tone="violet"
          label="AI Top-Matches"
          value={lastMatch?.notified_count ?? 0}
          sub={`auto-match ${matchEnabled ? "ON" : "OFF"} · ${fmtTime(lastMatch?.ran_at)}`}
          tid="autopilot-stat-match"
        />
        <StatCell
          icon={ShieldCheck}
          tone="amber"
          label="Snapshot Setări"
          value={snapTs ? "✓" : "—"}
          sub={snapTs ? `actualizat ${fmtTime(snapTs)}` : "lipsește"}
          tid="autopilot-stat-snap"
        />
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-500 dark:text-slate-400">
        <span>
          🤖 3 module: smoke-monitor (30min) · daily sweep (04:15 BRC) · AI match real-time per cerere.
        </span>
        <a
          href="/admin/autonomy"
          className="text-violet-600 dark:text-violet-400 hover:underline font-medium"
          data-testid="autopilot-link-autonomy"
        >
          Vezi Autonomy Engine →
        </a>
      </div>
    </AdminCard>
  );
};
