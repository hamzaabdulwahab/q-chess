/**
 * Chess Sound Manager
 * Handles all chess game sound effects
 */

export type ChessSoundType =
  | "move"
  | "capture"
  | "check"
  | "checkmate"
  | "castle"
  | "promotion"
  | "game-start"
  | "game-end"
  | "illegal-move";

class ChessSoundManager {
  private sounds: Map<ChessSoundType, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private volume: number = 0.5;

  constructor() {
    console.log("🎵 Initializing ChessSoundManager");
    if (typeof window !== "undefined") {
      this.initializeSounds();
      this.loadUserPreferences();
      console.log(`🎵 Sound manager initialized - enabled: ${this.enabled}, volume: ${this.volume}`);
    }
  }

  private initializeSounds() {
    const soundFiles: Record<ChessSoundType, string> = {
      move: "/sounds/move.mp3",
      capture: "/sounds/capture.mp3",
      check: "/sounds/check.mp3",
      checkmate: "/sounds/checkmate.mp3",
      castle: "/sounds/castle.mp3",
      promotion: "/sounds/promotion.mp3",
      "game-start": "/sounds/game-start.mp3",
      "game-end": "/sounds/game-end.mp3",
      "illegal-move": "/sounds/illegal-move.mp3",
    };

    Object.entries(soundFiles).forEach(([soundType, filePath]) => {
      const audio = new Audio(filePath);
      audio.volume = this.volume;
      audio.preload = "auto";

      // Handle loading errors gracefully
      audio.addEventListener("error", () => {
        console.warn(`Failed to load sound: ${filePath}`);
      });

      this.sounds.set(soundType as ChessSoundType, audio);
    });
  }

  private loadUserPreferences() {
    try {
      const savedEnabled = localStorage.getItem("chess-sounds-enabled");
      const savedVolume = localStorage.getItem("chess-sounds-volume");

      if (savedEnabled !== null) {
        this.enabled = savedEnabled === "true";
      }

      if (savedVolume !== null) {
        this.volume = parseFloat(savedVolume);
        this.updateVolume(this.volume);
      }
    } catch (error) {
      console.warn("Failed to load sound preferences:", error);
    }
  }

  private saveUserPreferences() {
    try {
      localStorage.setItem("chess-sounds-enabled", this.enabled.toString());
      localStorage.setItem("chess-sounds-volume", this.volume.toString());
    } catch (error) {
      console.warn("Failed to save sound preferences:", error);
    }
  }

  /**
   * Play a specific chess sound
   */
  play(soundType: ChessSoundType) {
    console.log(`🔊 Attempting to play sound: ${soundType}, enabled: ${this.enabled}`);
    
    if (!this.enabled) {
      console.log(`🔇 Sound disabled, not playing: ${soundType}`);
      return;
    }

    const sound = this.sounds.get(soundType);
    if (sound) {
      try {
        // Reset the audio to the beginning in case it's already playing
        sound.currentTime = 0;
        sound.play().then(() => {
          console.log(`✅ Successfully playing sound: ${soundType}`);
        }).catch((error) => {
          console.warn(`❌ Failed to play sound ${soundType}:`, error);
        });
      } catch (error) {
        console.warn(`⚠️ Error playing sound ${soundType}:`, error);
      }
    } else {
      console.warn(`🚫 Sound not found: ${soundType}`);
    }
  }

  /**
   * Enable or disable all sounds
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    this.saveUserPreferences();
  }

  /**
   * Check if sounds are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set volume (0.0 to 1.0)
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.updateVolume(this.volume);
    this.saveUserPreferences();
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  private updateVolume(volume: number) {
    this.sounds.forEach((sound) => {
      sound.volume = volume;
    });
  }

  /**
   * Determine the appropriate sound for a chess move
   */
  getSoundForMove(moveData: {
    isCapture?: boolean;
    isCastle?: boolean;
    isPromotion?: boolean;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isIllegal?: boolean;
  }): ChessSoundType {
    if (moveData.isIllegal) return "illegal-move";
    if (moveData.isCheckmate) return "checkmate";
    if (moveData.isCheck) return "check";
    if (moveData.isPromotion) return "promotion";
    if (moveData.isCastle) return "castle";
    if (moveData.isCapture) return "capture";
    return "move";
  }

  /**
   * Play sound based on move characteristics
   */
  playMoveSound(moveData: {
    isCapture?: boolean;
    isCastle?: boolean;
    isPromotion?: boolean;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isIllegal?: boolean;
  }) {
    const soundType = this.getSoundForMove(moveData);
    this.play(soundType);
  }
}

// Create a singleton instance
export const soundManager = new ChessSoundManager();

// Export the class for testing or multiple instances if needed
export { ChessSoundManager };
