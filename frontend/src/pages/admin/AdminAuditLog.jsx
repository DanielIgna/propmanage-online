// Audit Log — view all admin actions (CMS edits, user bans, setting changes, presets, etc.)
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Search, Download, RefreshCw, ChevronRight } from "lucide-react";
import { AdminCard, AdminBtn } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

const ACTION_META = {
  "cms.update": { color: "blue", icon: "📝", label: "CMS Editat" },
  "cms.reset": { color: "amber", icon: "↺", label: "CMS Resetat" },
  "settings.update": { color: "violet", icon: "⚙️", label: "Setări actualizate" },
  "user.update": { color: "blue", icon: "👤", label: "User editat" },
  "user.ban": { color: "red", icon: "🚫", label: "User banat" },
  "user.unban": { color: "emerald", icon: "✓", label: "User reactivat" },
  "trust_weights.update": { color: "amber", icon: "⭐", label: "Trust weights" },
  "preset.create": { color: "emerald", icon: "💾", label: "Preset creat" },
  "preset.delete": { color: "red", icon: "🗑️", label: "Preset șters" },
};

const COLOR_CLS = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-400",
  red: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

const fmtTime = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ro-RO", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return iso; }
};

const formatDiff = (val) => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") {
    try { return JSON.stringify(val, null, 2); } catch { return String(val); }
  }
  return String(val);
};

export const AdminAuditLog = () => {
  const [data, setData] = useState({ items: [], total: 0 });
  const [actions, setActions] = useState([]);
  const [filterAction, setFilterAction] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(false);
  const [skip, setSkip] = useState(0);

  const load = () => {
    setLoading(true);
    const params = { limit: 100, skip };
    if (filterAction) params.action = filterAction;
    if (q) params.q = q;
    axios.get(`${API}/admin/audit-log`, { params })
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    axios.get(`${API}/admin/audit-log/actions`).then(r => setActions(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [filterAction, skip]);

  const onSearch = (e) => { e.preventDefault(); setSkip(0); load(); };

  return (
    <div className="space-y-4">
      <AdminCard>
        <form onSubmit={onSearch} className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Caută după actor, target, notă..."
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              data-testid="audit-search"
            />
          </div>
          <select
            value={filterAction}
            onChange={e => { setFilterAction(e.target.value); setSkip(0); }}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
            data-testid="audit-action-filter"
          >
            <option value="">Toate acțiunile</option>
            {actions.map(a => (
              <option key={a.action} value={a.action}>
                {ACTION_META[a.action]?.label || a.action} ({a.count})
              </option>
            ))}
          </select>
          <AdminBtn variant="ghost" type="button" onClick={load} data-testid="audit-refresh">
            <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Refresh
          </AdminBtn>
          <AdminBtn variant="secondary" type="button" onClick={() => window.open(`${API}/admin/audit-log/export.csv`, "_blank")} data-testid="audit-export-csv">
            <Download className="w-3.5 h-3.5 inline mr-1" /> CSV
          </AdminBtn>
        </form>
      </AdminCard>

      <AdminCard testid="audit-list-card">
        {loading && <div className="text-center py-8 text-slate-500">Se încarcă...</div>}
        {!loading && data.items.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            Niciun eveniment în audit log{filterAction || q ? " pentru acest filtru" : ""}.
          </div>
        )}

        <div className="space-y-1.5">
          {data.items.map(e => {
            const meta = ACTION_META[e.action] || { color: "slate", icon: "•", label: e.action };
            const isOpen = expanded === e.id;
            const hasDetail = e.before || e.after || e.note;
            return (
              <div
                key={e.id}
                className={`rounded-lg border ${isOpen ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"} transition-colors`}
                data-testid={`audit-row-${e.id}`}
              >
                <button
                  onClick={() => hasDetail && setExpanded(isOpen ? null : e.id)}
                  className="w-full flex items-center gap-3 p-3 text-left"
                  disabled={!hasDetail}
                >
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-full shrink-0 ${COLOR_CLS[meta.color] || COLOR_CLS.slate}`}>
                    {meta.icon} {meta.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <span className="font-medium">{e.actor_name || "Sistem"}</span>
                      <span className="text-slate-500"> a modificat </span>
                      <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{e.target_label || e.target_type || "—"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{fmtTime(e.created_at)} · {e.actor_email}</div>
                  </div>
                  {hasDetail && (
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                  )}
                </button>

                {isOpen && hasDetail && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800 grid md:grid-cols-2 gap-3" data-testid={`audit-detail-${e.id}`}>
                    {e.before && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 font-bold mb-1">Înainte</div>
                        <pre className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-lg p-2 text-[11px] font-mono overflow-x-auto max-h-48">{formatDiff(e.before)}</pre>
                      </div>
                    )}
                    {e.after && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold mb-1">După</div>
                        <pre className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-lg p-2 text-[11px] font-mono overflow-x-auto max-h-48">{formatDiff(e.after)}</pre>
                      </div>
                    )}
                    {e.note && <div className="md:col-span-2 text-xs italic text-slate-600 dark:text-slate-300">📝 {e.note}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {data.total > 0 && (
          <div className="flex justify-between items-center pt-4 mt-2 text-sm">
            <div className="text-slate-500">Total: <b>{data.total}</b> evenimente</div>
            <div className="flex gap-2">
              <AdminBtn variant="secondary" onClick={() => setSkip(Math.max(0, skip - 100))} disabled={skip === 0}>← Anterior</AdminBtn>
              <AdminBtn variant="secondary" onClick={() => setSkip(skip + 100)} disabled={skip + 100 >= data.total}>Următor →</AdminBtn>
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  );
};
