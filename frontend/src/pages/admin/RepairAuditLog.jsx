// RepairAuditLog — analytics per finding pattern: shows which AI repair suggestions
// are actually effective (applied/decided ratio) vs which patterns the LLM struggles with.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { BarChart3, TrendingUp, TrendingDown, RefreshCw, ChevronRight, Trophy, AlertOctagon, X } from "lucide-react";
import { AdminCard, AdminBtn } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

const WINDOWS = [
  { id: 7, label: "7 zile" },
  { id: 30, label: "30 zile" },
  { id: 90, label: "90 zile" },
];

const fmtPct = (v) => (v == null ? "—" : `${v}%`);

const Bar = ({ pct, color }) => (
  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
    <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} />
  </div>
);

const Stat = ({ label, value, color }) => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-2.5">
    <div className={`text-2xl font-semibold ${color || "text-slate-900 dark:text-slate-100"}`}>{value}</div>
    <div className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{label}</div>
  </div>
);

export const RepairAuditLog = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [drill, setDrill] = useState(null); // {pattern, items}

  const load = async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/admin/ai/repair-suggestions/audit?days=${days}`);
      setData(r.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [days]);

  const openDrill = async (pattern) => {
    try {
      const r = await axios.get(`${API}/admin/ai/repair-suggestions/by-pattern/${encodeURIComponent(pattern)}?days=${Math.max(days, 90)}`);
      setDrill({ pattern, items: r.data?.items || [] });
    } catch {
      setDrill({ pattern, items: [] });
    }
  };

  if (!data) {
    return (
      <AdminCard title={<div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Repair Audit Log</div>}>
        <div className="text-slate-400 text-sm italic py-4 text-center">Se încarcă...</div>
      </AdminCard>
    );
  }

  const { rows, totals, best_pattern, worst_pattern } = data;

  return (
    <AdminCard
      title={<div className="flex items-center gap-2"><BarChart3 className="w-4 h-4 text-indigo-500" /> Repair Audit Log <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">NEW</span></div>}
      action={
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5" data-testid="audit-window-selector">
            {WINDOWS.map(w => (
              <button
                key={w.id}
                onClick={() => setDays(w.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  days === w.id ? "bg-white dark:bg-slate-900 text-indigo-600 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700"
                }`}
                data-testid={`audit-window-${w.id}`}
              >{w.label}</button>
            ))}
          </div>
          <AdminBtn variant="secondary" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></AdminBtn>
        </div>
      }
    >
      {/* Global stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <Stat label="Sugestii totale" value={totals.total} />
        <Stat label="Aplicate" value={totals.applied} color="text-blue-600 dark:text-blue-400" />
        <Stat label="Aprobate (neaplicate)" value={totals.approved} color="text-emerald-600 dark:text-emerald-400" />
        <Stat label="Respinse" value={totals.rejected} color="text-red-600 dark:text-red-400" />
        <Stat label="Eficacitate globală" value={fmtPct(totals.global_effectiveness_pct)} color="text-indigo-600 dark:text-indigo-400" />
      </div>

      {/* Best / Worst */}
      {(best_pattern || worst_pattern) && (
        <div className="grid md:grid-cols-2 gap-3 mb-4">
          {best_pattern && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-700 dark:text-emerald-300">Cel mai eficient pattern</span>
              </div>
              <div className="font-medium text-sm text-emerald-900 dark:text-emerald-200">{best_pattern.pattern_label}</div>
              <div className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
                {best_pattern.effectiveness_pct}% applied / decided · {best_pattern.applied}/{best_pattern.total} sugestii
              </div>
            </div>
          )}
          {worst_pattern && worst_pattern.pattern !== best_pattern?.pattern && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertOctagon className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-[10px] uppercase tracking-wider font-bold text-red-700 dark:text-red-300">Cel mai puțin eficient</span>
              </div>
              <div className="font-medium text-sm text-red-900 dark:text-red-200">{worst_pattern.pattern_label}</div>
              <div className="text-xs text-red-700 dark:text-red-300 mt-1">
                {worst_pattern.effectiveness_pct}% applied / decided · LLM-ul se descurcă greu — verifică prompt-ul.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Per-pattern table */}
      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm italic">Nicio sugestie de fix în fereastra selectată.</div>
      ) : (
        <div className="overflow-x-auto" data-testid="repair-audit-rows">
          <table className="w-full text-xs">
            <thead className="text-slate-500 uppercase tracking-wider">
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-2 py-2">Pattern</th>
                <th className="text-right px-2 py-2">Total</th>
                <th className="text-right px-2 py-2">Aplicate</th>
                <th className="text-right px-2 py-2">Aprobate</th>
                <th className="text-right px-2 py-2">Respinse</th>
                <th className="text-left px-2 py-2 w-[140px]">Apply rate</th>
                <th className="text-right px-2 py-2">Eficacitate</th>
                <th className="text-right px-2 py-2">Avg min</th>
                <th className="text-right px-2 py-2">Avg regen</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {rows.map((r) => {
                const effGood = (r.effectiveness_pct ?? 0) >= 70;
                const effBad = r.effectiveness_pct != null && r.effectiveness_pct < 30;
                return (
                  <tr key={r.pattern} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => openDrill(r.pattern)} data-testid={`audit-row-${r.pattern}`}>
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-[260px]" title={r.pattern_label}>{r.pattern_label}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{r.pattern}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">{r.applied}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{r.approved}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{r.rejected}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] tabular-nums text-slate-500 w-9">{r.apply_rate_pct}%</span>
                        <div className="flex-1"><Bar pct={r.apply_rate_pct} color="bg-blue-500" /></div>
                      </div>
                    </td>
                    <td className={`px-2 py-2 text-right font-semibold tabular-nums ${effGood ? "text-emerald-600 dark:text-emerald-400" : effBad ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
                      {effGood && <TrendingUp className="w-3 h-3 inline mr-0.5" />}
                      {effBad && <TrendingDown className="w-3 h-3 inline mr-0.5" />}
                      {fmtPct(r.effectiveness_pct)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{r.avg_minutes}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">{r.avg_regenerations}</td>
                    <td className="px-2 py-2 text-slate-400"><ChevronRight className="w-3.5 h-3.5" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 text-[11px] text-slate-400 italic">
        Eficacitate = aplicate / (aplicate + aprobate + respinse). Patternul "best" trebuie să aibă ≥ 3 decizii. Click pe rând → drill-down.
      </div>

      {/* Drill-down modal */}
      {drill && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDrill(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()} data-testid="audit-drill-modal">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700">
              <div className="font-semibold text-sm">Sugestii pentru <span className="font-mono text-indigo-600 dark:text-indigo-400">{drill.pattern}</span></div>
              <button onClick={() => setDrill(null)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {drill.items.length === 0 && <div className="text-center py-8 text-slate-400 text-sm italic">Nicio sugestie</div>}
              {drill.items.map(s => (
                <div key={s.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs" data-testid={`audit-drill-item-${s.id}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                      s.status === "applied" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" :
                      s.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
                      s.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" :
                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}>{s.status}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold ${
                      s.risk_level === "high" ? "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300" :
                      s.risk_level === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
                      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                    }`}>risc {s.risk_level}</span>
                    <span className="ml-auto text-[10px] text-slate-400">{s.created_at ? new Date(s.created_at).toLocaleDateString("ro-RO") : ""}</span>
                  </div>
                  <div className="text-slate-700 dark:text-slate-300 mb-1">{s.summary}</div>
                  {s.decision_note && <div className="text-[10px] italic text-slate-500 mt-1">📝 "{s.decision_note}"</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AdminCard>
  );
};

export default RepairAuditLog;
