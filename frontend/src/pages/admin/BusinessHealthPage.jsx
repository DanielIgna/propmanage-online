// BusinessHealthPage — 8 scoruri pe departamente, VERDE/GALBEN/ROȘU, din date reale.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Activity, RefreshCw } from "lucide-react";
import { AdminLayoutMetronic, AdminCard } from "./AdminLayoutMetronic";
import { API } from "../DashShared";
import { DSButton, DSSkeleton } from "../../design-system";

const ax = axios.create({ baseURL: API, withCredentials: true });

const COLOR = {
  green:  { ring: "#10b981", text: "text-emerald-600 dark:text-emerald-300", bg: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30", label: "SĂNĂTOS" },
  yellow: { ring: "#f59e0b", text: "text-amber-600 dark:text-amber-300",     bg: "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30",       label: "ATENȚIE" },
  red:    { ring: "#f43f5e", text: "text-rose-600 dark:text-rose-300",       bg: "bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30",           label: "CRITIC" },
};

const ScoreRing = ({ score, color }) => {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76">
      <circle cx="38" cy="38" r={r} fill="none" stroke="currentColor" strokeWidth="6" className="text-slate-100 dark:text-slate-700" />
      <circle cx="38" cy="38" r={r} fill="none" stroke={COLOR[color].ring} strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} transform="rotate(-90 38 38)" style={{ transition: "stroke-dashoffset 600ms" }} />
      <text x="38" y="43" textAnchor="middle" className="fill-slate-900 dark:fill-white" fontSize="18" fontWeight="900">{score}</text>
    </svg>
  );
};

const Sparkline = ({ points, color }) => {
  if (!points || points.length < 2) return <span className="text-[9px] text-slate-400">trend din a 2-a zi</span>;
  const w = 72, h = 20;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const path = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={path} fill="none" stroke={COLOR[color].ring} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
};

export default function BusinessHealthPage() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [r, h] = await Promise.all([
        ax.get("/admin/business-health"),
        ax.get("/admin/business-health/history?days=30"),
      ]);
      setData(r.data);
      setHistory(h.data.history || []);
    } catch (e) { /* silent */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const oc = data ? COLOR[data.overall_color] : COLOR.yellow;

  return (
    <AdminLayoutMetronic
      title="Business Health"
      subtitle="8 scoruri pe departamente calculate din datele reale — VERDE sănătos · GALBEN atenție · ROȘU critic"
    >
      {loading ? <DSSkeleton kpis={4} blocks={1} /> : (
        <div className="space-y-6" data-testid="business-health-root">
          <AdminCard testid="bh-overall"
            title={<span className="flex items-center gap-2"><Activity className="w-4 h-4 text-lime-500" /> Scor general de sănătate</span>}
            action={<DSButton variant="ghost" icon={RefreshCw} onClick={load} data-testid="bh-refresh">Recalculează</DSButton>}
          >
            <div className="flex items-center gap-4">
              <ScoreRing score={Math.round(data?.overall ?? 0)} color={data?.overall_color || "yellow"} />
              <div>
                <div className={`text-[10px] font-black uppercase px-2 py-0.5 rounded inline-block border ${oc.bg} ${oc.text}`}>{oc.label}</div>
                <div className="text-sm text-slate-600 dark:text-slate-300 mt-1.5">
                  Media celor 8 departamente. Fiecare scor e o formulă deterministă pe datele din DB — nu estimări.
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Sparkline points={history.map((h) => h.overall)} color={data?.overall_color || "yellow"} />
                  <span className="text-[10px] text-slate-400" data-testid="bh-history-info">{history.length} snapshot{history.length === 1 ? "" : "-uri"} zilnice (30z)</span>
                </div>
              </div>
            </div>
          </AdminCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {(data?.departments || []).map((d) => {
              const c = COLOR[d.color];
              return (
                <div key={d.key} className={`rounded-2xl border p-4 flex flex-col items-center text-center gap-2 ${c.bg}`} data-testid={`bh-dept-${d.key}`}>
                  <ScoreRing score={d.score} color={d.color} />
                  <div className="text-sm font-black text-slate-900 dark:text-white">{d.label}</div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${c.text}`}>{c.label}</span>
                  <Sparkline points={history.map((h) => h.scores?.[d.key]).filter((v) => v != null)} color={d.color} />
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{d.detail}</div>
                </div>
              );
            })}
          </div>

          <div className="text-[10px] text-slate-400">
            Formule: Marketing = creștere useri 30z · Marketplace = fill rate cereri · Escrow = eliberate vs înghețate · Specialiști = verificare + profil complet · Suport = dispute rezolvate · Conversii = plăți finalizate · SEO = media audit pagini publice · Financiar = creștere revenue 30z.
          </div>
        </div>
      )}
    </AdminLayoutMetronic>
  );
}
