// QuestPanel — gamified active quests + earned vouchers on user dashboard.
// Mounted in ClientDashboard + SpecialistDashboard.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Award, Gift, Loader2, ChevronDown, ChevronUp, Sparkles, Copy, CheckCircle2 } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

export const QuestPanel = () => {
  const [quests, setQuests] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [q, v] = await Promise.all([
          ax.get("/api/me/quests"),
          ax.get("/api/me/vouchers"),
        ]);
        if (cancelled) return;
        setQuests(q.data.items || []);
        setVouchers(v.data.items || []);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const activeVouchers = vouchers.filter(v => v.status === "active");
  const inProgress = quests.filter(q => !q.completed);
  const done = quests.filter(q => q.completed);

  const copy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return null;
  if (quests.length === 0 && vouchers.length === 0) return null;

  return (
    <div className="bg-[#0e0e10] border border-amber-500/20 rounded-2xl p-4 mb-4" data-testid="quest-panel">
      <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center justify-between mb-3 group" data-testid="quest-panel-toggle">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Award className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-white">Quest-uri & Recompense</div>
            <div className="text-[10px] text-stone-500">
              {inProgress.length} active · {done.length} completate
              {activeVouchers.length > 0 && <span className="text-amber-300"> · 🎁 {activeVouchers.length} voucher(e)</span>}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-stone-500" /> : <ChevronDown className="w-4 h-4 text-stone-500" />}
      </button>

      {expanded && (
        <>
          {/* ACTIVE VOUCHERS */}
          {activeVouchers.length > 0 && (
            <div className="mb-3 bg-amber-500/5 border border-amber-500/30 rounded-xl p-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-200 mb-2 flex items-center gap-1">
                <Gift className="w-3 h-3" /> Vouchere active
              </div>
              <div className="space-y-1.5">
                {activeVouchers.map(v => (
                  <div key={v.id} className="flex items-center gap-2 text-xs bg-black/30 rounded-lg px-2.5 py-2" data-testid={`voucher-${v.id}`}>
                    <span className="text-emerald-300 font-mono font-semibold">{v.percent}%</span>
                    <code className="text-amber-200 font-mono">{v.code}</code>
                    <button onClick={() => copy(v.code)} className="text-stone-500 hover:text-white" title="Copiază cod" data-testid={`voucher-copy-${v.id}`}>
                      {copied === v.code ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <span className="text-[10px] text-stone-400 italic flex-1 truncate">{v.reason}</span>
                    <span className="text-[10px] text-stone-500">expiră: {new Date(v.expires_at).toLocaleDateString("ro-RO")}</span>
                  </div>
                ))}
              </div>
              <div className="text-[10px] text-stone-500 italic mt-2">
                Aplicare manuală momentan — vor fi onorate când finalizezi următoarea comandă/lead. Păstrează codul.
              </div>
            </div>
          )}

          {/* IN-PROGRESS QUESTS */}
          {inProgress.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-wider text-stone-400">Quest-uri active</div>
              {inProgress.map(q => (
                <div key={q.id} className="bg-white/[0.02] border border-white/10 rounded-xl p-3" data-testid={`quest-${q.id}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span className="text-sm font-semibold text-white">{q.title_ro}</span>
                    <span className="ml-auto text-[10px] uppercase px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300">
                      Recompensă: voucher {q.reward_voucher_pct}%
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 mb-2">{q.description_ro}</div>
                  <div className="relative h-2 bg-black/40 rounded-full overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-emerald-400 transition-all" style={{ width: `${q.progress_pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-stone-500 mt-1">
                    <span>{q.current_count} / {q.target_count}</span>
                    <span>În {q.days_window} zile</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* COMPLETED */}
          {done.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Completate ({done.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {done.map(q => (
                  <span key={q.id} className="text-[11px] px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200" data-testid={`quest-done-${q.id}`}>
                    ✓ {q.title_ro}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default QuestPanel;
