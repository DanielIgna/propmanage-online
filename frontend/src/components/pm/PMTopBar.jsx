import React from "react";

export const PMTopBar = ({ leading, title, subtitle, trailing, className = "", testid }) => (
  <header className={`pm-topbar px-4 md:px-8 py-3 ${className}`} data-testid={testid}>
    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {leading}
        <div className="min-w-0">
          {title && <div className="text-base md:text-lg font-bold text-[var(--pm-text)] truncate">{title}</div>}
          {subtitle && <div className="text-xs text-[var(--pm-text-variant)] truncate">{subtitle}</div>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">{trailing}</div>
    </div>
  </header>
);
