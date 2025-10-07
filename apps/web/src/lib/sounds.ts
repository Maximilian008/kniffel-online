const STORAGE_KEY = "kniffel-sound-enabled";

export type SoundChangeListener = (enabled: boolean) => void;

// Simple sound effects for better UX
export class SoundManager {
  private audioContext: AudioContext | null = null;
  private isEnabled = true;
  private listeners = new Set<SoundChangeListener>();

  constructor() {
    const persisted = this.readPersistedState();
    if (persisted !== null) {
      this.isEnabled = persisted;
    }
  }

  private readPersistedState(): boolean | null {
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === null) return null;
      return stored === "true";
    } catch {
      return null;
    }
  }

  private persistEnabled() {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(this.isEnabled));
    } catch {
      // Ignore persistence errors (private mode, etc.)
    }
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.isEnabled);
    }
  }

  subscribe(listener: SoundChangeListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private ensureAudioContext() {
    if (typeof window === "undefined") return;
    if (this.audioContext) return;

    const ctor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!ctor) {
      console.warn("Web Audio API not supported; disabling sound effects.");
      this.setEnabled(false);
      return;
    }

    try {
      this.audioContext = new ctor();
    } catch (error) {
      console.warn("Failed to initialise AudioContext", error);
      this.setEnabled(false);
    }
  }

  private async resumeAudioContext() {
    if (!this.audioContext) return;
    if (this.audioContext.state === "suspended") {
      try {
        await this.audioContext.resume();
      } catch {
        // Ignore resume errors - most browsers simply block until user input
      }
    }
  }

  private withContext(action: (ctx: AudioContext) => void) {
    if (!this.isEnabled) return;
    this.ensureAudioContext();
    const context = this.audioContext;
    if (!context) return;

    void this.resumeAudioContext()
      .then(() => {
        const active = this.audioContext;
        if (!active || !this.isEnabled) return;
        action(active);
      })
      .catch(() => {
        // Ignore resume failures - keep silent rather than crashing
      });
  }

  setEnabled(enabled: boolean) {
    const next = Boolean(enabled);
    if (this.isEnabled === next) return this.isEnabled;
    this.isEnabled = next;
    if (this.isEnabled) {
      this.ensureAudioContext();
    }
    this.persistEnabled();
    this.notify();
    return this.isEnabled;
  }

  toggleSound() {
    return this.setEnabled(!this.isEnabled);
  }

  isAudioEnabled() {
    return this.isEnabled;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = "sine") {
    this.withContext((ctx) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration);
    });
  }

  // Sound effects
  diceRoll() {
    this.playTone(200, 0.1, "square");
    setTimeout(() => this.playTone(300, 0.1, "square"), 100);
    setTimeout(() => this.playTone(400, 0.15, "square"), 200);
  }

  diceHold() {
    this.playTone(600, 0.1, "triangle");
  }

  diceRelease() {
    this.playTone(400, 0.1, "triangle");
  }

  categorySelect() {
    this.playTone(800, 0.15, "sine");
    setTimeout(() => this.playTone(1000, 0.1, "sine"), 80);
  }

  gameWin() {
    const notes = [523, 659, 784]; // C, E, G
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.3, "sine"), index * 150);
    });
  }

  buttonClick() {
    this.playTone(500, 0.05, "square");
  }

  buttonHover() {
    if (!this.isEnabled) return;
    this.playTone(400, 0.02, "sine");
  }

  scoreEntry() {
    // Satisfying score entry sound - ascending notes
    this.playTone(600, 0.08, "sine");
    setTimeout(() => this.playTone(750, 0.08, "sine"), 60);
    setTimeout(() => this.playTone(900, 0.12, "sine"), 120);
  }

  scoreEntryBig() {
    // For high scores or special combinations
    const notes = [400, 500, 650, 800, 1000];
    notes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.1, "sine"), index * 40);
    });
  }

  satisfyingClick() {
    // Extra satisfying click for important actions
    this.playTone(800, 0.03, "sine");
    setTimeout(() => this.playTone(600, 0.05, "triangle"), 30);
  }

  errorSound() {
    this.playTone(200, 0.15, "sawtooth");
  }

  whooshSound() {
    this.withContext((ctx) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(100, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    });
  }

  kniffelSound() {
    // Special celebration sound for Kniffel (Yahtzee)
    const notes = [523, 659, 784, 1047, 1319]; // C, E, G, C, E (major chord progression)
    notes.forEach((note, index) => {
      setTimeout(() => {
        this.playTone(note, 0.4, "sine");
        setTimeout(() => this.playTone(note * 1.25, 0.3, "triangle"), 50);
      }, index * 200);
    });
  }

  levelUpSound() {
    // For reaching new scoring milestones
    const ascendingNotes = [261, 329, 392, 523, 659];
    ascendingNotes.forEach((note, index) => {
      setTimeout(() => this.playTone(note, 0.2, "sine"), index * 100);
    });
  }

  thudSound() {
    // For dice landing
    this.playTone(80, 0.1, "square");
  }
}

export const soundManager = new SoundManager();
