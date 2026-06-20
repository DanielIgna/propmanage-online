// Tier Progress Widget — shows the user how to reach the next tier.
// Renders only when there IS a next tier. Hides for users at TOP/PREMIUM (client) max.
import React, { useState } from "react";
import { ChevronDown, ChevronUp, Trophy, Sparkles, Lock, CheckCircle2 } from "lucide-react";
import { useAuth } from "../auth";
import { getNextTierProgress } from "../lib/tierProgression";
import { PMChip, PMProgress, PMPillButton } from "./pm";

export const TierProgressWidget = ({ className = "", compact = false }) => {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const progress = getNextTierProgress(user);
  if (!progress) {
    // User at top tier — celebrate
    return (
      <div className={`pm-card-glass !p-4 flex items-center gap-3 ${className}`} data-testid="tier-progress-max">
        <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
          <Trophy className="w-5 h-5 text-amber-300" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[var(--pm-text)]">Ai atins nivelul maxim 🏆</div>
          <div className="text-xs text-stone-400">Felicitări! Ești în top {user?.role === "specialist" ? "5% specialiști" : "clienții PropManage"}.</div>
        </div>
      </div>
    );
  }

  const { currentTier, nextTier, requirements, unlocks, overallPct, allDone } = progress;

  // Find the first remaining requirement (most actionable nudge)
  const pending = requirements.find((r) => !r.done);
  const pendingMsg = pending
    ? pending.label.toLowerCase().includes("rating")
      ? `Mai ai nevoie de rating ${pending.min} (acum ${pending.current.toFixed(1)})`
      : pending.label.toLowerCase().includes("kyc") || pending.label.toLowerCase().includes("verificare")
      ? "Mai ai nevoie să-ți verifici contul"
      : `Mai ai ${Math.max(0, pending.min - pending.current)} ${pending.label.replace(/^\d+\s*/, "").toLowerCase()}`
    : "Toate cerințele îndeplinite — promovare automată în curând!";

  return (
    <div className={`pm-card !p-4 ${allDone ? "!border-[var(--pm-primary)]/40" : ""} ${className}`} data-testid="tier-progress-widget">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${allDone ? "bg-[var(--pm-primary-container)] text-[var(--pm-primary)]" : "bg-[var(--pm-surface-high)] text-[var(--pm-primary)]"}`}>
          {allDone ? <Sparkles className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-stone-400">Progres către</span>
              <PMChip variant="primary" testid="tier-progress-next-chip">{nextTier}</PMChip>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-stone-500 hover:text-stone-300 flex items-center gap-1"
              data-testid="tier-progress-toggle"
            >
              {expanded ? "Mai puțin" : "Detalii"}
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
          <div className="text-sm text-[var(--pm-text)] mb-2 font-medium" data-testid="tier-progress-message">
            {pendingMsg}
          </div>
          <PMProgress value={overallPct} showValue testid="tier-progress-bar" />

          {expanded && (
            <div className="mt-4 space-y-3 pt-3 border-t border-white/5">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-2">Cerințe</div>
                <div className="space-y-2">
                  {requirements.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-xs" data-testid={`tier-progress-req-${i}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {r.done ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--pm-primary)] shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border-2 border-stone-600 shrink-0" />
                        )}
                        <span className={r.done ? "text-stone-400 line-through" : "text-stone-200"}>{r.label}</span>
                      </div>
                      <span className={`font-mono shrink-0 ${r.done ? "text-stone-500" : "text-[var(--pm-primary)]"}`}>
                        {r.current.toFixed(r.min < 10 ? 1 : 0)}/{r.min}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-2">Deblochezi la {nextTier}</div>
                <div className="flex flex-wrap gap-1.5">
                  {unlocks.map((u, i) => (
                    <span key={i} className="text-[10px] bg-[var(--pm-primary-container)] text-[var(--pm-primary)] border border-[var(--pm-primary)]/20 px-2 py-1 rounded-full inline-flex items-center gap-1" data-testid={`tier-progress-unlock-${i}`}>
                      <Lock className="w-2.5 h-2.5" />
                      {u}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
