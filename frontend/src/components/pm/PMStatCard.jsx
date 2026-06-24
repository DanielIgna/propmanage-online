import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

export const PMStatCard = ({ icon: Icon, label, value, delta, deltaType = "up", trailing, className = "", testid }) => (
  <div className={`pm-stat ${className}`} data-testid={testid}>
    <div className="flex justify-between items-start">
      {Icon && (
        <div className="pm-stat-icon">
          <Icon className="w-5 h-5" />
        </div>
      )}
      {delta && (
        <span className={`pm-stat-delta ${deltaType === "up" ? "pm-stat-delta-up" : "pm-stat-delta-down"} flex items-center gap-1`}>
          {deltaType === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {delta}
        </span>
      )}
      {trailing}
    </div>
    <div>
      {label && <p className="pm-stat-label mb-1">{label}</p>}
      <p className="pm-stat-value">{value}</p>
    </div>
  </div>
);
