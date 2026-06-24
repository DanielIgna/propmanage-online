import React from "react";

export const PMPillButton = ({
  children,
  variant = "primary",
  size = "md",
  icon: Icon,
  iconRight: IconRight,
  className = "",
  testid,
  ...rest
}) => {
  const sizeClass = size === "sm" ? "pm-pill-sm" : size === "lg" ? "pm-pill-lg" : "";
  const variantClass =
    variant === "on-container" ? "pm-pill-on-container" :
    variant === "ghost" ? "pm-pill-ghost" :
    "pm-pill-primary";

  return (
    <button
      className={`pm-pill ${variantClass} ${sizeClass} ${className}`}
      data-testid={testid}
      {...rest}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
      {IconRight && <IconRight className="w-4 h-4" />}
    </button>
  );
};
