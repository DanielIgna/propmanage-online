// PropManage Business Design System — tokens semantice (unica sursă de adevăr)
// Culori SEMANTICE: verde=succes, albastru=info, portocaliu=atenție, roșu=critic, mov=AI, gri=neutru

export const SEMANTIC = {
  success:  { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-500/15", solid: "#10b981" },
  info:     { text: "text-blue-600 dark:text-blue-400",       bg: "bg-blue-50 dark:bg-blue-500/15",       solid: "#3b82f6" },
  warning:  { text: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-500/15",     solid: "#f59e0b" },
  critical: { text: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-500/15",       solid: "#f43f5e" },
  ai:       { text: "text-violet-600 dark:text-violet-400",   bg: "bg-violet-50 dark:bg-violet-500/15",   solid: "#8b5cf6" },
  neutral:  { text: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-700/50",    solid: "#64748b" },
};

// Ordinea standard a culorilor în grafice (recharts)
export const CHART_COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e", "#64748b"];
export const CHART = { strokeWidth: 2, gridDash: "3 3", gridOpacity: 0.2, tickFontSize: 10 };

// Spațiere standard: 24px secțiuni · 16px carduri · 12px în card · 8px label→valoare
export const SP = { section: "space-y-6", cards: "gap-4", inCard: "space-y-3", labelValue: "mt-2" };

// Grid unic: 12 col desktop/laptop · 6 tabletă · 1 mobil
export const GRID12 = "grid grid-cols-1 md:grid-cols-6 xl:grid-cols-12 gap-4";

// Card de bază — toate suprafețele Business folosesc exact acest stil
export const CARD = "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";

export const BADGE_STYLES = {
  NEW:     "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
  AI:      "bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
  BETA:    "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  LIVE:    "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  ACTIVE:  "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  WARNING: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  ERROR:   "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
};

export const BUTTON_STYLES = {
  primary:   "bg-blue-600 hover:bg-blue-700 text-white",
  secondary: "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700",
  ghost:     "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50",
  danger:    "bg-rose-600 hover:bg-rose-700 text-white",
  success:   "bg-emerald-600 hover:bg-emerald-700 text-white",
};
