// ExplainThis — AIB-003 · Explainability Engine.
// Buton discret global «✨ Explică această pagină» (doar utilizatori autentificați).
// Admin/super_admin: în plus «🔍 Explică o componentă» + «Explică procesul».
import React, { useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { Sparkles, X, Loader2, ScanSearch, Route as RouteIcon } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const post = (url, body) =>
  fetch(`${API}${url}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(async r => { if (!r.ok) throw new Error((await r.json()).detail || r.status); return r.json(); });

const Md = ({ text }) => (
  <div className="text-[13px] leading-relaxed text-stone-200 space-y-1" data-testid="explain-text">
    {String(text || "").split("\n").map((ln, i) => {
      if (ln.startsWith("## ")) return <div key={i} className="text-[11px] font-black uppercase tracking-wider text-[#d4ff3a] pt-3">{ln.slice(3)}</div>;
      if (ln.startsWith("- ") || ln.startsWith("* ")) return <div key={i} className="pl-3">• {ln.slice(2).replace(/\*\*/g, "")}</div>;
      return <div key={i}>{ln.replace(/\*\*/g, "")}</div>;
    })}
  </div>
);

export const ExplainThis = ({ role }) => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [compRef, setCompRef] = useState("");
  const isDev = role === "admin" || role === "super_admin";

  const run = useCallback(async (kind, extra = {}) => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const d = await post(`/api/ai-brain/explain/${kind}`, { path: location.pathname, ...extra });
      setResult(d);
    } catch (e) { setErr(String(e.message || e)); } finally { setBusy(false); }
  }, [location.pathname]);

  if (!localStorage.getItem("pm_session_hint")) return null;
  return (
    <>
      <button onClick={() => { setOpen(true); if (!result) run("page"); }}
        className="fixed bottom-5 left-5 z-[70] flex items-center gap-1.5 px-3 py-2 rounded-full bg-stone-900/90 border border-stone-700 text-[11px] font-bold text-stone-200 hover:border-[#d4ff3a]/60 hover:text-white shadow-lg backdrop-blur transition-colors"
        data-testid="explain-page-btn" title="AI Brain explică unde te afli">
        <Sparkles className="w-3.5 h-3.5 text-[#d4ff3a]" /> Explică această pagină
      </button>
      {open && (
        <div className="fixed inset-y-0 left-0 z-[75] w-full sm:w-[420px] bg-stone-950 border-r border-stone-800 shadow-2xl flex flex-col" data-testid="explain-panel">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-800">
            <Sparkles className="w-4 h-4 text-[#d4ff3a]" />
            <div className="text-sm font-bold text-white">AI Brain · Explică</div>
            <span className="text-[10px] text-stone-500 truncate">{location.pathname}</span>
            <div className="flex-1" />
            <button onClick={() => setOpen(false)} className="text-stone-400 hover:text-white" data-testid="explain-close-btn"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex gap-1.5 px-4 py-2 border-b border-stone-800/60">
            <button onClick={() => run("page")} className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-stone-800 text-stone-300 hover:text-white" data-testid="explain-run-page">Pagina</button>
            <button onClick={() => run("process")} className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-stone-800 text-stone-300 hover:text-white flex items-center gap-1" data-testid="explain-run-process"><RouteIcon className="w-3 h-3" /> Procesul</button>
            {isDev && (
              <form className="flex gap-1.5 flex-1" onSubmit={e => { e.preventDefault(); if (compRef) run("component", { component: compRef }); }}>
                <input value={compRef} onChange={e => setCompRef(e.target.value)} placeholder="data-testid / etichetă buton"
                  className="flex-1 min-w-0 bg-stone-900 border border-stone-700 rounded-lg px-2 py-1 text-[10px] text-white" data-testid="explain-component-input" />
                <button className="px-2 py-1 text-[10px] font-bold rounded-lg bg-stone-800 text-stone-300 hover:text-white flex items-center gap-1" data-testid="explain-run-component">
                  <ScanSearch className="w-3 h-3" /> Componenta
                </button>
              </form>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {busy && (
              <div className="flex items-center gap-2 text-xs text-stone-400" data-testid="explain-loading">
                <Loader2 className="w-4 h-4 animate-spin text-[#d4ff3a]" /> AI Brain analizează contextul tău real…
              </div>
            )}
            {err && <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2" data-testid="explain-error">{err}</div>}
            {result && !busy && (
              <>
                <Md text={result.explanation} />
                <div className="mt-4 text-[10px] text-stone-600" data-testid="explain-meta">
                  {result.cached ? "instant (cache)" : result.model || ""}
                  {result.found_in ? ` · găsit în ${result.found_in}` : ""}
                  {result.grounded_on?.component ? ` · ancorat pe ${result.grounded_on.component}` : ""}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
