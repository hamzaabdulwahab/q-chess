"use client";

import React, { useState } from "react";
import { Settings, X } from "lucide-react";
import {
  type ChessAppSettings,
  useSettings,
} from "@/lib/settings-context";

type SettingKey = keyof ChessAppSettings;

const boardSettings: Array<{ key: SettingKey; label: string }> = [
  { key: "highlightLegalMoves", label: "Highlight legal moves" },
  { key: "highlightLastMove", label: "Highlight last move" },
  { key: "showCoordinates", label: "Show coordinates" },
];

const gameplaySettings: Array<{ key: SettingKey; label: string }> = [
  { key: "autoPromoteToQueen", label: "Auto-promote to Queen" },
  { key: "confirmMove", label: "Confirm move before submitting" },
  { key: "autoFlipBoard", label: "Auto-flip board after each move" },
  { key: "showCapturedPieces", label: "Show captured pieces" },
];

function ToggleRow({ settingKey, label }: { settingKey: SettingKey; label: string }) {
  const { settings, updateSetting } = useSettings();
  const checked = settings[settingKey];

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <span className="text-sm" style={{ color: "var(--text-2)" }}>
        {label}
      </span>
      <button
        type="button"
        onClick={() => updateSetting(settingKey, !checked)}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{
          background: checked ? "var(--accent)" : "var(--surface-2)",
          border: "1px solid var(--border-strong)",
        }}
        aria-pressed={checked}
        aria-label={label}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full transition-transform"
          style={{
            left: checked ? "calc(100% - 1.125rem)" : "0.125rem",
            background: checked ? "var(--accent-fg)" : "var(--text-2)",
          }}
        />
      </button>
    </div>
  );
}

export function SettingsPanel({ className = "" }: { className?: string }) {
  const { resetSettings } = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`btn-secondary inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm ${className}`}
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        <span>Settings</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-3 sm:items-center">
          <div
            className="w-full max-w-md rounded-lg p-4 shadow-2xl"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              color: "var(--text)",
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Chess settings"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold tracking-tight">
                Settings
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost rounded-md p-1.5"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <section>
              <h3
                className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-3)" }}
              >
                Board
              </h3>
              <div className="divide-y divide-white/10">
                {boardSettings.map((setting) => (
                  <ToggleRow
                    key={setting.key}
                    settingKey={setting.key}
                    label={setting.label}
                  />
                ))}
              </div>
            </section>

            <section className="mt-5">
              <h3
                className="mb-1 text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-3)" }}
              >
                Gameplay
              </h3>
              <div className="divide-y divide-white/10">
                {gameplaySettings.map((setting) => (
                  <ToggleRow
                    key={setting.key}
                    settingKey={setting.key}
                    label={setting.label}
                  />
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={resetSettings}
              className="btn-ghost mt-5 w-full rounded-md py-2 text-sm"
            >
              Reset defaults
            </button>
          </div>
        </div>
      )}
    </>
  );
}
