"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import {
  chessThemes,
  DEFAULT_THEME_ID,
  GLOBAL_THEME_KEY,
  GLOBAL_THEME_USER_SET_KEY,
  getThemeById,
  isValidThemeId,
  type ChessTheme,
} from "@/lib/themes";

// Re-export the theme data/types so existing consumers can keep importing them
// from "@/lib/theme-context" unchanged.
export { chessThemes } from "@/lib/themes";
export type { ChessTheme } from "@/lib/themes";

interface ThemeContextType {
  currentTheme: ChessTheme;
  setTheme: (themeId: string) => void;
  themes: ChessTheme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function persistThemePreference(themeId: string, userSet: boolean) {
  try {
    localStorage.setItem(GLOBAL_THEME_KEY, themeId);
    localStorage.setItem(GLOBAL_THEME_USER_SET_KEY, userSet ? "true" : "false");
    // The cookie is read server-side by the root layout to set data-chess-theme
    // before paint (true zero-flicker); the data attribute drives the board's
    // CSS variables, so updating it here recolors the board with no re-render.
    document.cookie = `${GLOBAL_THEME_KEY}=${themeId}; Path=/; SameSite=Lax; Max-Age=31536000`;
    document.documentElement.dataset.chessTheme = themeId;
  } catch {
    // Storage/cookies disabled: in-memory theme state still applies for the tab.
  }
}

// PURE read — no writes. Mirrors whatever was resolved before paint (the SSR
// cookie or the read-only boot script set data-chess-theme on <html>), then
// falls back to a user-set localStorage value, then the Forest Green default.
// Running side effects in a useState initializer is a React anti-pattern (it can
// run twice under StrictMode/concurrent rendering); seeding now lives entirely
// in the layout boot script.
function loadInitialThemeId(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const fromAttr = document.documentElement.dataset.chessTheme;
    if (isValidThemeId(fromAttr)) return fromAttr as string;

    const saved = localStorage.getItem(GLOBAL_THEME_KEY);
    const userSet =
      localStorage.getItem(GLOBAL_THEME_USER_SET_KEY) === "true";
    if (userSet && isValidThemeId(saved)) return saved as string;

    return DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentThemeId, setCurrentThemeId] = useState(loadInitialThemeId);

  const setTheme = (themeId: string) => {
    if (!isValidThemeId(themeId)) return;
    setCurrentThemeId(themeId);
    persistThemePreference(themeId, true);
  };

  const currentTheme = getThemeById(currentThemeId);

  return (
    <ThemeContext.Provider
      value={{ currentTheme, setTheme, themes: chessThemes }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useChessTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useChessTheme must be used within a ThemeProvider");
  }
  return context;
}
