// PropManage - Bottom navigation bar (mobile-first, also visible on desktop)
// Each role has 4 strict zones, inspired by HomeRun Pro pattern.
import React from "react";

export const BottomNav = ({ tabs, active, onChange, dataPrefix = "tab" }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-[#0a0a0b]/90 backdrop-blur-xl border-t border-white/10"
      data-testid="bottom-nav"
    >
      <div className="max-w-7xl mx-auto px-2 sm:px-6">
        <div className="grid grid-cols-4">
          {tabs.map((tab) => {
            const isActive = active === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className={`relative flex flex-col items-center justify-center gap-1 py-3 transition-colors ${
                  isActive ? "text-[#d4ff3a]" : "text-stone-500 hover:text-stone-300"
                }`}
                data-testid={`${dataPrefix}-${tab.id}`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.2 : 1.8} />
                  {tab.badge > 0 && (
                    <span
                      className="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d4ff3a] text-black text-[10px] font-bold flex items-center justify-center"
                      data-testid={`${dataPrefix}-badge-${tab.id}`}
                    >
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] sm:text-[11px] font-medium tracking-tight">
                  {tab.label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full bg-[#d4ff3a]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
