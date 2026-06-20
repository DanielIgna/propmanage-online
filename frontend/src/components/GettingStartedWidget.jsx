// PropManage — Getting Started Widget (Progressive Disclosure)
// Shows on dashboard for Junior + Regular users.
// Lists: unlocked features + locked features + how to unlock next ones.
// Non-intrusive: collapsible, dismissible per session.
// Builds on existing TierGate / experience_tier infrastructure (Phase 52).
import React, { useState, useEffect } from "react";
import { useAuth } from "../auth";
import {
  Sparkles, Lock, Unlock, CheckCircle2, ChevronDown, ChevronUp, X,
  Target, Award, MessageSquare, FileCheck, Crown, Zap,
} from "lucide-react";

const DISMISS_KEY = "pm_getting_started_dismissed_session";

// Progressive unlock map — what's available at each tier
const TIER_FEATURES = {
  client: {
    junior: [
      { key: "post_request", label: "Publică o cerere de ofertă", icon: Target, unlocked: true },
      { key: "view_specialists", label: "Vezi specialiști în Marketplace", icon: Award, unlocked: true },
      { key: "messages", label: "Conversații cu specialiști", icon: MessageSquare, unlocked: true },
    ],
    regular: [
      { key: "vouchers", label: "Vouchere și recompense pentru activitate", icon: Sparkles, unlocked: true },
      { key: "multi_offer", label: "Compară oferte multiple per cerere", icon: FileCheck, unlocked: true },
      { key: "review_v2", label: "Recenzii detaliate (8 dimensiuni)", icon: Award, unlocked: true },
    ],
    verified: [
      { key: "premium_specialists", label: "Acces la specialiști PREMIUM", icon: Crown, unlocked: true },
      { key: "advanced_filters", label: "Filtre avansate marketplace", icon: Zap, unlocked: true },
    ],
    pro: [
      { key: "concierge", label: "AI Concierge personal pentru toate proiectele", icon: Sparkles, unlocked: true },
    ],
  },
  specialist: {
    junior: [
      { key: "apply_lead", label: "Aplică la o cerere de ofertă", icon: Target, unlocked: true },
      { key: "wallet_topup", label: "Reîncarcă portofel pentru fee-uri", icon: Award, unlocked: true },
      { key: "view_jobs", label: "Vezi lucrările tale", icon: FileCheck, unlocked: true },
    ],
    regular: [
      { key: "vouchers", label: "Vouchere și quest-uri zilnice", icon: Sparkles, unlocked: true },
      { key: "review_clients", label: "Evaluează clienții (reverse reviews)", icon: MessageSquare, unlocked: true },
      { key: "multi_offer_apply", label: "Aplică cu fee custom (mod multi-oferte)", icon: FileCheck, unlocked: true },
    ],
    verified: [
      { key: "verified_badge", label: "Badge VERIFIED vizibil în Marketplace", icon: Award, unlocked: true },
      { key: "priority_visibility", label: "Vizibilitate sporită în Marketplace", icon: Zap, unlocked: true },
    ],
    pro: [
      { key: "premium_profile", label: "Profil Premium cu portofoliu + servicii detaliate", icon: Crown, unlocked: true },
      { key: "marketplace_premium", label: "Listing pe pagina /marketplace/premium", icon: Crown, unlocked: true },
    ],
  },
};

const TIER_ORDER = ["junior", "regular", "verified", "pro"];

const UNLOCK_HINTS = {
  client: {
    regular: "Postează 1 cerere și finalizează o lucrare",
    verified: "Verifică emailul + finalizează 3 lucrări cu rating 4+",
    pro: "10+ lucrări finalizate cu rating mediu 4.5+",
  },
  specialist: {
    regular: "Finalizează prima ta lucrare",
    verified: "10 lucrări finalizate cu rating ≥ 4.2",
    pro: "50 lucrări finalizate cu rating ≥ 4.7",
  },
};


export const GettingStartedWidget = ({ role }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(sessionStorage.getItem(DISMISS_KEY) === "1");

  if (!user || user === false) return null;
  if (dismissed) return null;
  const tier = user.experience_tier || "junior";
  // Only show for junior + regular (the "still discovering" tiers)
  if (!["junior", "regular"].includes(tier)) return null;
  const features = TIER_FEATURES[role] || TIER_FEATURES.client;
  const myIdx = TIER_ORDER.indexOf(tier);
  const unlockedTiers = TIER_ORDER.slice(0, myIdx + 1);
  const nextTier = TIER_ORDER[myIdx + 1];

  const unlockedFeatures = unlockedTiers.flatMap(t => features[t] || []);
  const lockedFeatures = TIER_ORDER.slice(myIdx + 1).flatMap(t => (features[t] || []).map(f => ({ ...f, locked_at_tier: t })));

  const close = () => {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="glass rounded-2xl mb-6 border border-[#d4ff3a]/20" data-testid="getting-started-widget">
      <div className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#d4ff3a]/15 flex items-center justify-center shrink-0">
          <Sparkles className="w-5 h-5 text-[#d4ff3a]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">Ghid de pornire</div>
          <div className="text-xs text-stone-400">
            Nivel: <strong className="text-[#d4ff3a]">{tier.toUpperCase()}</strong> · {unlockedFeatures.length} funcții deblocate · {lockedFeatures.length} mai sunt
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)} className="text-stone-400 hover:text-stone-200 p-1" data-testid="getting-started-toggle">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button onClick={close} className="text-stone-500 hover:text-stone-300 p-1" data-testid="getting-started-dismiss" title="Închide până la următorul login">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {open && (
        <div className="border-t border-white/5 px-4 py-4 space-y-4">
          <div>
            <div className="text-[10px] uppercase text-emerald-300 mb-2 flex items-center gap-1.5"><Unlock className="w-3 h-3" /> Deja deblocate</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {unlockedFeatures.map(f => {
                const Icon = f.icon;
                return (
                  <div key={f.key} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-emerald-500/5" data-testid={`unlocked-${f.key}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="text-stone-200">{f.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {lockedFeatures.length > 0 && (
            <div>
              <div className="text-[10px] uppercase text-amber-300 mb-2 flex items-center gap-1.5"><Lock className="w-3 h-3" /> De deblocat</div>
              {nextTier && UNLOCK_HINTS[role]?.[nextTier] && (
                <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-2" data-testid="next-tier-hint">
                  🎯 <strong>Pentru a urca la {nextTier.toUpperCase()}</strong>: {UNLOCK_HINTS[role][nextTier]}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {lockedFeatures.slice(0, 6).map(f => {
                  const Icon = f.icon;
                  return (
                    <div key={f.key} className="flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg bg-white/3 opacity-60" data-testid={`locked-${f.key}`}>
                      <Icon className="w-3.5 h-3.5 text-stone-500 shrink-0" />
                      <span className="text-stone-400">{f.label}</span>
                      <span className="ml-auto text-[9px] uppercase text-stone-500 tracking-wider">{f.locked_at_tier}</span>
                    </div>
                  );
                })}
                {lockedFeatures.length > 6 && (
                  <div className="text-[10px] text-stone-500 italic px-2 py-1.5">+{lockedFeatures.length - 6} alte funcții</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GettingStartedWidget;
