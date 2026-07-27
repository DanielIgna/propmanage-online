// RegistryGraph — graf interactiv din Enterprise Relationship Registry (doar relații dovedite).
// Folosit de Enterprise Explorer și Architecture Navigator.
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Loader2, X, ChevronRight } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

export const STATUS_STYLE = {
  VERIFIED: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  "PARTIALLY VERIFIED": "bg-amber-500/10 border-amber-500/30 text-amber-300",
  UNKNOWN: "bg-red-500/10 border-red-500/30 text-red-300",
  DEPRECATED: "bg-stone-500/10 border-stone-500/30 text-stone-400",
};
export const TYPE_META = {
  prompt: { label: "Prompturi", color: "#d4ff3a" },
  document: { label: "Documente", color: "#a78bfa" },
  engine: { label: "Engines", color: "#34d399" },
  metric: { label: "Metrici", color: "#fbbf24" },
  automation: { label: "Automations", color: "#f472b6" },
  api: { label: "API", color: "#38bdf8" },
  database: { label: "Database", color: "#fb923c" },
  dashboard: { label: "Dashboards", color: "#e7e5e4" },
};
export const TYPE_ORDER = ["prompt", "document", "engine", "metric", "automation", "api", "database", "dashboard"];

export const RegistryGraph = ({ typeFilter = null, search = "", onOpenDoc = null, focusNodeId = null }) => {
  const [reg, setReg] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => {
    axios.get(`${API}/api/founder/knowledge/registry`, { withCredentials: true })
      .then(r => setReg(r.data)).catch(() => {});
  }, []);
  useEffect(() => {
    if (reg && focusNodeId) setSel(reg.nodes.find(n => n.id === focusNodeId) || null);
  }, [reg, focusNodeId]);

  const view = useMemo(() => {
    if (!reg) return null;
    const q = search.trim().toLowerCase();
    let nodes = reg.nodes;
    if (typeFilter && typeFilter.size) nodes = nodes.filter(n => typeFilter.has(n.type));
    if (q) {
      const direct = new Set(reg.nodes.filter(n => n.name.toLowerCase().includes(q) || (n.ref || "").toLowerCase().includes(q)).map(n => n.id));
      const linked = new Set(direct);
      reg.edges.forEach(e => { if (direct.has(e.source)) linked.add(e.target); if (direct.has(e.target)) linked.add(e.source); });
      nodes = nodes.filter(n => linked.has(n.id));
    }
    const visible = new Set(nodes.map(n => n.id));
    const edges = reg.edges.filter(e => visible.has(e.source) && visible.has(e.target));
    const cols = TYPE_ORDER.filter(t => nodes.some(n => n.type === t));
    const pos = {};
    cols.forEach((t, ci) => {
      nodes.filter(n => n.type === t).forEach((n, ri) => { pos[n.id] = { x: ci * 235 + 10, y: ri * 54 + 46 }; });
    });
    const ys = Object.values(pos).map(p => p.y);
    return { nodes, edges, cols, pos, w: cols.length * 235 + 20, h: (ys.length ? Math.max(...ys) : 0) + 90 };
  }, [reg, typeFilter, search]);

  if (!reg || !view) return <div className="flex items-center gap-2 text-stone-400 text-sm p-6"><Loader2 className="w-4 h-4 animate-spin" /> Se încarcă registrul...</div>;
  const names = Object.fromEntries(reg.nodes.map(n => [n.id, n]));
  const selEdges = sel ? reg.edges.filter(e => e.source === sel.id || e.target === sel.id) : [];

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4" data-testid="registry-graph">
      <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl overflow-auto">
        <div className="text-[10px] text-stone-500 px-4 pt-3 flex flex-wrap gap-x-4 gap-y-1" data-testid="rg-stats">
          <span>{view.nodes.length}/{reg.stats.nodes} noduri · {view.edges.length}/{reg.stats.edges} relații</span>
          <span className="text-emerald-400">100% VERIFIED</span>
          <span className="text-stone-600">Doar relații dovedite din cod (Truth Engine D161)</span>
        </div>
        <div className="relative" style={{ width: view.w, height: view.h }}>
          <svg className="absolute inset-0" width={view.w} height={view.h}>
            {view.edges.map(e => {
              const s = view.pos[e.source], t = view.pos[e.target];
              if (!s || !t) return null;
              const hl = sel && (e.source === sel.id || e.target === sel.id);
              const x1 = s.x + 210, y1 = s.y + 18, x2 = t.x, y2 = t.y + 18;
              return <path key={e.id} d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                fill="none" stroke={hl ? "#d4ff3a" : "rgba(255,255,255,0.10)"} strokeWidth={hl ? 1.8 : 1} />;
            })}
          </svg>
          {view.cols.map((t, ci) => (
            <div key={t} className="absolute text-[10px] uppercase tracking-widest font-semibold" style={{ left: ci * 235 + 10, top: 14, color: TYPE_META[t].color }}>{TYPE_META[t].label}</div>
          ))}
          {view.nodes.map(n => {
            const p = view.pos[n.id];
            const active = sel?.id === n.id;
            return (
              <button key={n.id} onClick={() => setSel(active ? null : n)}
                className={`absolute w-[210px] text-left px-3 py-2 rounded-xl border text-[11px] leading-tight transition-colors ${active ? "border-[#d4ff3a] bg-[#d4ff3a]/10 text-white" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/30"}`}
                style={{ left: p.x, top: p.y }} data-testid={`rg-node-${n.id.replace(/[:]/g, "-")}`}>
                <span className="block truncate">{n.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 h-fit lg:sticky lg:top-24" data-testid="rg-node-panel">
        {!sel && <div className="text-xs text-stone-500">Selectează un nod: vezi ce îl alimentează, ce alimentează el și evidența fiecărei relații.</div>}
        {sel && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: TYPE_META[sel.type]?.color }}>{TYPE_META[sel.type]?.label}</div>
                <div className="font-serif text-lg text-white leading-snug" data-testid="rg-node-name">{sel.name}</div>
              </div>
              <button onClick={() => setSel(null)} className="p-1.5 rounded-lg bg-white/5"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="text-xs text-stone-400 mt-1.5">{sel.description}</div>
            <div className="text-[10px] font-mono text-stone-500 mt-1 break-all">{sel.ref}</div>
            {onOpenDoc && (sel.ref?.startsWith("memory/") || sel.ref?.startsWith("docs/")) && (
              <button onClick={() => onOpenDoc(sel.ref)} className="mt-2 text-[11px] text-[#d4ff3a] flex items-center gap-1" data-testid="rg-node-open-doc">Deschide documentul <ChevronRight className="w-3 h-3" /></button>
            )}
            <div className="mt-3 space-y-1.5 max-h-[50vh] overflow-y-auto">
              {selEdges.map(e => {
                const otherId = e.source === sel.id ? e.target : e.source;
                const dir = e.source === sel.id ? "→" : "←";
                return (
                  <div key={e.id} className="text-[11px] bg-white/[0.02] border border-white/10 rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[e.verification_status] || STATUS_STYLE.UNKNOWN}`}>{e.verification_status}</span>
                      <span className="text-stone-300">{dir} {names[otherId]?.name || otherId}</span>
                    </div>
                    <div className="text-[10px] text-stone-500 mt-0.5">{e.description}</div>
                    <div className="text-[9px] text-stone-600 mt-0.5">Evidență: {e.evidence}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
