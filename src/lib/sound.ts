import { useSyncExternalStore } from "react";

export const SOUND_STORAGE_KEY = "ninepop:sound";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadSoundEnabled(
  storage: StorageLike | null = defaultStorage(),
): boolean {
  if (!storage) return true;
  try {
    const raw = storage.getItem(SOUND_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "0" && raw !== "false";
  } catch {
    return true;
  }
}

export function saveSoundEnabled(
  enabled: boolean,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SOUND_STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    // Ignore storage quota or privacy-mode errors.
  }
}

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

class SoundEngine {
  private enabled = loadSoundEnabled();
  private ctx: AudioContext | null = null;
  private listeners = new Set<() => void>();

  isEnabled = (): boolean => this.enabled;

  setEnabled = (next: boolean): void => {
    if (this.enabled === next) return;
    this.enabled = next;
    saveSoundEnabled(next);
    for (const listener of this.listeners) listener();
    if (next) this.playTap();
  };

  toggle = (): void => {
    this.setEnabled(!this.enabled);
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      if (!this.ctx) this.ctx = new Ctor();
      if (this.ctx.state === "suspended") {
        void this.ctx.resume().catch(() => {});
      }
      if (this.ctx.state !== "running") return null;
      return this.ctx;
    } catch {
      return null;
    }
  }

  private tone(
    freqStart: number,
    freqEnd: number,
    durationSec: number,
    volume: number,
    type: OscillatorType = "sine",
    delaySec = 0,
  ) {
    const ctx = this.context();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    if (freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, freqEnd),
        t0 + durationSec,
      );
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.01);
  }

  /** Soft tactile plastic key tap for navigation, notes, and toggles. */
  playTap = () => {
    this.tone(520, 340, 0.032, 0.045, "triangle");
  };

  /** Bright, snappy pocket-toy pop when you claim a cell. */
  playPop = () => {
    this.tone(540, 880, 0.075, 0.08, "sine");
    this.tone(880, 1180, 0.055, 0.04, "triangle", 0.03);
  };

  /** Subtle lower wooden tick when the opponent claims a cell. */
  playOpponentPop = () => {
    this.tone(360, 290, 0.055, 0.045, "triangle");
  };

  /** Muted low double-buzz on a wrong digit lockout. */
  playWrong = () => {
    this.tone(185, 140, 0.085, 0.08, "sawtooth", 0);
    this.tone(155, 115, 0.11, 0.075, "sawtooth", 0.075);
  };

  /** Soft muffled thud when opponent claimed the cell first. */
  playTaken = () => {
    this.tone(240, 180, 0.07, 0.055, "triangle");
  };

  /** Countdown pips: 3/2/1 low wooden pip, 0 = GO bright chime. */
  playCountdown = (step: number) => {
    if (step <= 0) {
      this.tone(784, 1046, 0.14, 0.08, "triangle");
    } else {
      this.tone(440, 440, 0.065, 0.055, "sine");
    }
  };

  /** Happy 4-note pocket-toy victory arpeggio. */
  playWin = () => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, n * 1.01, 0.16, 0.075, "triangle", idx * 0.075);
    });
  };

  /** Gentle descending two-note sigh on a loss or draw. */
  playLose = () => {
    this.tone(392, 349.23, 0.14, 0.055, "triangle", 0);
    this.tone(329.63, 261.63, 0.22, 0.05, "triangle", 0.12);
  };
}

export const sound = new SoundEngine();

export function useSound() {
  const enabled = useSyncExternalStore(
    sound.subscribe,
    sound.isEnabled,
    () => true,
  );
  return { enabled, toggle: sound.toggle, setEnabled: sound.setEnabled };
}
