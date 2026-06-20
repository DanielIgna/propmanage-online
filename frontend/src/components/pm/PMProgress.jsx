import React from "react";

export const PMProgress = ({ value = 0, max = 100, label, showValue = false, className = "", testid }) => {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={className} data-testid={testid}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs mb-1.5 text-[var(--pm-text-variant)]">
          {label && <span>{label}</span>}
          {showValue && <span className="font-semibold text-[var(--pm-text)]">{Math.round(pct)}%</span>}
        </div>
      )}
      <div className="pm-progress">
        <div className="pm-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};
