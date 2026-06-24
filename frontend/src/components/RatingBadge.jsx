// Sprint A — Color-coded rating badge with optional low-rating warning.
// Green ≥4.5 · Yellow 3.5-4.4 · Red <3.5 (with warning text).
// Used in marketplace listings + specialist profile + admin users.
import React from "react";
import { Star, AlertTriangle } from "lucide-react";

const colorClass = (rating, reviewsCount) => {
  if (!rating || rating <= 0) return { wrap: "text-stone-500", icon: "text-stone-600", showWarn: false };
  if (reviewsCount < 3) return { wrap: "text-stone-400", icon: "text-stone-400", showWarn: false };
  if (rating >= 4.5) return { wrap: "text-emerald-400", icon: "fill-emerald-400 text-emerald-400", showWarn: false };
  if (rating >= 3.5) return { wrap: "text-amber-300", icon: "fill-amber-300 text-amber-300", showWarn: false };
  return { wrap: "text-red-400", icon: "fill-red-400 text-red-400", showWarn: true };
};

export const RatingBadge = ({ rating = 0, reviewsCount = 0, showWarning = true, size = "sm", className = "" }) => {
  const { wrap, icon, showWarn } = colorClass(rating, reviewsCount);
  const iconSize = size === "lg" ? "w-5 h-5" : size === "md" ? "w-4 h-4" : "w-3.5 h-3.5";
  const textSize = size === "lg" ? "text-base" : size === "md" ? "text-sm" : "text-xs";
  return (
    <div className={`inline-flex items-center gap-1 ${wrap} ${className}`} data-testid="rating-badge">
      <Star className={`${iconSize} ${icon}`} />
      <span className={`${textSize} font-medium tabular-nums`}>{rating ? Number(rating).toFixed(1) : "—"}</span>
      {reviewsCount > 0 && <span className="text-stone-500 text-[10px]">({reviewsCount})</span>}
      {showWarn && showWarning && (
        <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-[10px]" title="Rating sub medie — verifică atent recenziile" data-testid="rating-warning">
          <AlertTriangle className="w-2.5 h-2.5" /> sub medie
        </span>
      )}
    </div>
  );
};

export default RatingBadge;
