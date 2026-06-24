import React from "react";

// items: [{ id, label, icon: Icon, onClick, active }]
export const PMBottomNav = ({ items = [], className = "", testid }) => (
  <nav className={`pm-bottomnav md:hidden ${className}`} data-testid={testid}>
    {items.map((it) => {
      const Icon = it.icon;
      return (
        <button
          key={it.id}
          onClick={it.onClick}
          className={`pm-bottomnav-item ${it.active ? "active" : ""}`}
          data-testid={`pm-bottomnav-${it.id}`}
        >
          {Icon && <Icon className="w-5 h-5" />}
          <span>{it.label}</span>
        </button>
      );
    })}
  </nav>
);
