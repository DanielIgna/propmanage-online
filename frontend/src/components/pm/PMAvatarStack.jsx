import React from "react";

// avatars: [{ src?, initials?, alt? }]
export const PMAvatarStack = ({ avatars = [], max = 3, className = "", testid }) => {
  const visible = avatars.slice(0, max);
  const overflow = Math.max(0, avatars.length - max);
  return (
    <div className={`pm-avatar-stack ${className}`} data-testid={testid}>
      {visible.map((a, i) => (
        <div key={i} className="pm-avatar" title={a.alt}>
          {a.src ? <img src={a.src} alt={a.alt || ""} className="w-full h-full object-cover" /> : (a.initials || "?")}
        </div>
      ))}
      {overflow > 0 && (
        <div className="pm-avatar">+{overflow}</div>
      )}
    </div>
  );
};
