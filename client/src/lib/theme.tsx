import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";
const STORAGE_KEY = "tajmer-theme";

interface ThemeCtx {
  theme: Theme;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function readInitial(): Theme {
  if (typeof document !== "undefined" && document.documentElement.classList.contains("light")) {
    return "light";
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readInitial);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggle = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);

  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
