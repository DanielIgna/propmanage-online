// Audit Log — view all admin actions (CMS edits, user bans, setting changes, presets, etc.)
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Search, Download, RefreshCw, ChevronRight } from "lucide-react";
import { AdminCard, AdminBtn } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

const ACTION_META = {
  "cms.update": { color: "blue", icon: "📝", label: "CMS Editat" },
  "cms.reset": { color: "amber", icon: "↺", label: "CMS Resetat" },
  "cms.rollback": { color: "violet", icon: "⏪", label: "CMS Rollback" },
  "settings.update": { color: "violet", icon: "⚙️", label: "Setări actualizate" },
  "settings.rollback": { color: "violet", icon: "⏪", label: "Setări Rollback" },
  "user.update": { color: "blue", icon: "👤", label: "User editat" },
  "user.ban": { color: "red", icon: "🚫", label: "User banat" },
  "user.unban": { color: "emerald", icon: "✓", label: "User reactivat" },
  "trust_weights.update": { color: "amber", icon: "⭐", label: "Trust weights" },
  "trust_weights.rollback": { color: "violet", icon: "⏪", label: "Trust Rollback" },
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
  const [rolling, setRolling] = useState(null);
  const [toast, setToast] = useState("");
  const [selected, setSelected] = useState([]); // up to 2 ids for diff compare
  const [showCompare, setShowCompare] = useState(false);

  const toggleSelect = (id) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // FIFO drop oldest
      return [...prev, id];
    });
  };

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const doRollback = async (entry) => {
    if (!window.confirm(`Restaurezi starea anterioară pentru "${entry.target_label || entry.action}"?\n\nAceasta va crea o intrare nouă în audit log de tip "${entry.action}.rollback".`)) return;
    setRolling(entry.id);
    try {
      await axios.post(`${API}/admin/audit-log/${entry.id}/rollback`);
      flash(`✓ Restaurat cu succes: ${entry.target_label || entry.action}`);
      setExpanded(null);
      load();
    } catch (e) {
      flash(`❌ ${e?.response?.data?.detail || "Eroare la rollback"}`);
    } finally {
      setRolling(null);
    }
  };

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
          {selected.length === 2 && (
            <AdminBtn variant="primary" type="button" onClick={() => setShowCompare(true)} data-testid="audit-compare-btn">
              🔬 Compară selectate (2)
            </AdminBtn>
          )}
          {selected.length === 1 && (
            <span className="text-xs text-slate-500" data-testid="compare-hint">Selectează încă unul pentru compare</span>
          )}
        </form>
      </AdminCard>

      <AdminCard testid="audit-list-card">
        {toast && <div className="mb-3 text-sm font-medium text-emerald-600 dark:text-emerald-400" data-testid="audit-toast">{toast}</div>}
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
            const isSelected = selected.includes(e.id);
            return (
              <div
                key={e.id}
                className={`rounded-lg border ${
                  isSelected
                    ? "border-amber-400 dark:border-amber-500/60 bg-amber-50 dark:bg-amber-500/10 ring-2 ring-amber-200 dark:ring-amber-500/30"
                    : isOpen ? "border-blue-200 dark:border-blue-500/30 bg-blue-50/30 dark:bg-blue-500/5" : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30"
                } transition-colors`}
                data-testid={`audit-row-${e.id}`}
              >
                <div className="flex items-stretch">
                  <label className="flex items-center justify-center pl-3 cursor-pointer shrink-0" title="Selectează pentru compare">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(e.id)}
                      className="w-4 h-4 accent-amber-500"
                      data-testid={`audit-select-${e.id}`}
                    />
                  </label>
                  <button
                    onClick={() => hasDetail && setExpanded(isOpen ? null : e.id)}
                    className="flex-1 flex items-center gap-3 p-3 text-left"
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
                </div>

                {isOpen && hasDetail && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-800" data-testid={`audit-detail-${e.id}`}>
                    <div className="grid md:grid-cols-2 gap-3">
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
                    {e.rollbackable && e.before && (
                      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          💡 Poți reveni la starea anterioară cu un singur click.
                        </div>
                        <AdminBtn
                          variant="primary"
                          onClick={() => doRollback(e)}
                          disabled={rolling === e.id}
                          data-testid={`audit-rollback-${e.id}`}
                        >
                          {rolling === e.id ? "Se restaurează..." : "↺ Restaurează valoarea anterioară"}
                        </AdminBtn>
                      </div>
                    )}
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

      {showCompare && selected.length === 2 && (
        <CompareDiffModal
          entryA={data.items.find(i => i.id === selected[0])}
          entryB={data.items.find(i => i.id === selected[1])}
          onClose={() => setShowCompare(false)}
          onClear={() => { setSelected([]); setShowCompare(false); }}
        />
      )}
    </div>
  );
};

// ============= COMPARE DIFF MODAL =============
const CompareDiffModal = ({ entryA, entryB, onClose, onClear }) => {
  if (!entryA || !entryB) return null;
  // Order chronologically: older = A, newer = B
  const [older, newer] = (new Date(entryA.created_at) <= new Date(entryB.created_at))
    ? [entryA, entryB] : [entryB, entryA];

  // Smart compare: prefer "after" of each (final state after that action)
  // If action was a reset/delete → use "before" (what existed before reset)
  const stateOf = (e) => {
    if (e.action === "cms.reset") return e.before;
    return e.after || e.before;
  };

  const olderState = stateOf(older);
  const newerState = stateOf(newer);

  // Compute key-level diff if both are objects
  const isObjA = olderState && typeof olderState === "object";
  const isObjB = newerState && typeof newerState === "object";
  const keys = isObjA && isObjB
    ? Array.from(new Set([...Object.keys(olderState), ...Object.keys(newerState)]))
    : null;

  const sameTarget = entryA.target_id === entryB.target_id && entryA.target_type === entryB.target_type;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-5xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={e => e.stopPropagation()}
        data-testid="compare-modal"
      >
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 className="text-lg font-semibold">🔬 Diff Compare</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {sameTarget
                ? <>Aceeași țintă: <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{entryA.target_label}</span></>
                : <>⚠️ Țintele sunt diferite — compararea poate fi mai puțin relevantă.</>
              }
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <ColumnHeader entry={older} role="Mai vechi" tone="red" />
          <ColumnHeader entry={newer} role="Mai nou" tone="emerald" />
        </div>

        {keys ? (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden" data-testid="compare-table">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-slate-500 font-bold">Câmp</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 font-bold">Mai vechi</th>
                  <th className="text-left py-2 px-3 text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">Mai nou</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(k => {
                  const v1 = (olderState || {})[k];
                  const v2 = (newerState || {})[k];
                  const changed = JSON.stringify(v1) !== JSON.stringify(v2);
                  return (
                    <tr key={k} className={`border-t border-slate-100 dark:border-slate-800/50 ${changed ? "bg-amber-50/40 dark:bg-amber-500/5" : ""}`}>
                      <td className="py-2 px-3 font-mono text-xs">{k}{changed && <span className="ml-1 text-[9px] text-amber-600 dark:text-amber-400">●</span>}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">{v1 === undefined ? <em className="text-slate-400">— absent —</em> : typeof v1 === "object" ? JSON.stringify(v1) : String(v1)}</td>
                      <td className="py-2 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">{v2 === undefined ? <em className="text-slate-400">— absent —</em> : typeof v2 === "object" ? JSON.stringify(v2) : String(v2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-[11px] text-slate-500 border-t border-slate-200 dark:border-slate-700">
              Rândurile cu <span className="text-amber-600 dark:text-amber-400">●</span> au valoare diferită între cele 2 momente.
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-red-600 font-bold mb-1">Mai vechi</div>
              <pre className="bg-red-50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/20 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-64">{olderState === null || olderState === undefined ? "— gol —" : String(olderState)}</pre>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold mb-1">Mai nou</div>
              <pre className="bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-lg p-3 text-xs font-mono overflow-x-auto max-h-64">{newerState === null || newerState === undefined ? "— gol —" : String(newerState)}</pre>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <AdminBtn variant="secondary" onClick={onClear} data-testid="compare-clear">Deselectează & închide</AdminBtn>
          <AdminBtn variant="primary" onClick={onClose} data-testid="compare-close">Închide</AdminBtn>
        </div>
      </div>
    </div>
  );
};

const ColumnHeader = ({ entry, role, tone }) => {
  const meta = ACTION_META[entry.action] || { icon: "•", label: entry.action, color: "slate" };
  const tones = {
    red: "border-red-200 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5",
    emerald: "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5",
  };
  return (
    <div className={`p-3 rounded-xl border ${tones[tone]}`}>
      <div className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-1">{role}</div>
      <div className="text-sm font-medium">{meta.icon} {meta.label}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{entry.actor_name} · {fmtTime(entry.created_at)}</div>
    </div>
  );
};
