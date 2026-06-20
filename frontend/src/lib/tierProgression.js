// Tier Progression Requirements
// Defines what each user needs to advance to the next tier.
//
// For specialists:
//   ENTRY    → JUNIOR    : complete 1 job
//   JUNIOR   → VERIFIED  : 5+ jobs + KYC verified
//   VERIFIED → ADVANCED  : 20+ jobs + rating ≥ 4.5
//   ADVANCED → PREMIUM   : 50+ jobs + rating ≥ 4.7
//   PREMIUM  → TOP       : 100+ jobs + rating ≥ 4.9
//
// For clients:
//   JUNIOR   → VERIFIED  : KYC done OR 1+ confirmed job
//   VERIFIED → PREMIUM   : 5+ confirmed jobs

const SPECIALIST_LADDER = [
  {
    from: "ENTRY",
    to: "JUNIOR",
    requirements: [
      { key: "jobs_completed", min: 1, label: "Lucrare finalizată", measure: (u) => u?.jobs_completed || 0 },
    ],
    unlocks: ["Celebrare tier", "Status badge JUNIOR"],
  },
  {
    from: "JUNIOR",
    to: "VERIFIED",
    requirements: [
      { key: "jobs_completed", min: 5, label: "5 lucrări finalizate", measure: (u) => u?.jobs_completed || 0 },
      { key: "verified", min: 1, label: "Verificare KYC", measure: (u) => (u?.verified ? 1 : 0) },
    ],
    unlocks: ["Stats Bento", "Notificări tab", "Quest panel", "Portofoliu", "Filtre avansate"],
  },
  {
    from: "VERIFIED",
    to: "ADVANCED",
    requirements: [
      { key: "jobs_completed", min: 20, label: "20 lucrări finalizate", measure: (u) => u?.jobs_completed || 0 },
      { key: "rating", min: 4.5, label: "Rating ≥ 4.5", measure: (u) => u?.rating || 0 },
    ],
    unlocks: ["Hero verde tier", "Voucher widget", "Matching prioritar"],
  },
  {
    from: "ADVANCED",
    to: "PREMIUM",
    requirements: [
      { key: "jobs_completed", min: 50, label: "50 lucrări finalizate", measure: (u) => u?.jobs_completed || 0 },
      { key: "rating", min: 4.7, label: "Rating ≥ 4.7", measure: (u) => u?.rating || 0 },
    ],
    unlocks: ["Profil Premium editor", "Marketing badge", "Aplicare în masă"],
  },
  {
    from: "PREMIUM",
    to: "TOP",
    requirements: [
      { key: "jobs_completed", min: 100, label: "100 lucrări finalizate", measure: (u) => u?.jobs_completed || 0 },
      { key: "rating", min: 4.9, label: "Rating ≥ 4.9", measure: (u) => u?.rating || 0 },
    ],
    unlocks: ["BI insights", "Twin tools", "White-label rapoarte", "Support 24/7"],
  },
];

const CLIENT_LADDER = [
  {
    from: "JUNIOR",
    to: "VERIFIED",
    requirements: [
      { key: "kyc_or_first_job", min: 1, label: "KYC sau prima lucrare confirmată", measure: (u) => (u?.kyc_status === "approved" || (u?.jobs_completed || 0) >= 1) ? 1 : 0 },
    ],
    unlocks: ["Digital Twin", "Echipa mea", "Filtre avansate", "Recenzii cu poze"],
  },
  {
    from: "VERIFIED",
    to: "PREMIUM",
    requirements: [
      { key: "jobs_completed", min: 5, label: "5 lucrări confirmate", measure: (u) => u?.jobs_completed || 0 },
    ],
    unlocks: ["Voucher exclusiv", "Suport prioritar", "Specialist matching VIP"],
  },
];

/**
 * Returns the progression step for the current user, or null if at top tier.
 *
 * Returns object: {
 *   currentTier, nextTier, requirements: [{label, measure, min, current, pct}], unlocks, overallPct
 * }
 */
export function getNextTierProgress(user) {
  if (!user) return null;
  const role = user.role;
  const ladder = role === "specialist" ? SPECIALIST_LADDER : role === "client" ? CLIENT_LADDER : null;
  if (!ladder) return null;

  const currentTier = (user.tier || (role === "specialist" ? "ENTRY" : "JUNIOR")).toUpperCase();
  const step = ladder.find((s) => s.from === currentTier);
  if (!step) return null;  // user is at the top tier

  const requirements = step.requirements.map((r) => {
    const current = r.measure(user);
    const pct = Math.min(100, (current / r.min) * 100);
    return {
      label: r.label,
      current,
      min: r.min,
      pct,
      done: current >= r.min,
    };
  });
  const overallPct = Math.round(
    requirements.reduce((s, r) => s + r.pct, 0) / Math.max(1, requirements.length)
  );

  return {
    role,
    currentTier,
    nextTier: step.to,
    requirements,
    unlocks: step.unlocks,
    overallPct,
    allDone: requirements.every((r) => r.done),
  };
}
