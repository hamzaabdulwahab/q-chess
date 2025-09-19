/**
 * Sound Control Component
 * Allows users to toggle sounds and adjust volume
 */

"use client";

import React, { useState, useEffect } from "react";
import { soundManager } from "@/lib/sound-manager";

interface SoundControlProps {
  className?: string;
  variant?: "panel" | "compact"; // compact: inline toggle without dropdown panel
}

export const SoundControl: React.FC<SoundControlProps> = ({
  className = "",
  variant = "panel",
}) => {
  const [isEnabled, setIsEnabled] = useState(true);
  const [volume, setVolume] = useState(0.5);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Initialize state from sound manager
    setIsEnabled(soundManager.isEnabled());
    setVolume(soundManager.getVolume());
  }, []);

  const toggleSound = () => {
    const newEnabled = !isEnabled;
    setIsEnabled(newEnabled);
    soundManager.setEnabled(newEnabled);

    // Play a test sound when enabling
    if (newEnabled) {
      soundManager.play("move");
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    soundManager.setVolume(newVolume);

    // Play a test sound to hear the volume
    soundManager.play("move");
  };

  const testSound = (soundType: string) => {
    soundManager.play(
      soundType as
        | "move"
        | "capture"
        | "check"
        | "checkmate"
        | "castle"
        | "promotion"
        | "game-start"
        | "game-end"
        | "illegal-move"
    );
  };

  if (variant === "compact") {
    // Inline compact toggle only (no dropdown panel)
    return (
      <button
        onClick={toggleSound}
        className={`flex items-center gap-2 text-white transition-colors hover:opacity-80 ${className}`}
        style={{ 
          backgroundColor: '#1B1B1B',
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: '16px',
          padding: '0.6em 1.2em',
          borderRadius: '8px'
        }}
        title={isEnabled ? "Sound On" : "Sound Off"}
      >
        <span className="text-lg">{isEnabled ? "🔊" : "🔇"}</span>
        <span>{isEnabled ? "Sound On" : "Sound Off"}</span>
      </button>
    );
  }

  // Default: dropdown panel variant
  return (
    <div className={`relative ${className}`}>
      {/* Sound Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
        title="Sound Settings"
      >
        <span className="text-lg">{isEnabled ? "🔊" : "🔇"}</span>
        <span className="hidden sm:inline text-sm">
          {isEnabled ? "Sound On" : "Sound Off"}
        </span>
      </button>

      {/* Sound Control Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg shadow-xl p-4 min-w-[280px] z-50">
          <h3 className="text-white font-semibold mb-4">Sound Settings</h3>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-300">Enable Sounds</span>
            <button
              onClick={toggleSound}
              className={`w-12 h-6 rounded-full transition-colors ${
                isEnabled ? "bg-violet-500" : "bg-gray-600"
              }`}
            >
              <div
                className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  isEnabled ? "translate-x-6" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {/* Volume Slider */}
          {isEnabled && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Volume</span>
                <span className="text-gray-400 text-sm">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
          )}

          {/* Sound Test Buttons */}
          {isEnabled && (
            <div className="border-t border-gray-600 pt-4">
              <h4 className="text-gray-300 text-sm font-medium mb-3">
                Test Sounds
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => testSound("move")}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Move
                </button>
                <button
                  onClick={() => testSound("capture")}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Capture
                </button>
                <button
                  onClick={() => testSound("check")}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Check
                </button>
                <button
                  onClick={() => testSound("castle")}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Castle
                </button>
                <button
                  onClick={() => testSound("promotion")}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Promotion
                </button>
                <button
                  onClick={() => testSound("checkmate")}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm transition-colors"
                >
                  Checkmate
                </button>
              </div>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="mt-4 w-full bg-gray-700 hover:bg-gray-600 text-white py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #8b5cf6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
};
