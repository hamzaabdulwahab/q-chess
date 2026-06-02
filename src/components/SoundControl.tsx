"use client";

import React, { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { AppIcon } from "@/components/AppIcon";
import { soundManager } from "@/lib/sound-manager";

interface SoundControlProps {
  className?: string;
  variant?: "panel" | "compact";
}

export const SoundControl: React.FC<SoundControlProps> = ({
  className = "",
  variant = "panel",
}) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setIsEnabled(soundManager.isEnabled());
    setVolume(soundManager.getVolume());
  }, []);

  const toggleSound = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    soundManager.setEnabled(next);
    if (next) soundManager.play("move");
  };

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    soundManager.setVolume(v);
    soundManager.play("move");
  };

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={toggleSound}
        className={`btn-secondary inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm ${className}`}
        title={isEnabled ? "Sound on" : "Sound off"}
        aria-pressed={isEnabled}
      >
        {isEnabled ? (
          <AppIcon icon={Volume2} className="h-4 w-4" />
        ) : (
          <AppIcon icon={VolumeX} className="h-4 w-4" />
        )}
        <span>{isEnabled ? "Sound on" : "Sound off"}</span>
      </button>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn-secondary inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm"
        title="Sound settings"
        aria-expanded={isOpen}
      >
        {isEnabled ? (
          <AppIcon icon={Volume2} className="h-4 w-4" />
        ) : (
          <AppIcon icon={VolumeX} className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {isEnabled ? "Sound on" : "Sound off"}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md p-4"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <h3
              className="mb-3 text-sm font-semibold"
              style={{ color: "var(--text)" }}
            >
              Sound
            </h3>

            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: "var(--text-2)" }}>
                Enable sounds
              </span>
              <button
                type="button"
                onClick={toggleSound}
                className="relative h-5 w-9 rounded-full transition-colors"
                style={{
                  background: isEnabled ? "var(--accent)" : "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                }}
                aria-pressed={isEnabled}
                aria-label="Toggle sounds"
              >
                <span
                  className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform"
                  style={{
                    left: isEnabled ? "calc(100% - 1rem)" : "0.125rem",
                    background: isEnabled
                      ? "var(--accent-fg)"
                      : "var(--text-2)",
                  }}
                />
              </button>
            </div>

            {isEnabled && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-2)" }}>Volume</span>
                  <span
                    className="tabular-nums"
                    style={{ color: "var(--text-3)" }}
                  >
                    {Math.round(volume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="sound-slider w-full"
                  style={
                    {
                      // Slider thumb / track colors come from <style jsx> below.
                    } as React.CSSProperties
                  }
                />
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn-ghost w-full rounded-md py-1.5 text-xs"
            >
              Close
            </button>
          </div>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
        </>
      )}

      <style jsx>{`
        .sound-slider {
          appearance: none;
          height: 4px;
          border-radius: 999px;
          background: var(--surface-2);
          cursor: pointer;
        }
        .sound-slider::-webkit-slider-thumb {
          appearance: none;
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: var(--text);
          cursor: pointer;
          border: 2px solid var(--surface);
        }
        .sound-slider::-moz-range-thumb {
          height: 14px;
          width: 14px;
          border-radius: 50%;
          background: var(--text);
          cursor: pointer;
          border: 2px solid var(--surface);
        }
      `}</style>
    </div>
  );
};
