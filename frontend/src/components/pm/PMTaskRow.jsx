import React from "react";
import { ChevronRight } from "lucide-react";

export const PMTaskRow = ({
  title,
  subtitle,
  meta,
  trailing,
  urgency = "default", // default | urgent | warning | success
  image,
  icon: Icon,
  onClick,
  className = "",
  testid,
}) => {
  const accentMap = {
    urgent: "pm-row-accent-urgent",
    warning: "pm-row-accent-warning",
    success: "pm-row-accent-success",
    primary: "pm-row-accent-primary",
    default: "",
  };
  return (
    <div
      onClick={onClick}
      data-testid={testid}
      className={`pm-card pm-row-accent ${accentMap[urgency]} ${onClick ? "cursor-pointer group" : ""} flex items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        {image && (
          <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 hidden sm:block">
            <img src={image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        {!image && Icon && (
          <div className="w-12 h-12 rounded-xl bg-[var(--pm-surface-high)] shrink-0 hidden sm:flex items-center justify-center text-[var(--pm-primary)]">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-sm md:text-base text-[var(--pm-text)] truncate">{title}</h4>
          {subtitle && <p className="text-xs md:text-sm text-[var(--pm-text-variant)] truncate">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        {meta && (
          <div className="hidden md:block text-right">
            {meta}
          </div>
        )}
        {trailing}
        {onClick && (
          <button className="w-9 h-9 rounded-full flex items-center justify-center bg-[var(--pm-surface-high)] text-[var(--pm-text-variant)] group-hover:bg-[var(--pm-primary-container)] group-hover:text-[var(--pm-on-primary-container)] transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
