// BugMemoryPage — Phase 1.3 unified read-only view over QA + AI findings.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Bug, ChevronLeft, Loader2, Search, AlertTriangle,
  FileSearch, ShieldAlert, Filter,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const SEV_COLOR = {
  P0:    "bg-red-500/15 border-red-500/40 text-red-300",
  P1:    "bg-amber-500/15 border-amber-500/40 text-amber-300",
  P2:    "bg-blue-500/15 border-blue-500/40 text-blue-300",
  P3:    "bg-stone-500/15 border-stone-500/40 text-stone-300",
  high:  "bg-red-500/15 border-red-500/40 text-red-300",
  med:   "bg-amber-500/15 border-amber-500/40 text-amber-300",
  low:   "bg-stone-500/15 border-stone-500/40 text-stone-300",
};

const SRC_COLOR = {
  qa_copilot:     "bg-blue-500/15 border-blue-500/40 text-blue-300",
  ai_investigator:"bg-violet-500/15 border-violet-500/40 text-violet-300",
};

const BugMemoryPage = () => {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severity, setSeverity] = useState("");
  const [source, setSource] = useState("");
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);

  const loadRecent = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severity) params.set("severity", severity);
      if (source) params.set("source", source);
      params.set("limit", "30");
      const [s, r] = await Promise.all([
        ax.get("/api/admin/bug-memory/stats"),
        ax.get(`/api/admin/bug-memory/recent?${params.toString()}`),
      ]);
      setStats(s.data);
      setItems(r.data.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { loadRecent(); }, [severity, source]);

  const doSearch = async () => {
    if (q.trim().length < 2) return loadRecent();
    setSearching(true);
    try {
      const { data } = await ax.get(`/api/admin/bug-memory/search?q=${encodeURIComponent(q)}&limit=30`);
      // Search endpoint returns slightly different shape — normalize
      const found = (data.results || []).map((it) => ({
        id: it.id, source: it.source || "qa_copilot",
        text: it.text || it.description || "", summary: it.title || it.summary || "",
        severity: it.severity || "P2", category: it.category || "",
        ts: it.ts || it.created_at, session_id: it.session_id, session_title: it.session_title,
      }));
      setItems(found);
    } finally { setSearching(false); }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-6xl mx-auto px-6 pt-28 pb-16">
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3" data-testid="bm-back">
          <ChevronLeft className="w-3.5 h-3.5" /> Înapoi la Admin Dashboard
        </Link>

        <div className="flex items-start gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center shrink-0">
            <Bug className="w-5 h-5 text-orange-300" />
          </div>
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="bm-title">
              Bug <span className="italic gradient-text">Memory</span> Aggregator
            </h1>
            <p className="text-sm text-stone-400 mt-2 max-w-3xl">
              View unificat read-only peste <strong>QA Copilot findings</strong> + <strong>AI Investigator findings</strong>. Niciun bug nu se mai pierde între tab-uri.
            </p>
          </div>
        </div>

        {/* STATS */}
        {stats && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl border p-4 bg-blue-500/5 border-blue-500/30 text-blue-300">
              <div className="text-[10px] uppercase tracking-wider flex items-center gap-1"><FileSearch className="w-3 h-3" /> QA Findings</div>
              <div className="text-2xl font-mono mt-2 text-white">{stats.qa_findings}</div>
            </div>
            <div className="rounded-xl border p-4 bg-violet-500/5 border-violet-500/30 text-violet-300">
              <div className="text-[10px] uppercase tracking-wider flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> AI Investigator</div>
              <div className="text-2xl font-mono mt-2 text-white">{stats.ai_investigator_findings}</div>
            </div>
            <div className="rounded-xl border p-4 bg-orange-500/5 border-orange-500/30 text-orange-300">
              <div className="text-[10px] uppercase tracking-wider">Total</div>
              <div className="text-2xl font-mono mt-2 text-white">{stats.total}</div>
            </div>
          </div>
        )}

        {/* CONTROLS */}
        <div className="bg-[#0e0e10] border border-white/10 rounded-2xl p-4 mb-4 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-stone-500" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Caută în istoric (text, categorie, sumar)..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-stone-600"
              data-testid="bm-search-input"
            />
            <button onClick={doSearch} disabled={searching}
              className="px-3 py-1.5 rounded-lg bg-violet-500/15 border border-violet-500/40 text-violet-200 text-xs hover:bg-violet-500/25 disabled:opacity-50"
              data-testid="bm-search-btn">
              {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Caută"}
            </button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-stone-500" />
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="bg-[#0a0a0b] border border-white/10 rounded-lg px-2 py-1.5 text-xs"
              data-testid="bm-filter-severity">
              <option value="">Toate severitățile</option>
              <option value="P0">P0</option><option value="P1">P1</option>
              <option value="P2">P2</option><option value="P3">P3</option>
              <option value="high">high</option><option value="med">med</option><option value="low">low</option>
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)}
              className="bg-[#0a0a0b] border border-white/10 rounded-lg px-2 py-1.5 text-xs"
              data-testid="bm-filter-source">
              <option value="">Toate sursele</option>
              <option value="qa_copilot">QA Copilot</option>
              <option value="ai_investigator">AI Investigator</option>
            </select>
          </div>
        </div>

        {/* LIST */}
        {loading ? (
          <div className="text-center text-stone-400 flex items-center justify-center gap-2 py-10">
            <Loader2 className="w-4 h-4 animate-spin" /> Se încarcă...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-stone-500 text-sm">Niciun finding pentru filtrele curente.</div>
        ) : (
          <div className="space-y-2" data-testid="bm-list">
            {items.map((it, i) => (
              <div key={`${it.source}-${it.id}-${i}`} className="bg-[#0e0e10] border border-white/10 rounded-xl p-4" data-testid={`bm-item-${i}`}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border ${SRC_COLOR[it.source] || "bg-stone-500/10 border-stone-500/40 text-stone-300"}`}>{it.source}</span>
                  <span className={`inline-block text-[10px] uppercase px-1.5 py-0.5 rounded border ${SEV_COLOR[it.severity] || SEV_COLOR.P2}`}>{it.severity}</span>
                  {it.category && <span className="text-[10px] text-stone-500">· {it.category}</span>}
                  {it.ts && <span className="text-[10px] text-stone-500 ml-auto">{new Date(it.ts).toLocaleString("ro-RO")}</span>}
                </div>
                {it.summary && <div className="text-sm font-semibold text-white">{it.summary}</div>}
                {it.text && <div className="text-xs text-stone-400 mt-1 line-clamp-3">{it.text}</div>}
                {it.session_title && <div className="text-[10px] text-stone-500 mt-2">Sesiune: {it.session_title}</div>}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-orange-500/5 border border-orange-500/20 rounded-xl p-3 text-xs text-orange-100 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-orange-300" />
          <div>
            Această pagină e <strong>READ-ONLY</strong>. Findings-urile rămân în colecțiile lor originale (qa_sessions, admin_ai_findings) — aici doar le agregăm într-un singur loc pentru viteză de overview.
          </div>
        </div>
      </div>
    </div>
  );
};

export default BugMemoryPage;
