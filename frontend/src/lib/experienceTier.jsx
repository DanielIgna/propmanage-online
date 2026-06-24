// Experience Tiers — Progressive Disclosure primitives
//
// Use these in any client/specialist/operator-facing component to conditionally
// show features based on the user's experience tier.
//
// USAGE EXAMPLES:
//
//   // 1) Show advanced filter only for regular+ users:
//   <TierGate min="regular">
//     <AdvancedFiltersPanel />
//   </TierGate>
//
//   // 2) Imperative check inside logic:
//   const { hasFeature } = useTier();
//   if (hasFeature("bulk_operations")) { ... }
//
//   // 3) Show a "upgrade hint" to junior users:
//   <TierGate min="verified" fallback={<UpgradeHint requiredTier="verified" />}>
//     <BulkExportButton />
//   </TierGate>
//
// Tier order: junior < regular < verified < pro

import React from "react";
import { useAuth } from "../auth";
import { Lock, Sparkles } from "lucide-react";

export const TIER_ORDER = ["junior", "regular", "verified", "pro"];

export const TIER_LABEL = {
  junior:   "Junior",
  regular:  "Regular",
  verified: "Verified",
  pro:      "Pro",
};

export const TIER_COLOR = {
  junior:   "bg-stone-500/10 border-stone-500/30 text-stone-300",
  regular:  "bg-blue-500/10 border-blue-500/30 text-blue-300",
  verified: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
  pro:      "bg-violet-500/10 border-violet-500/30 text-violet-300",
};

const TIER_FEATURES = {
  junior:   ["basic_dashboard", "simple_request_creation", "essential_messages"],
  regular:  ["advanced_filters", "saved_searches", "request_templates", "comparison_view", "weekly_summary_email"],
  verified: ["bulk_operations", "advanced_analytics", "priority_matching", "custom_notifications", "export_data"],
  pro:      ["api_access", "white_label_reports", "priority_support", "early_access_features", "dedicated_account_manager"],
};

function tierIndex(t) {
  const i = TIER_ORDER.indexOf(t);
  return i < 0 ? 0 : i;
}

function unlockedFeatures(tier) {
  const idx = tierIndex(tier);
  const out = [];
  for (let i = 0; i <= idx; i++) {
    out.push(...(TIER_FEATURES[TIER_ORDER[i]] || []));
  }
  return out;
}

/**
 * Hook returning helpers about the current user's experience tier.
 *
 * Returns:
 *   - tier: "junior" | "regular" | "verified" | "pro"
 *   - tierLabel: human-readable label
 *   - tierIndex: 0-3
 *   - meetsTier(min): true if current tier >= min
 *   - hasFeature(featureKey): true if feature is unlocked
 *   - features: array of unlocked feature keys
 */
export function useTier() {
  const { user } = useAuth();
  const tier = (user && user.experience_tier) || "junior";
  const idx = tierIndex(tier);
  const features = unlockedFeatures(tier);

  return {
    tier,
    tierLabel: TIER_LABEL[tier],
    tierColor: TIER_COLOR[tier],
    tierIndex: idx,
    meetsTier: (min) => idx >= tierIndex(min),
    hasFeature: (key) => features.includes(key),
    features,
  };
}

/**
 * Conditionally render children based on the user's tier.
 *
 * Props:
 *   - min: minimum tier required (e.g. "regular")
 *   - feature: alternative — check by feature key (e.g. "bulk_operations")
 *   - fallback: optional element to render when locked
 *   - children: the unlocked content
 */
export function TierGate({ min, feature, fallback = null, children }) {
  const { meetsTier, hasFeature } = useTier();
  const allowed = feature ? hasFeature(feature) : meetsTier(min || "junior");
  if (allowed) return <>{children}</>;
  return <>{fallback}</>;
}

/**
 * Small inline badge showing the user's current tier. Use it in profiles,
 * dashboards header, etc.
 */
export function TierBadge({ className = "", showLabel = true }) {
  const { tier, tierLabel, tierColor } = useTier();
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${tierColor} ${className}`}
      data-testid="tier-badge"
      title={`Experience tier: ${tierLabel}`}
    >
      <Sparkles className="w-2.5 h-2.5" />
      {showLabel && tierLabel}
    </span>
  );
}

/**
 * Ready-made "upgrade hint" — friendly nudge for users who don't meet the tier.
 * Use as `fallback` in <TierGate>.
 */
export function UpgradeHint({ requiredTier = "regular", featureName = "această funcție" }) {
  return (
    <div className="bg-violet-500/5 border border-violet-500/30 rounded-xl p-3 text-xs text-violet-100 flex items-center gap-2" data-testid="upgrade-hint">
      <Lock className="w-3.5 h-3.5 text-violet-300 shrink-0" />
      <span>
        Pentru a folosi <strong>{featureName}</strong>, ai nevoie de nivel{" "}
        <strong className="text-violet-200">{TIER_LABEL[requiredTier] || requiredTier}</strong>.
        Continuă să folosești platforma — promovarea se face automat.
      </span>
    </div>
  );
}

export default TierGate;
