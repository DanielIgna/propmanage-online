// Manual Tester — Admin page for human-driven QA test runs.
// Route: /admin/manual-tester
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import {
  Check, X, MinusCircle, Save, Sparkles, ChevronLeft, Download,
  Loader2, AlertCircle, Plus, Bot, RotateCcw,
} from "lucide-react";
import { API } from "../DashShared";

const STATUS_META = {
  pass: { label: "PASS", cls: "bg-emerald-500 text-stone-950 border-emerald-500" },
  fail: { label: "FAIL", cls: "bg-rose-500 text-white border-rose-500" },
  skip: { label: "SKIP", cls: "bg-stone-600 text-stone-100 border-stone-600" },
};

const ManualTesterPage = () => {
  const [suites, setSuites] = useState([]);
  const [activeSuite, setActiveSuite] = useState(null);
  const [loading, setLoading] = useState(true);
  // results: { [caseId]: { status, notes } }
  const [results, setResults] = useState({});
  const [extraCases, setExtraCases] = useState([]); // AI-suggested ones, scoped to active suite
  const [aiBusy, setAiBusy] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiError, setAiError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [previousRuns, setPreviousRuns] = useState([]);
  const [label, setLabel] = useState("");
  const [env, setEnv] = useState("preview");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await axios.get(`${API}/admin/manual-tester/suites`);
        setSuites(r.data?.suites || []);
        if ((r.data?.suites || []).length > 0) setActiveSuite(r.data.suites[0].id);
      } finally { setLoading(false); }
    };
    load();
    axios.get(`${API}/admin/manual-tester/runs`, { params: { limit: 8 } })
      .then((r) => setPreviousRuns(r.data?.items || []))
      .catch(() => {});
    // Try to restore an in-progress session
    try {
      const cached = JSON.parse(localStorage.getItem("manual_tester_draft") || "{}");
      if (cached?.results) setResults(cached.results);
      if (cached?.extraCases) setExtraCases(cached.extraCases);
      if (cached?.label) setLabel(cached.label);
      if (cached?.env) setEnv(cached.env);
    } catch (_e) { /* ignore */ }
  }, []);

  // Persist draft to localStorage on every change.
  useEffect(() => {
    localStorage.setItem("manual_tester_draft", JSON.stringify({ results, extraCases, label, env }));
  }, [results, extraCases, label, env]);

  const suite = useMemo(() => suites.find((s) => s.id === activeSuite), [suites, activeSuite]);
  const allCases = useMemo(() => {
    if (!suite) return [];
    return [...suite.cases, ...extraCases.filter((c) => c._suite_id === suite.id)];
  }, [suite, extraCases]);

  const summary = useMemo(() => {
    const tot = Object.keys(results).length;
    const pass = Object.values(results).filter((r) => r.status === "pass").length;
    const fail = Object.values(results).filter((r) => r.status === "fail").length;
    const skip = Object.values(results).filter((r) => r.status === "skip").length;
    return { tot, pass, fail, skip };
  }, [results]);

  const setStatus = (caseId, status) => {
    setResults((prev) => ({ ...prev, [caseId]: { ...prev[caseId], status, case_id: caseId } }));
  };
  const setNotes = (caseId, notes) => {
    setResults((prev) => ({ ...prev, [caseId]: { ...prev[caseId], notes, case_id: caseId } }));
  };

  const aiSuggest = async () => {
    setAiError("");
    if (!aiTopic.trim()) { setAiError("Introdu un topic (ex: 'edge cases pe checkout Stripe')."); return; }
    setAiBusy(true);
    try {
      const ctx = suite ? `Suite curentă: ${suite.name} (${suite.description}).` : "";
      const r = await axios.post(`${API}/admin/manual-tester/suggest`, { topic: aiTopic, context: ctx });
      const newCases = (r.data?.cases || []).map((c) => ({ ...c, _suite_id: suite?.id, ai_suggested: true }));
      setExtraCases((prev) => [...prev, ...newCases]);
      setAiTopic("");
    } catch (e) {
      setAiError(e?.response?.data?.detail || "Eroare AI");
    } finally {
      setAiBusy(false);
    }
  };

  const saveRun = async () => {
    if (Object.keys(results).length === 0) { setSavedMsg("Marchează cel puțin un caz înainte de salvare."); return; }
    setSaving(true); setSavedMsg("");
    try {
      const payload = {
        suite_id: activeSuite,
        label: label || `Run ${new Date().toLocaleString("ro-RO")}`,
        environment: env,
        results: Object.values(results).filter((r) => r.status),
      };
      await axios.post(`${API}/admin/manual-tester/runs`, payload);
      setSavedMsg(`✓ Salvat cu succes! ${payload.results.length} cazuri.`);
      // Reload runs list
      const r = await axios.get(`${API}/admin/manual-tester/runs`, { params: { limit: 8 } });
      setPreviousRuns(r.data?.items || []);
    } catch (e) {
      setSavedMsg(`✗ Eroare: ${e?.response?.data?.detail || e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ label, env, summary, results, extraCases }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manual_tester_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetDraft = () => {
    if (!window.confirm("Resetezi sesiunea curentă? (Rezultatele nesalvate se pierd.)")) return;
    setResults({}); setExtraCases([]); setLabel(""); setSavedMsg("");
    localStorage.removeItem("manual_tester_draft");
  };

  if (loading) return <div className="min-h-screen bg-stone-950 text-stone-400 flex items-center justify-center">Se încarcă...</div>;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <Link to="/admin" className="text-stone-400 hover:text-stone-200 inline-flex items-center gap-1 text-sm mb-4">
          <ChevronLeft className="w-4 h-4" /> Înapoi Admin
        </Link>

        <div className="flex items-center justify-between flex-wrap gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold">🧪 Tester Manual</h1>
            <p className="text-xs text-stone-400">QA driven by humans · {suites.length} suite-uri · {suites.reduce((s, x) => s + x.cases.length, 0)} cazuri</p>
          </div>
          <SummaryBadge summary={summary} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* Sidebar suites */}
          <aside className="bg-stone-900/40 border border-stone-800 rounded-2xl p-3 h-fit" data-testid="mt-sidebar">
            {suites.map((s) => {
              const isActive = activeSuite === s.id;
              const tested = s.cases.filter((c) => results[c.id]).length;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSuite(s.id)}
                  data-testid={`mt-suite-${s.id}`}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 text-sm mb-0.5 transition-colors ${
                    isActive ? "bg-emerald-500/15 text-emerald-300 font-semibold" : "text-stone-300 hover:bg-stone-800"
                  }`}
                >
                  <span>{s.icon}</span>
                  <span className="flex-1">{s.name}</span>
                  <span className="text-[10px] text-stone-500 tabular-nums">{tested}/{s.cases.length}</span>
                </button>
              );
            })}

            <div className="border-t border-stone-800 mt-3 pt-3 space-y-2 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">Etichetă run</div>
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: smoke pre-deploy"
                  className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs" data-testid="mt-label" />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 mb-0.5">Mediu</div>
                <select value={env} onChange={(e) => setEnv(e.target.value)} className="w-full bg-stone-800 border border-stone-700 rounded px-2 py-1 text-xs" data-testid="mt-env">
                  <option value="preview">Preview</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <button onClick={saveRun} disabled={saving} data-testid="mt-save"
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-stone-950 text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  Salvează run
                </button>
                <button onClick={exportJson}
                  className="px-3 py-1.5 rounded-lg bg-stone-800 text-stone-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5">
                  <Download className="w-3 h-3" /> Export JSON
                </button>
                <button onClick={resetDraft} data-testid="mt-reset"
                  className="px-3 py-1.5 rounded-lg bg-stone-800 text-rose-400 hover:bg-rose-500/15 text-xs font-semibold inline-flex items-center justify-center gap-1.5">
                  <RotateCcw className="w-3 h-3" /> Reset draft
                </button>
              </div>
              {savedMsg && <div className="text-[11px] text-stone-300">{savedMsg}</div>}
            </div>
          </aside>

          {/* Test cases panel */}
          <section className="space-y-3">
            {suite && (
              <div className="bg-stone-900/40 border border-stone-800 rounded-2xl p-5" data-testid="mt-suite-header">
                <h2 className="text-lg font-bold">{suite.icon} {suite.name}</h2>
                <p className="text-sm text-stone-400 mt-0.5">{suite.description}</p>
              </div>
            )}

            {/* AI suggester */}
            <div className="bg-violet-500/5 border border-violet-500/30 rounded-2xl p-4" data-testid="mt-ai-box">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="w-4 h-4 text-violet-300" />
                <span className="text-sm font-bold text-violet-200">AI sugerează cazuri noi pentru suite-ul curent</span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <input value={aiTopic} onChange={(e) => setAiTopic(e.target.value)}
                  placeholder='ex: "edge cases pe upload document mare"' data-testid="mt-ai-topic"
                  className="flex-1 min-w-[200px] bg-stone-800 border border-stone-700 rounded px-3 py-1.5 text-sm" />
                <button onClick={aiSuggest} disabled={aiBusy} data-testid="mt-ai-go"
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50">
                  {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Sugerează
                </button>
              </div>
              {aiError && <div className="text-xs text-rose-400 mt-2 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {aiError}</div>}
            </div>

            {allCases.map((c, i) => (
              <TestCaseRow
                key={c.id}
                caseObj={c}
                index={i}
                result={results[c.id]}
                onStatus={(s) => setStatus(c.id, s)}
                onNotes={(n) => setNotes(c.id, n)}
              />
            ))}

            {allCases.length === 0 && (
              <div className="text-stone-500 italic text-sm p-4">
                Niciun caz în acest suite (încă). Folosește AI mai sus pentru a genera unele.
              </div>
            )}

            {previousRuns.length > 0 && (
              <PreviousRuns runs={previousRuns} />
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

const SummaryBadge = ({ summary }) => (
  <div className="flex items-center gap-3 bg-stone-900/40 border border-stone-800 rounded-xl px-4 py-2" data-testid="mt-summary">
    <span className="text-[11px] uppercase tracking-wider text-stone-500 font-bold">Progres</span>
    <span className="text-emerald-400 font-bold tabular-nums">{summary.pass} <span className="text-stone-500 text-[11px]">pass</span></span>
    <span className="text-rose-400 font-bold tabular-nums">{summary.fail} <span className="text-stone-500 text-[11px]">fail</span></span>
    <span className="text-stone-400 font-bold tabular-nums">{summary.skip} <span className="text-stone-500 text-[11px]">skip</span></span>
    <span className="text-stone-300 font-bold tabular-nums">{summary.tot} <span className="text-stone-500 text-[11px]">total</span></span>
  </div>
);

const TestCaseRow = ({ caseObj, index: i, result, onStatus, onNotes }) => {
  const [open, setOpen] = useState(false);
  const status = result?.status;
  return (
    <div className={`bg-stone-900/40 border rounded-xl p-3 transition-colors ${
      status === "pass" ? "border-emerald-500/40 bg-emerald-500/5" :
      status === "fail" ? "border-rose-500/40 bg-rose-500/5" :
      status === "skip" ? "border-stone-600 bg-stone-800/20" :
      "border-stone-800"
    }`} data-testid={`mt-case-${caseObj.id}`}>
      <div className="flex items-start gap-3">
        <div className="text-[11px] text-stone-500 font-mono mt-0.5 tabular-nums w-6">#{i + 1}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-100">{caseObj.title}</span>
            {caseObj.ai_suggested && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 inline-flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> AI
              </span>
            )}
            {status && (
              <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold border ${STATUS_META[status].cls}`}>
                {STATUS_META[status].label}
              </span>
            )}
          </div>
          <button onClick={() => setOpen(!open)} className="text-[11px] text-stone-400 hover:text-stone-200 mt-0.5">
            {open ? "Ascunde detalii" : "Vezi pași & rezultat așteptat"}
          </button>
          {open && (
            <div className="mt-2 space-y-2 text-xs">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-0.5">Pași</div>
                <ol className="list-decimal list-inside text-stone-300 space-y-0.5">
                  {(caseObj.steps || []).map((s, si) => <li key={si}>{s}</li>)}
                </ol>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-0.5">Rezultat așteptat</div>
                <div className="text-stone-200 italic">{caseObj.expected}</div>
              </div>
            </div>
          )}
          {(status === "fail" || result?.notes) && (
            <textarea
              value={result?.notes || ""}
              onChange={(e) => onNotes(e.target.value)}
              placeholder="Note / detalii bug, screenshot URL, console error..."
              rows={2}
              data-testid={`mt-notes-${caseObj.id}`}
              className="w-full mt-2 bg-stone-800 border border-stone-700 rounded px-2 py-1.5 text-xs"
            />
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onStatus("pass")} data-testid={`mt-pass-${caseObj.id}`}
            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors ${status === "pass" ? "bg-emerald-500 text-stone-950" : "bg-stone-800 text-stone-400 hover:bg-emerald-500/15 hover:text-emerald-300"}`}>
            <Check className="w-4 h-4" />
          </button>
          <button onClick={() => onStatus("fail")} data-testid={`mt-fail-${caseObj.id}`}
            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors ${status === "fail" ? "bg-rose-500 text-white" : "bg-stone-800 text-stone-400 hover:bg-rose-500/15 hover:text-rose-300"}`}>
            <X className="w-4 h-4" />
          </button>
          <button onClick={() => onStatus("skip")} data-testid={`mt-skip-${caseObj.id}`}
            className={`w-8 h-8 rounded-lg inline-flex items-center justify-center transition-colors ${status === "skip" ? "bg-stone-600 text-stone-100" : "bg-stone-800 text-stone-400 hover:bg-stone-700"}`}>
            <MinusCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const PreviousRuns = ({ runs }) => (
  <div className="mt-6 bg-stone-900/40 border border-stone-800 rounded-2xl p-4">
    <h3 className="text-sm font-bold mb-2">Run-uri anterioare</h3>
    <ul className="space-y-1 text-xs">
      {runs.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-stone-800/40">
          <div className="text-stone-500 tabular-nums">{new Date(r.created_at).toLocaleString("ro-RO")}</div>
          <div className="flex-1 truncate text-stone-200">{r.label || `Run ${r.id.slice(0, 6)}`}</div>
          <span className="text-stone-500">{r.environment}</span>
          <span className="text-emerald-400 font-bold tabular-nums">{r.summary.pass}P</span>
          <span className="text-rose-400 font-bold tabular-nums">{r.summary.fail}F</span>
          <span className="text-stone-400 font-bold tabular-nums">{r.summary.skip}S</span>
          <span className="text-stone-500 text-[10px]">de {r.tester_email}</span>
        </li>
      ))}
    </ul>
  </div>
);

export default ManualTesterPage;
