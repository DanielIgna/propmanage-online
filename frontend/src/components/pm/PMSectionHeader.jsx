import React from "react";
import { ArrowRight } from "lucide-react";

export const PMSectionHeader = ({ title, linkLabel, onLinkClick, trailing, className = "", testid }) => (
  <div className={`pm-section-header ${className}`} data-testid={testid}>
    <h2 className="pm-section-title">{title}</h2>
    {trailing ? trailing : linkLabel && (
      <button className="pm-section-link" onClick={onLinkClick} data-testid={testid ? `${testid}-link` : undefined}>
        {linkLabel}
        <ArrowRight className="w-4 h-4" />
      </button>
    )}
  </div>
);
