import React from "react";

export const PMCard = ({ children, className = "", accent, onClick, testid, ...rest }) => {
  const accentClass = accent ? `pm-row-accent pm-row-accent-${accent}` : "";
  return (
    <div
      className={`pm-card ${accentClass} ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
      data-testid={testid}
      {...rest}
    >
      {children}
    </div>
  );
};

export const PMCardGlass = ({ children, className = "", testid, ...rest }) => (
  <div className={`pm-card-glass ${className}`} data-testid={testid} {...rest}>
    {children}
  </div>
);

export const PMCardPrimary = ({ children, className = "", testid, ...rest }) => (
  <div className={`pm-card-primary ${className}`} data-testid={testid} {...rest}>
    <div className="relative z-10">{children}</div>
  </div>
);
