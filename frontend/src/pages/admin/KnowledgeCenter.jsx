// Enterprise Knowledge Center — IDE mode (EO-002 R5): stânga categorii · centru documente ·
// dreapta inspector; jos timeline. Lifecycle (R2/R3), Health Score (R4), Review Mode (R7).
import React, { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  BookOpenCheck, Loader2, Search, Network, FileText, ShieldAlert, X, RefreshCcw, ClipboardCheck, Clock,
} from "lucide-react";
import { RegistryGraph, STATUS_STYLE, TYPE_META } from "../../components/founder/RegistryGraph";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const LIFECYCLE_STYLE = {
  Active: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  Approved: "bg-lime-500/10 border-lime-500/30 text-lime-300",
  Review: "bg-sky-500/10 border-sky-500/30 text-sky-300",
  Draft: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  Superseded: "bg-stone-500/10 border-stone-500/30 text-stone-400",
  Archived: "bg-stone-500/10 border-stone-500/30 text-stone-400",
  Deprecated: "bg-red-500/10 border-red-500/30 text-red-300",
};
const StatusBadge = ({ s }) => (
  <span className={`text-[9px] px-2 py-0.5 rounded-full border shrink-0 uppercase ${LIFECYCLE_STYLE[s] || LIFECYCLE_STYLE.Review}`}>{s}</span>
);

const MD = {
  h1: (p) => <h1 className="text-xl font-serif text-white mt-2 mb-3 pb-2 border-b border-white/10" {...p} />,
  h2: (p) => <h2 className="text-base font-serif text-[#d4ff3a] mt-5 mb-2" {...p} />,
  h3: (p) => <h3 className="text-sm font-semibold text-white mt-4 mb-1.5" {...p} />,
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

const HealthBar = ({ label, value, max }) => (
  <div className="flex items-center gap-2 text-[10px]">
    <span className="w-24 text-stone-500">{label}</span>
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${max ? (value / max) * 100 : 0}%`, background: value / max >= 0.8 ? "#34d399" : value / max >= 0.4 ? "#fbbf24" : "#ef4444" }} />
    </div>
    <span className="w-10 text-right text-stone-400">{value}/{max}</span>
  </div>
);

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

// R5: Inspectorul din dreapta (meta + health + gate + relații + preview)
const InspectorPane = ({ path, onOpen }) => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    setData(null); setErr(null);
    if (!path) return;
    ax.get(`/api/founder/knowledge/doc`, { params: { path } })
      .then(r => setData(r.data)).catch(e => setErr(e?.response?.data?.detail || "Eroare"));
  }, [path]);
  if (!path) return (
    <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-6 text-xs text-stone-500 h-fit" data-testid="kc-inspector-empty">
      Selectează un document: Inspectorul arată statusul de lifecycle, Health Score, Quality Gate, relațiile dovedite și conținutul.
    </div>
  );
  const m = data?.meta;
  const h = m?.health;
  return (
    <div className="bg-[#0e0e10] border border-white/10 rounded-2xl overflow-hidden" data-testid="kc-inspector">
      {err && <div className="text-red-300 text-sm p-5">{err}</div>}
      {!data && !err && <div className="flex items-center gap-2 text-stone-400 text-sm p-5"><Loader2 className="w-4 h-4 animate-spin" /> Se încarcă...</div>}
      {data && (
        <>
          <div className="p-5 border-b border-white/10">
            <div className="flex items-start justify-between gap-2">
              <div className="font-serif text-lg text-white leading-snug" data-testid="kc-doc-title">{m.title}</div>
              <StatusBadge s={m.status} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-stone-400 mt-2" data-testid="kc-doc-meta">
              <span>v{m.version}</span>
              <span>{m.author}</span>
              {m.approver && <span>Aprobat: {m.approver} · {String(m.approved_at).slice(0, 10)}</span>}
              <span>{m.category}</span>
              <span className="font-mono text-[10px] text-stone-500 break-all">{m.path}</span>
            </div>
            <div className="mt-3 space-y-1" data-testid="kc-doc-health">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-stone-400">Document Health</span>
                <span className="font-serif text-base" style={{ color: h.score >= 80 ? "#34d399" : h.score >= 40 ? "#fbbf24" : "#ef4444" }}>{h.score}%</span>
              </div>
              <HealthBar label="Referit de OS" value={h.referenced} max={35} />
              <HealthBar label="Implementare" value={h.implementation} max={25} />
              <HealthBar label="Evidență" value={h.evidence} max={20} />
              <HealthBar label="Completitudine" value={h.completeness} max={20} />
              <div className="text-[10px] text-stone-500">Confidence: {h.confidence} · Quality Gate: <span className={data.gate.passed ? "text-emerald-300" : "text-amber-300"}>{data.gate.passed ? "PASSED" : `REVIEW (${data.gate.critical_failed.join(", ")})`}</span> · Quality {data.gate.quality_score}%</div>
            </div>
          </div>
          {(data.relationships?.depends_on?.length > 0 || data.relationships?.used_by?.length > 0) && (
            <div className="p-5 border-b border-white/10 space-y-3" data-testid="kc-doc-relationships">
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
          {data.relationships?.note && <div className="mx-5 mt-4 text-[11px] text-stone-500 border border-white/10 rounded-lg px-3 py-2">{data.relationships.note}</div>}
          <div className="p-5 max-h-[52vh] overflow-y-auto" data-testid="kc-doc-content">
            <ReactMarkdown components={MD}>{data.content}</ReactMarkdown>
          </div>
        </>
      )}
    </div>
  );
};

// R7: Founder Review Mode
const ReviewPane = ({ onOpen }) => {
  const [r, setR] = useState(null);
  useEffect(() => { ax.get(`/api/founder/knowledge/review`).then(res => setR(res.data)).catch(() => {}); }, []);
  if (!r) return <div className="flex items-center gap-2 text-stone-400 text-sm p-6"><Loader2 className="w-4 h-4 animate-spin" /> Se generează Founder Review...</div>;
  const Section = ({ title, docs, tone = "text-stone-300" }) => (
    <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4">
      <div className={`text-xs font-semibold mb-2 ${tone}`}>{title} <span className="text-stone-500">({docs.length})</span></div>
      <div className="space-y-1 max-h-56 overflow-y-auto">
        {docs.length === 0 && <div className="text-[11px] text-stone-600">Nimic — curat.</div>}
        {docs.map(d => (
          <button key={d.path} onClick={() => onOpen(d.path)} className="w-full text-left text-[11px] bg-white/[0.02] border border-white/10 rounded-lg px-2.5 py-1.5 hover:border-[#d4ff3a]/30 flex items-center gap-2">
            <span className="truncate flex-1 text-stone-300">{d.title}</span>
            {d.quality != null && <span className="text-stone-500">{d.quality}%</span>}
            <StatusBadge s={d.status} />
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="space-y-4" data-testid="kc-review">
      <div className="bg-[#0e0e10] border border-[#d4ff3a]/20 rounded-2xl p-4">
        <div className="text-xs font-semibold text-[#d4ff3a] mb-2 flex items-center gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> Priorități (Founder Review)</div>
        <div className="flex flex-wrap gap-2" data-testid="kc-review-priorities">
          {r.top_priorities.length === 0 && <span className="text-[11px] text-stone-500">Nicio acțiune urgentă.</span>}
          {r.top_priorities.map((p, i) => <span key={i} className="text-[11px] px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300">{p.action} · {p.count}</span>)}
        </div>
        {r.broken_relations.length > 0 && (
          <div className="mt-2 text-[11px] text-red-300">Relații rupte (evidența a dispărut → UNKNOWN): {r.broken_relations.map(n => n.name).join(", ")}</div>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="În așteptarea textului verbatim" docs={r.pending_verbatim} tone="text-amber-300" />
        <Section title="Draft-uri (strategii neactivate)" docs={r.drafts} tone="text-amber-300" />
        <Section title="Necesită review (nereferite de OS)" docs={r.needs_review} tone="text-sky-300" />
        <Section title="Duplicate (titluri identice)" docs={r.duplicates} tone="text-red-300" />
        <Section title="Sugestii de activare (quality ≥60%)" docs={r.activation_suggestions} tone="text-emerald-300" />
        <Section title="Sugestii de curățenie" docs={r.cleanup_suggestions} tone="text-stone-300" />
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
    if (doc) { setOpenPath(doc); setTab("docs"); }
  }, [location.search]);

  const openDoc = (p) => { setOpenPath(p); setTab("docs"); };

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
  const sc = tree.status_counts || {};

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-[1500px] mx-auto px-6 pt-28 pb-16">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
          <div>
            <Link to="/admin" className="text-xs text-stone-400 hover:text-white mb-3 inline-block">← Înapoi la Admin</Link>
            <h1 className="font-serif text-4xl tracking-tight flex items-center gap-3" data-testid="kc-title">
              <BookOpenCheck className="w-8 h-8 text-[#d4ff3a]" /> Enterprise Knowledge Center
              <span className="text-[10px] px-2 py-1 rounded-full bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 text-[#d4ff3a] font-sans tracking-normal">FOUNDER ONLY</span>
            </h1>
            <p className="text-sm text-stone-400 mt-1" data-testid="kc-status-counts">
              {tree.total} documente · <span className="text-emerald-300">{sc.Active || 0} Active</span> · <span className="text-sky-300">{sc.Review || 0} Review</span> · <span className="text-amber-300">{sc.Draft || 0} Draft</span> · {sc.Archived || 0} Archived — doar documentele Active guvernează (R2).
            </p>
          </div>
          <button onClick={load} className="pm-btn pm-btn-secondary" data-testid="kc-refresh"><RefreshCcw className="w-3.5 h-3.5" /> Refresh</button>
        </div>

        <form onSubmit={doSearch} className="flex gap-2 mb-5">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Caută în toată guvernanța + registry..."
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-sm outline-none focus:border-[#d4ff3a]/50" data-testid="kc-search-input" />
          </div>
          <button type="submit" className="pm-btn pm-btn-success" disabled={searching} data-testid="kc-search-btn">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Caută"}
          </button>
          {results && <button type="button" onClick={() => { setResults(null); setQ(""); }} className="pm-btn pm-btn-secondary" data-testid="kc-search-clear"><X className="w-3.5 h-3.5" /></button>}
        </form>

        {results && (
          <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-5 mb-5" data-testid="kc-search-results">
            <div className="text-xs text-stone-400 mb-3">{results.total} rezultate pentru „{results.query}"</div>
            <div className="space-y-1.5 max-h-[36vh] overflow-y-auto">
              {results.documents.map(d => (
                <button key={d.path} onClick={() => openDoc(d.path)} className="w-full text-left text-xs bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2 hover:border-[#d4ff3a]/30" data-testid={`kc-result-${d.path.replace(/[/.]/g, "-")}`}>
                  <div className="flex items-center gap-2"><FileText className="w-3 h-3 text-[#d4ff3a] shrink-0" /><span className="text-stone-200 truncate">{d.title}</span><span className="text-stone-600">· {d.category} · {d.occurrences}×</span><StatusBadge s={d.status} /></div>
                  {d.snippet && <div className="text-[10px] text-stone-500 mt-0.5 truncate">{d.snippet}</div>}
                </button>
              ))}
              {results.registry_nodes.map(n => (
                <div key={n.id} className="text-xs bg-white/[0.02] border border-white/10 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2"><Network className="w-3 h-3 shrink-0" style={{ color: TYPE_META[n.type]?.color }} /><span className="text-stone-200">{n.name}</span><span className="text-stone-600">· {TYPE_META[n.type]?.label}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mb-5">
          <button onClick={() => setTab("docs")} className={`pm-btn pm-btn-sm ${tab === "docs" ? "pm-btn-success" : "pm-btn-secondary"}`} data-testid="kc-tab-docs"><FileText className="w-3.5 h-3.5" /> Documente</button>
          <button onClick={() => setTab("map")} className={`pm-btn pm-btn-sm ${tab === "map" ? "pm-btn-success" : "pm-btn-secondary"}`} data-testid="kc-tab-map"><Network className="w-3.5 h-3.5" /> Dependency Map</button>
          <button onClick={() => setTab("review")} className={`pm-btn pm-btn-sm ${tab === "review" ? "pm-btn-success" : "pm-btn-secondary"}`} data-testid="kc-tab-review"><ClipboardCheck className="w-3.5 h-3.5" /> Review</button>
        </div>

        {tab === "map" && <RegistryGraph onOpenDoc={openDoc} />}
        {tab === "review" && <ReviewPane onOpen={openDoc} />}

        {tab === "docs" && (
          <>
            <div className="grid lg:grid-cols-[230px_330px_1fr] gap-4 items-start">
              <div className="space-y-1 max-h-[70vh] overflow-y-auto" data-testid="kc-categories">
                <button onClick={() => setCat(null)} className={`w-full text-left text-xs px-3 py-2 rounded-lg border ${!cat ? "border-[#d4ff3a]/40 bg-[#d4ff3a]/5 text-white" : "border-white/10 text-stone-400 hover:text-white"}`} data-testid="kc-cat-all">
                  Toate categoriile <span className="float-right text-stone-500">{tree.total}</span>
                </button>
                {tree.categories.map(c => (
                  <button key={c.name} onClick={() => setCat(c.name)} className={`w-full text-left text-xs px-3 py-2 rounded-lg border ${cat === c.name ? "border-[#d4ff3a]/40 bg-[#d4ff3a]/5 text-white" : "border-white/10 text-stone-400 hover:text-white"}`} data-testid={`kc-cat-${c.name.replace(/\s/g, "-")}`}>
                    {c.name} <span className="float-right text-stone-500">{c.count}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto" data-testid="kc-doc-list">
                {(activeCat ? [activeCat] : tree.categories).flatMap(c => c.docs.map(d => (
                  <button key={d.path} onClick={() => openDoc(d.path)} className={`w-full text-left bg-white/[0.02] border rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 ${openPath === d.path ? "border-[#d4ff3a]/50" : "border-white/10 hover:border-[#d4ff3a]/30"}`} data-testid={`kc-doc-${d.path.replace(/[/.]/g, "-")}`}>
                    <FileText className="w-3.5 h-3.5 text-[#d4ff3a] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-stone-200 truncate">{d.title}</div>
                      <div className="text-[10px] text-stone-500">v{d.version} · Health {d.health?.score ?? 0}%</div>
                    </div>
                    <StatusBadge s={d.status} />
                  </button>
                )))}
              </div>
              <InspectorPane path={openPath} onOpen={openDoc} />
            </div>
            <div className="mt-5 bg-[#0e0e10] border border-white/10 rounded-2xl p-4" data-testid="kc-timeline">
              <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-2 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Activitate recentă (Enterprise Memory)</div>
              <div className="flex flex-wrap gap-2">
                {(tree.recent || []).map(d => (
                  <button key={d.path} onClick={() => openDoc(d.path)} className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-[#d4ff3a]/30 text-stone-300 flex items-center gap-2">
                    <span className="truncate max-w-[220px]">{d.title}</span>
                    <span className="text-stone-600">{new Date(d.updated).toLocaleDateString("ro-RO")}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
