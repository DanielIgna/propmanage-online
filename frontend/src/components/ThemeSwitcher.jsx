// Theme switcher — small toggle showing current theme + dropdown of choices.
import React, { useState } from "react";
import { Sun, Moon, Palette, ChevronDown } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export const ThemeSwitcher = ({ compact = false }) => {
  const { theme, setTheme, themes } = useTheme();
  const [open, setOpen] = useState(false);
  const current = themes.find((t) => t.id === theme) || themes[0];
  const Icon = theme === "warm-linen" ? Sun : Moon;

  return (
    <div className="relative" data-testid="theme-switcher">
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-700 text-stone-300 hover:border-stone-500 hover:text-stone-100 text-xs transition-colors ${compact ? "" : "min-w-[140px]"}`}
        data-testid="theme-switcher-trigger"
        title={`Tema curentă: ${current.label}`}
      >
        <Icon className="w-3.5 h-3.5" />
        {!compact && <span className="flex-1 text-left">{current.label}</span>}
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 min-w-[200px] bg-stone-900 border border-stone-700 rounded-lg shadow-2xl z-40 overflow-hidden" data-testid="theme-switcher-menu">
            <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-stone-500 font-bold border-b border-stone-800 flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Schimbă tema
            </div>
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false); }}
                data-testid={`theme-option-${t.id}`}
                className={`w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-stone-800 transition-colors ${theme === t.id ? "bg-emerald-500/15 text-emerald-300 font-semibold" : "text-stone-300"}`}
              >
                <span className="text-base">{t.emoji}</span>
                <span className="flex-1">{t.label}</span>
                {theme === t.id && <span className="text-[10px] text-emerald-400">✓ activ</span>}
              </button>
            ))}
            <div className="px-3 py-1.5 text-[10px] text-stone-500 border-t border-stone-800 italic">
              Preferința e salvată automat în browserul tău.
            </div>
          </div>
        </>
      )}
    </div>
  );
};
