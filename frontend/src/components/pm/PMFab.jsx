import React from "react";
import { Plus } from "lucide-react";

export const PMFab = ({ icon: Icon = Plus, onClick, label, className = "", testid }) => (
  <button
    onClick={onClick}
    className={`pm-fab ${className}`}
    aria-label={label || "Acțiune"}
    title={label}
    data-testid={testid}
  >
    <Icon className="w-6 h-6" />
  </button>
);
