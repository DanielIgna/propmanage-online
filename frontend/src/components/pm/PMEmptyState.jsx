import React from "react";

export const PMEmptyState = ({ icon: Icon, title, description, action, className = "", testid }) => (
  <div className={`pm-card-glass flex flex-col items-center text-center py-12 px-6 ${className}`} data-testid={testid}>
    {Icon && (
      <div className="w-16 h-16 rounded-2xl bg-[var(--pm-surface-high)] text-[var(--pm-text-muted)] flex items-center justify-center mb-4">
        <Icon className="w-7 h-7" />
      </div>
    )}
    {title && <h3 className="font-semibold text-lg text-[var(--pm-text)] mb-1">{title}</h3>}
    {description && <p className="text-sm text-[var(--pm-text-variant)] max-w-md">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);
