// Enterprise Knowledge Center — EXECUTION ORDER 002 (Founder-only).
// Module 1: repository pe categorii · Module 2: căutare globală · Module 3/11: Dependency Map
// din Enterprise Relationship Registry (doar relații VERIFIED — Truth Engine D161).
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  BookOpenCheck, Loader2, Search, Network, FileText, ShieldAlert, X, ChevronRight, RefreshCcw,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const STATUS_STYLE = {
  VERIFIED: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  "PARTIALLY VERIFIED": "bg-amber-500/10 border-amber-500/30 text-amber-300",
  UNKNOWN: "bg-red-500/10 border-red-500/30 text-red-300",
  DEPRECATED: "bg-stone-500/10 border-stone-500/30 text-stone-400",
};
const TYPE_META = {
  prompt: { label: "Prompturi", color: "#d4ff3a" },
  document: { label: "Documente", color: "#a78bfa" },
  engine: { label: "Engines", color: "#34d399" },
  metric: { label: "Metrici", color: "#fbbf24" },
  automation: { label: "Automations", color: "#f472b6" },
  api: { label: "API", color: "#38bdf8" },
  database: { label: "Database", color: "#fb923c" },
  dashboard: { label: "Dashboards", color: "#e7e5e4" },
};
const TYPE_ORDER = ["prompt", "document", "engine", "metric", "automation", "api", "database", "dashboard"];

const MD = {
  h1: (p) => <h1 className="text-2xl font-serif text-white mt-2 mb-3 pb-2 border-b border-white/10" {...p} />,
  h2: (p) => <h2 className="text-lg font-serif text-[#d4ff3a] mt-6 mb-2" {...p} />,
  h3: (p) => <h3 className="text-base font-semibold text-white mt-4 mb-1.5" {...p} />,
  p: (p) => <p className="text-sm text-stone-300 leading-relaxed my-2" {...p} />,
  ul: (p) => <ul className="list-disc ml-5 text-sm text-stone-300 my-2 space-y-1" {...p} />,
  ol: (p) => <ol className="list-decimal ml-5 text-sm text-stone-300 my-2 space-y-1" {...p} />,
  a: (p) => <a className="text-[#d4ff3a] underline" {...p} />,
  code: ({ inline, ...p }) => inline
    ? <code className="bg-white/10 text-[#d4ff3a] px-1.5 py-0.5 rounded text-[12px] font-mono" {...p} />
    : <code className="block bg-black/40 text-emerald-200 p-3 rounded-lg text-[12px] font-mono overflow-x-auto my-2 border border-white/5" {...p} />,
  blockquote: (p) => <blockquote className="border-l-4 border-[#d4ff3a]/40 bg-[#d4ff3a]/5 pl-4 py-2 my-3 text-sm text-stone-200 italic" {...p} />,
  table: (p) => <div className="my-3 overflow-x-auto"><table className="min-w-full text-xs border border-white/10" {...p} /></div>,
  th: (p) => <th className="px-3 py-2 text-left text-stone-200 font-semibold border-b border-white/10 bg-white/[0.04]" {...p} />,
  td: (p) => <td className="px-3 py-2 text-stone-300 border-b border-white/5" {...p} />,
  strong: (p) => <strong className="text-white font-semibold" {...p} />,
  hr: (p) => <hr className="border-white/10 my-5" {...p} />,
};

const RelationRow = ({ r, onOpen }) => (
  <button onClick={() => r.other_ref?.startsWith("memory/") || r.other_ref?.startsWith("docs/") ? onOpen(r.other_ref) : null}
    className="w-full text-left text-xs bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 hover:border-[#d4ff3a]/30"
    data-testid={`kc-rel-${r.id}`}>
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_STYLE[r.verification_status] || STATUS_STYLE.UNKNOWN}`}>{r.verification_status}</span>
      <span style={{ color: TYPE_META[r.other_type]?.color }}>{r.other_name}</span>
      <span className="text-stone-500">· {r.type}</span>
    </div>
    <div className="text-[10px] text-stone-500 mt-1">Evidență: {r.evidence} · Confidence: {r.confidence}</div>
  </button>
);

const DocViewerPanel = ({ path, onClose, onOpen }) => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setData(null); setErr(null);
    ax.get(`/api/founder/knowledge/doc`, { params: { path } })
      .then(r => setData(r.data)).catch(e => setErr(e?.response?.data?.detail || "Eroare"));
  }, [path]);
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex justify-end" data-testid="kc-doc-viewer">
      <div className="w-full max-w-3xl h-full bg-[#0e0e10] border-l border-white/10 overflow-y-auto">
        <div className="sticky top-0 bg-[#0e0e10]/95 backdrop-blur border-b border-white/10 p-5 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-serif text-xl text-white truncate" data-testid="kc-doc-title">{data?.meta?.title || path}</div>
              {data && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-400 mt-1.5" data-testid="kc-doc-meta">
                  <span>v{data.meta.version}</span>
                  <span className={data.meta.status.startsWith("Draft") ? "text-amber-300" : "text-emerald-300"}>{data.meta.status}</span>
                  <span>{data.meta.author}</span>
                  <span>{data.meta.category}</span>
                  <span>Actualizat: {new Date(data.meta.updated).toLocaleDateString("ro-RO")}</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 shrink-0" data-testid="kc-doc-close"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="p-5">
          {err && <div className="text-red-300 text-sm">{err}</div>}
          {!data && !err && <div className="flex items-center gap-2 text-stone-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Se încarcă...</div>}
          {data && (
            <>
              {(data.relationships?.depends_on?.length > 0 || data.relationships?.used_by?.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-3 mb-5" data-testid="kc-doc-relationships">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-1.5">Depinde de / Guvernat de</div>
                    <div className="space-y-1.5">{data.relationships.depends_on.map(r => <RelationRow key={r.id} r={r} onOpen={onOpen} />)}
                      {!data.relationships.depends_on.length && <div className="text-xs text-stone-600">—</div>}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-stone-500 mb-1.5">Folosit de / Influențează</div>
                    <div className="space-y-1.5">{data.relationships.used_by.map(r => <RelationRow key={r.id} r={r} onOpen={onOpen} />)}
                      {!data.relationships.used_by.length && <div className="text-xs text-stone-600">—</div>}</div>
                  </div>
                </div>
              )}
              {data.relationships?.note && <div className="text-[11px] text-stone-500 border border-white/10 rounded-lg px-3 py-2 mb-5">{data.relationships.note}</div>}
              <ReactMarkdown components={MD}>{data.content}</ReactMarkdown>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const DependencyMap = ({ onOpenDoc }) => {
  const [reg, setReg] = useState(null);
  const [sel, setSel] = useState(null);
  useEffect(() => { ax.get(`/api/founder/knowledge/registry`).then(r => setReg(r.data)).catch(() => {}); }, []);
  const layout = useMemo(() => {
    if (!reg) return null;
    const cols = TYPE_ORDER.filter(t => reg.nodes.some(n => n.type === t));
    const pos = {};
    cols.forEach((t, ci) => {
      reg.nodes.filter(n => n.type === t).forEach((n, ri) => { pos[n.id] = { x: ci * 235 + 10, y: ri * 54 + 46 }; });
    });
    const h = Math.max(...Object.values(pos).map(p => p.y)) + 90;
    return { cols, pos, w: cols.length * 235 + 20, h };
  }, [reg]);
  if (!reg || !layout) return <div className="flex items-center gap-2 text-stone-400 text-sm p-6"><Loader2 className="w-4 h-4 animate-spin" /> Se încarcă registrul...</div>;
  const selEdges = sel ? reg.edges.filter(e => e.source === sel.id || e.target === sel.id) : [];
  const names = Object.fromEntries(reg.nodes.map(n => [n.id, n]));
  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-4" data-testid="kc-dependency-map">
      <div className="bg-[#0a0a0b] border border-white/10 rounded-2xl overflow-auto">
        <div className="text-[10px] text-stone-500 px-4 pt-3 flex flex-wrap gap-x-4 gap-y-1" data-testid="kc-map-stats">
          <span>{reg.stats.nodes} noduri · {reg.stats.edges} relații</span>
          {Object.entries(reg.stats.edges_by_status).map(([s, n]) => <span key={s} className={s === "VERIFIED" ? "text-emerald-400" : "text-amber-300"}>{s}: {n}</span>)}
          <span className="text-stone-600">Doar relații dovedite din cod (Truth Engine D161)</span>
        </div>
        <div className="relative" style={{ width: layout.w, height: layout.h }}>
          <svg className="absolute inset-0" width={layout.w} height={layout.h}>
            {reg.edges.map(e => {
              const s = layout.pos[e.source], t = layout.pos[e.target];
              if (!s || !t) return null;
              const hl = sel && (e.source === sel.id || e.target === sel.id);
              const x1 = s.x + 210, y1 = s.y + 18, x2 = t.x, y2 = t.y + 18;
              return <path key={e.id} d={`M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}`}
                fill="none" stroke={hl ? "#d4ff3a" : "rgba(255,255,255,0.10)"} strokeWidth={hl ? 1.8 : 1} />;
            })}
          </svg>
          {layout.cols.map((t, ci) => (
            <div key={t} className="absolute text-[10px] uppercase tracking-widest font-semibold" style={{ left: ci * 235 + 10, top: 14, color: TYPE_META[t].color }}>{TYPE_META[t].label}</div>
          ))}
          {reg.nodes.map(n => {
            const p = layout.pos[n.id];
            const active = sel?.id === n.id;
            return (
              <button key={n.id} onClick={() => setSel(active ? null : n)}
                className={`absolute w-[210px] text-left px-3 py-2 rounded-xl border text-[11px] leading-tight transition-colors ${active ? "border-[#d4ff3a] bg-[#d4ff3a]/10 text-white" : "border-white/10 bg-white/[0.03] text-stone-300 hover:border-white/30"}`}
                style={{ left: p.x, top: p.y }} data-testid={`kc-node-${n.id.replace(/[:]/g, "-")}`}>
                <span className="block truncate">{n.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 h-fit lg:sticky lg:top-24" data-testid="kc-node-panel">
        {!sel && <div className="text-xs text-stone-500">Selectează un nod pentru detalii: cine depinde de el, ce folosește, cu ce evidență.</div>}
        {sel && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide" style={{ color: TYPE_META[sel.type]?.color }}>{TYPE_META[sel.type]?.label}</div>
                <div className="font-serif text-lg text-white leading-snug" data-testid="kc-node-name">{sel.name}</div>
              </div>
              <button onClick={() => setSel(null)} className="p-1.5 rounded-lg bg-white/5"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="text-xs text-stone-400 mt-1.5">{sel.description}</div>
            <div className="text-[10px] font-mono text-stone-500 mt-1 break-all">{sel.ref}</div>
            {(sel.ref?.startsWith("memory/") || sel.ref?.startsWith("docs/")) && (
              <button onClick={() => onOpenDoc(sel.ref)} className="mt-2 text-[11px] text-[#d4ff3a] flex items-center gap-1" data-testid="kc-node-open-doc">Deschide documentul <ChevronRight className="w-3 h-3" /></button>
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

export default function KnowledgeCenter() {
  const location = useLocation();
  const [tree, setTree] = useState(null);
  const [denied, setDenied] = useState(false);
  const [cat, setCat] = useState(null);
  const [tab, setTab] = useState("docs");
  const [openPath, setOpenPath] = useState(null);
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(() => {
    ax.get(`/api/founder/knowledge/tree`)
      .then(r => { setTree(r.data); setDenied(false); })
      .catch(e => { if (e?.response?.status === 403) setDenied(true); });
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const doc = new URLSearchParams(location.search).get("doc");
    if (doc) setOpenPath(doc);
  }, [location.search]);

  const doSearch = async (e) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setSearching(true);
    try { const r = await ax.get(`/api/founder/knowledge/search`, { params: { q: q.trim() } }); setResults(r.data); }
    catch { /* noop */ } finally { setSearching(false); }
  };

  if (denied) return (
    <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center text-stone-400 gap-3" data-testid="kc-denied">
      <ShieldAlert className="w-8 h-8 text-amber-400" />
      <div className="text-sm">Enterprise Knowledge Center este disponibil exclusiv Fondatorului.</div>
      <Link to="/admin" className="text-[#d4ff3a] text-xs underline">← Înapoi la Admin</Link>
    </div>
  );
  if (!tree) return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-stone-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se încarcă Knowledge Center...</div>;

  const activeCat = tree.categories.find(c => c.name === cat) || null;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-16">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <Link to="/admin" className="text-xs text-stone-400 hover:text-white mb-3 inline-block">← Înapoi la Admin</Link>
            <h1 className="font-serif text-4xl tracking-tight flex items-center gap-3" data-testid="kc-title">
              <BookOpenCheck className="w-8 h-8 text-[#d4ff3a]" /> Enterprise Knowledge Center
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 text-[#d4ff3a] font-sans tracking-normal">FOUNDER ONLY</span>
            </h1>
            <p className="text-sm text-stone-400 mt-1">{tree.total} documente de guvernanță · toate verbatim (Memory Rule 001) · relații doar dovedite (Truth Engine D161).</p>
          </div>
          <button onClick={load} className="pm-btn pm-btn-secondary" data-testid="kc-refresh"><RefreshCcw className="w-3.5 h-3.5" /> Refresh</button>
        </div>

        <form onSubmit={doSearch} className="flex gap-2 mb-6">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută în toată guvernanța + registry (documente, engines, API-uri, dashboards)..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#d4ff3a]/50" data-testid="kc-search-input" />
          </div>
          <button type="submit" className="pm-btn pm-btn-success" disabled={searching} data-testid="kc-search-btn">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Caută"}
          </button>
          {results && <button type="button" onClick={() => { setResults(null); setQ(""); }} className="pm-btn pm-btn-secondary" data-testid="kc-search-clear"><X className="w-3.5 h-3.5" /></button>}
        </form>

        {results && (
          <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 mb-6" data-testid="kc-search-results">
            <div className="text-xs text-stone-400 mb-3">{results.total} rezultate pentru „{results.query}"</div>
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {results.documents.map(d => (
                <button key={d.path} onClick={() => setOpenPath(d.path)} className="w-full text-left text-xs bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 hover:border-[#d4ff3a]/30" data-testid={`kc-result-${d.path.replace(/[/.]/g, "-")}`}>
                  <div className="flex items-center gap-2"><FileText className="w-3 h-3 text-[#d4ff3a] shrink-0" /><span className="text-stone-200 truncate">{d.title}</span><span className="text-stone-600">· {d.category} · {d.occurrences}×</span></div>
                  {d.snippet && <div className="text-[10px] text-stone-500 mt-0.5 truncate">{d.snippet}</div>}
                </button>
              ))}
              {results.registry_nodes.map(n => (
                <div key={n.id} className="text-xs bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2"><Network className="w-3 h-3 shrink-0" style={{ color: TYPE_META[n.type]?.color }} /><span className="text-stone-200">{n.name}</span><span className="text-stone-600">· {TYPE_META[n.type]?.label}</span></div>
                  <div className="text-[10px] text-stone-500 font-mono mt-0.5">{n.ref}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab("docs")} className={`pm-btn pm-btn-sm ${tab === "docs" ? "pm-btn-success" : "pm-btn-secondary"}`} data-testid="kc-tab-docs"><FileText className="w-3.5 h-3.5" /> Documente</button>
          <button onClick={() => setTab("map")} className={`pm-btn pm-btn-sm ${tab === "map" ? "pm-btn-success" : "pm-btn-secondary"}`} data-testid="kc-tab-map"><Network className="w-3.5 h-3.5" /> Dependency Map</button>
        </div>

        {tab === "map" && <DependencyMap onOpenDoc={setOpenPath} />}

        {tab === "docs" && (
          <div className="grid lg:grid-cols-[260px_1fr] gap-5">
            <div className="space-y-1" data-testid="kc-categories">
              <button onClick={() => setCat(null)} className={`w-full text-left text-xs px-3 py-2 rounded-lg border ${!cat ? "border-[#d4ff3a]/40 bg-[#d4ff3a]/5 text-white" : "border-white/10 text-stone-400 hover:text-white"}`} data-testid="kc-cat-all">
                Toate categoriile <span className="float-right text-stone-500">{tree.total}</span>
              </button>
              {tree.categories.map(c => (
                <button key={c.name} onClick={() => setCat(c.name)} className={`w-full text-left text-xs px-3 py-2 rounded-lg border ${cat === c.name ? "border-[#d4ff3a]/40 bg-[#d4ff3a]/5 text-white" : "border-white/10 text-stone-400 hover:text-white"}`} data-testid={`kc-cat-${c.name.replace(/\s/g, "-")}`}>
                  {c.name} <span className="float-right text-stone-500">{c.count}</span>
                </button>
              ))}
            </div>
            <div className="space-y-1.5" data-testid="kc-doc-list">
              {(activeCat ? [activeCat] : tree.categories).flatMap(c => c.docs.map(d => (
                <button key={d.path} onClick={() => setOpenPath(d.path)} className="w-full text-left bg-white/[0.02] border border-white/10 rounded-xl px-4 py-2.5 hover:border-[#d4ff3a]/30 flex items-center gap-3" data-testid={`kc-doc-${d.path.replace(/[/.]/g, "-")}`}>
                  <FileText className="w-3.5 h-3.5 text-[#d4ff3a] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-stone-200 truncate">{d.title}</div>
                    <div className="text-[10px] text-stone-500">{d.category} · v{d.version} · {d.author}</div>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 ${d.status.startsWith("Draft") ? "bg-amber-500/10 border-amber-500/30 text-amber-300" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"}`}>{d.status.startsWith("Draft") ? "DRAFT" : "ACTIVE"}</span>
                </button>
              )))}
            </div>
          </div>
        )}
      </div>
      {openPath && <DocViewerPanel path={openPath} onClose={() => setOpenPath(null)} onOpen={setOpenPath} />}
    </div>
  );
}
