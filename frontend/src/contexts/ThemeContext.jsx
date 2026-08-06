import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "theme";
const VALID_THEMES = ["system", "light", "dark"];

function getSystemTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function readStoredTheme() {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID_THEMES.includes(stored) ? stored : "system";
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() =>
    theme === "system" ? getSystemTheme() : theme
  );

  const applyTheme = useCallback((value) => {
    const resolved = value === "system" ? getSystemTheme() : value;
    document.documentElement.setAttribute("data-theme", resolved);
    setResolvedTheme(resolved);
  }, []);

  const setTheme = useCallback(
    (value) => {
      if (!VALID_THEMES.includes(value)) return;
      setThemeState(value);
      window.localStorage.setItem(STORAGE_KEY, value);
      applyTheme(value);
    },
    [applyTheme]
  );

  // Apply on mount and whenever theme changes.
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  // React to OS-level changes while "system" is selected.
  useEffect(() => {
    if (theme !== "system" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => applyTheme("system");
    mql.addEventListener ? mql.addEventListener("change", handler) : mql.addListener(handler);
    return () => {
      mql.removeEventListener ? mql.removeEventListener("change", handler) : mql.removeListener(handler);
    };
  }, [theme, applyTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
