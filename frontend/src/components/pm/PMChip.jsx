import React from "react";

const VARIANTS = ["default", "primary", "error", "warning", "success", "info"];

export const PMChip = ({ children, variant = "default", icon: Icon, className = "", testid }) => {
  const variantClass = VARIANTS.includes(variant) && variant !== "default" ? `pm-chip-${variant}` : "";
  return (
    <span className={`pm-chip ${variantClass} ${className}`} data-testid={testid}>
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
};
