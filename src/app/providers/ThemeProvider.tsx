import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useCurrentUser } from "../../features/profile/useCurrentUser";
import { applyTheme, readTheme, writeTheme } from "../theme";
import type { ThemeMode } from "../theme";

type ThemeContextValue = { mode: ThemeMode; toggle: () => void };

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const me = useCurrentUser();
  const userId = me.data?.data?.itemId ? String(me.data.data.itemId) : undefined;
  const [mode, setMode] = useState<ThemeMode>(() => readTheme());

  // The signed-in member's own stored choice wins once their profile resolves,
  // so the theme follows the member rather than the browser.
  useEffect(() => {
    if (userId) setMode(readTheme(userId));
  }, [userId]);

  useEffect(() => applyTheme(mode), [mode]);

  const toggle = useCallback(() => {
    setMode((current) => {
      const next: ThemeMode = current === "dark" ? "light" : "dark";
      writeTheme(next, userId);
      return next;
    });
  }, [userId]);

  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
