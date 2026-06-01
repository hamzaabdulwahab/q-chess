"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export const CHESS_APP_SETTINGS_KEY = "chessAppSettings";

export const defaultChessAppSettings = {
  highlightLegalMoves: true,
  highlightLastMove: true,
  showCoordinates: true,
  autoPromoteToQueen: false,
  confirmMove: false,
  autoFlipBoard: true,
  showCapturedPieces: true,
};

export type ChessAppSettings = typeof defaultChessAppSettings;

type SettingsContextValue = {
  settings: ChessAppSettings;
  updateSetting: <K extends keyof ChessAppSettings>(
    key: K,
    value: ChessAppSettings[K],
  ) => void;
  resetSettings: () => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): ChessAppSettings {
  if (typeof window === "undefined") return defaultChessAppSettings;

  try {
    const raw = window.localStorage.getItem(CHESS_APP_SETTINGS_KEY);
    if (!raw) return defaultChessAppSettings;
    const parsed = JSON.parse(raw) as Partial<ChessAppSettings>;
    return { ...defaultChessAppSettings, ...parsed };
  } catch {
    return defaultChessAppSettings;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ChessAppSettings>(
    defaultChessAppSettings,
  );

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        CHESS_APP_SETTINGS_KEY,
        JSON.stringify(settings),
      );
    } catch {
    }
  }, [settings]);

  const updateSetting = useCallback(
    <K extends keyof ChessAppSettings>(key: K, value: ChessAppSettings[K]) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const resetSettings = useCallback(() => {
    setSettings(defaultChessAppSettings);
  }, []);

  const value = useMemo(
    () => ({ settings, updateSetting, resetSettings }),
    [settings, updateSetting, resetSettings],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
