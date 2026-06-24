// GatedItem — wraps a UI element with feature-gating logic.
// - "available"  → renders children normally
// - "locked"     → renders children dimmed + lock icon + tooltip with reason
// - "hidden"     → renders nothing
import React from "react";
import { Lock } from "lucide-react";
import { canUse, lockedReason } from "../lib/featureMatrix";

export const GatedItem = ({ user, feature, children, lockedNote, hiddenFallback = null }) => {
  const access = canUse(user, feature);
  if (access === "hidden") return hiddenFallback;
  if (access === "locked") {
    const reason = lockedNote || lockedReason(user, feature);
    return (
      <div
        className="relative opacity-50 cursor-not-allowed select-none"
        title={reason}
        data-testid={`gated-${feature}`}
        data-gated-state="locked"
      >
        <div className="pointer-events-none">{children}</div>
        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center shadow-sm">
          <Lock className="w-2.5 h-2.5 text-amber-400" />
        </div>
      </div>
    );
  }
  return <div data-testid={`gated-${feature}`} data-gated-state="available">{children}</div>;
};

export default GatedItem;
