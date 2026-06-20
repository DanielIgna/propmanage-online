// Progressive Disclosure Helper
// Returns user's effective tier level and helpers to check unlocks.
//
// Unlock matrix:
//   ENTRY (specialist) | JUNIOR (client/specialist) | VERIFIED | ADVANCED (specialist) | PREMIUM | TOP (specialist)
//
// What's UNLOCKED at each tier — see /app/memory/PRD.md for full matrix.
import { useAuth } from "../auth";

// Numeric rank for comparison
const TIER_RANK = {
  ENTRY: 0,
  JUNIOR: 1,
  VERIFIED: 2,
  ADVANCED: 3,
  PREMIUM: 4,
  TOP: 5,
};

const normalizeTier = (raw) => {
  if (!raw) return "ENTRY";
  const up = String(raw).toUpperCase();
  return TIER_RANK[up] !== undefined ? up : "ENTRY";
};

export const useTier = () => {
  const { user } = useAuth();
  const tier = normalizeTier(user?.tier);
  const rank = TIER_RANK[tier] ?? 0;

  const isAtLeast = (minTier) => {
    const minRank = TIER_RANK[normalizeTier(minTier)] ?? 0;
    return rank >= minRank;
  };

  const role = user?.role;
  const isVerified = !!user?.verified;
  const reviewsCount = user?.reviews_count || 0;
  const jobsCompleted = user?.jobs_completed || 0;

  return {
    tier,
    rank,
    role,
    isVerified,
    reviewsCount,
    jobsCompleted,
    isAtLeast,
    // Specialist-specific unlocks
    canSeeStats: isAtLeast("VERIFIED"),
    canSeeQuests: isAtLeast("VERIFIED"),
    canSeeBentoHero: isAtLeast("ADVANCED"),
    canSeePortfolio: isAtLeast("VERIFIED"),
    canSeePremiumProfile: isAtLeast("PREMIUM"),
    canSeeBIInsights: isAtLeast("TOP"),
    canSeeTwinTools: isAtLeast("TOP"),
    canSeeVoucherWidget: isAtLeast("ADVANCED"),
    canSeeTierCelebration: isAtLeast("JUNIOR"),
    // Client-specific unlocks
    canSeeEchipa: isAtLeast("VERIFIED"),
    canSeeCommunityWidget: isAtLeast("VERIFIED"),
    canSeeAdvancedFilters: isAtLeast("VERIFIED"),
    canSeeNotificationsTab: isAtLeast("JUNIOR"),
    canSeeAllServices: true, // always available
    canSeeDigitalTwin: isAtLeast("VERIFIED"),
  };
};

// Component to conditionally render based on tier (alternative to TierGate)
export const ShowFromTier = ({ minTier, children, fallback = null }) => {
  const { isAtLeast } = useTier();
  return isAtLeast(minTier) ? children : fallback;
};
