// Content Factory tab — SEO Control Center (reuses AdminSEO shell, no parallel dashboard).
// Observability + human-review workflow for the Content Growth Engine V1.
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useTheme as useGlobalTheme } from "../../../contexts/ThemeContext";

const API = process.env.REACT_APP_BACKEND_URL + "/api";
const CF = `${API}/admin/content-factory`;

const STATUS_FLOW = ["draft", "review", "approved", "published"];
const STATUS_TONE = {
  draft: "bg-slate-500/15 text-slate-500", review: "bg-amber-500/15 text-amber-500",
  approved: "bg-blue-500/15 text-blue-500", published: "bg-emerald-500/15 text-emerald-500",
};

export const ContentFactoryTab = () => {
  const { isDark } = useGlobalTheme();
  const [summary, setSummary] = useState(null);
  const [opps, setOpps] = useState(null);
  const [articles, setArticles] = useState([]);
  const [busy, setBusy] = useState("");
  const card = isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const txt = isDark ? "text-slate-200" : "text-slate-800";
  const muted = isDark ? "text-slate-400" : "text-slate-500";

  const refresh = useCallback(async () => {
    try {
      const [s, o, a] = await Promise.all([
        axios.get(`${CF}/summary`), axios.get(`${CF}/opportunities`), axios.get(`${CF}/articles`),
      ]);
      setSummary(s.data); setOpps(o.data); setArticles(a.data.articles || []);
    } catch (e) { toast.error("Eroare la încărcarea Content Factory"); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const generate = async (opp) => {
    setBusy(opp.id);
    try {
      await axios.post(`${CF}/articles/generate`, { opportunity: opp });
      toast.success("Draft generat");
      await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Generarea a eșuat"); }
    finally { setBusy(""); }
  };
  const setStatus = async (id, status) => {
    try {
      if (status === "published") await axios.post(`${CF}/articles/${id}/publish`);
      else await axios.patch(`${CF}/articles/${id}`, { status });
      toast.success(`Status → ${status}`); await refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || "Tranziție eșuată"); }
  };
  const del = async (id) => {
    if (!window.confirm("Ștergi articolul?")) return;
    try { await axios.delete(`${CF}/articles/${id}`); toast.success("Șters"); await refresh(); }
    catch { toast.error("Ștergere eșuată"); }
  };

  return (
    <div className="space-y-6" data-testid="content-factory-tab">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3" data-testid="cf-summary">
          {["draft", "review", "approved", "published"].map((st) => (
            <div key={st} className={`rounded-xl border p-4 ${card}`} data-testid={`cf-count-${st}`}>
              <div className={`text-2xl font-bold ${txt}`}>{summary.by_status?.[st] ?? 0}</div>
              <div className={`text-xs mt-1 ${muted} capitalize`}>{st}</div>
            </div>
          ))}
          <div className={`rounded-xl border p-4 ${card}`}>
            <div className={`text-2xl font-bold ${txt}`}>{summary.articles_total}</div>
            <div className={`text-xs mt-1 ${muted}`}>Total</div>
          </div>
        </div>
      )}

      {/* Opportunities */}
      <div className={`rounded-xl border ${card}`}>
        <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
          <h3 className={`font-semibold ${txt}`}>Oportunități detectate</h3>
          {opps && <span className={`text-xs ${muted}`}>GSC: <b className={opps.sources_status?.gsc === "ok" ? "text-emerald-500" : "text-amber-500"}>{opps.sources_status?.gsc}</b> · analytics: <b>{opps.sources_status?.analytics}</b></span>}
        </div>
        {opps?.gsc_note && <div className="px-4 pt-3 text-[11px] text-amber-500">{opps.gsc_note}</div>}
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead><tr className={`text-left ${muted} text-xs`}>
              <th className="p-2">Prio</th><th className="p-2">Sursă</th><th className="p-2">Cluster</th><th className="p-2">Gap</th><th className="p-2">Subiect</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {(opps?.opportunities || []).slice(0, 15).map((o) => (
                <tr key={o.id} className="border-t border-slate-800/40" data-testid={`cf-opp-${o.id}`}>
                  <td className={`p-2 font-bold ${txt}`}>{o.priority}</td>
                  <td className="p-2"><span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-400">{o.source}</span></td>
                  <td className={`p-2 ${muted}`}>{o.cluster}</td>
                  <td className={`p-2 ${muted}`}>{o.gap}</td>
                  <td className={`p-2 ${txt}`}>{o.topic}</td>
                  <td className="p-2 text-right">
                    {o.source !== "analytics" && (
                      <button onClick={() => generate(o)} disabled={busy === o.id} data-testid={`cf-generate-${o.id}`}
                        className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                        {busy === o.id ? "Generez…" : "Generează draft"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Articles (workflow) */}
      <div className={`rounded-xl border ${card}`}>
        <div className="p-4 border-b border-slate-800/50"><h3 className={`font-semibold ${txt}`}>Articole ({articles.length}) — human review obligatoriu</h3></div>
        <div className="overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead><tr className={`text-left ${muted} text-xs`}>
              <th className="p-2">Status</th><th className="p-2">Titlu</th><th className="p-2">Cluster</th><th className="p-2">Min</th><th className="p-2">Acțiuni</th>
            </tr></thead>
            <tbody>
              {articles.map((a) => {
                const idx = STATUS_FLOW.indexOf(a.status);
                const next = idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
                return (
                  <tr key={a.id} className="border-t border-slate-800/40" data-testid={`cf-article-${a.id}`}>
                    <td className="p-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_TONE[a.status] || "bg-slate-500/15 text-slate-400"}`}>{a.status}</span></td>
                    <td className={`p-2 ${txt} max-w-xs`}>{a.status === "published" ? <a href={`/blog/${a.slug}`} target="_blank" rel="noreferrer" className="hover:underline">{a.title}</a> : a.title}</td>
                    <td className={`p-2 ${muted}`}>{a.cluster_label}</td>
                    <td className={`p-2 ${muted}`}>{a.read_mins}</td>
                    <td className="p-2 flex gap-1.5">
                      {next && (
                        <button onClick={() => setStatus(a.id, next)} data-testid={`cf-advance-${a.id}`}
                          className="text-xs px-2.5 py-1 rounded-lg bg-blue-600 text-white hover:bg-blue-700 capitalize">→ {next}</button>
                      )}
                      <button onClick={() => del(a.id)} data-testid={`cf-delete-${a.id}`}
                        className="text-xs px-2.5 py-1 rounded-lg bg-red-500/15 text-red-500 hover:bg-red-500/25">Șterge</button>
                    </td>
                  </tr>
                );
              })}
              {articles.length === 0 && <tr><td colSpan={5} className={`p-4 text-center ${muted}`}>Niciun articol încă. Generează un draft din oportunități.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ContentFactoryTab;
