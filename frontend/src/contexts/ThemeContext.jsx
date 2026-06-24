// Theme context — persists selection in localStorage, applies data-theme on <html>.
import React, { createContext, useContext, useEffect, useState } from "react";

const THEMES = [
  { id: "default", label: "Dark (default)", emoji: "🌙" },
  { id: "warm-linen", label: "Warm Linen 2026", emoji: "🌾" },
];

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem("propmanage_theme") || "default"; }
    catch (_e) { return "default"; }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme && theme !== "default") {
      root.setAttribute("data-theme", theme);
    } else {
      root.removeAttribute("data-theme");
    }
    try { localStorage.setItem("propmanage_theme", theme); } catch (_e) { /* ignore */ }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be inside ThemeProvider");
  return ctx;
};
