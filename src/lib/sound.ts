import { useSyncExternalStore } from "react";

export const SOUND_STORAGE_KEY = "ninepop:sound";

const MAX_ACTIVE_VOICES = 12;
const IDLE_SUSPEND_MS = 1_500;

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
  private voices = new Set<{ osc: OscillatorNode; gain: GainNode }>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private visibilityBound = false;

  isEnabled = (): boolean => this.enabled;

  setEnabled = (next: boolean): void => {
    if (this.enabled === next) return;
    this.enabled = next;
    saveSoundEnabled(next);
    for (const listener of this.listeners) listener();
    if (next) {
      this.playTap();
    } else {
      this.haltAndSuspend();
    }
  };

  toggle = (): void => {
    this.setEnabled(!this.enabled);
  };

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private stopAllVoices(): void {
    for (const voice of this.voices) {
      try {
        voice.osc.onended = null;
        voice.osc.stop();
      } catch {
        // Ignore oscillators that already stopped.
      }
      try {
        voice.osc.disconnect();
        voice.gain.disconnect();
      } catch {
        // Ignore already-disconnected nodes.
      }
    }
    this.voices.clear();
  }

  private haltAndSuspend(): void {
    this.clearIdleTimer();
    this.stopAllVoices();
    if (this.ctx && this.ctx.state === "running") {
      void this.ctx.suspend().catch(() => {});
    }
  }

  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === "undefined") return;
    this.visibilityBound = true;
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.haltAndSuspend();
      }
    });
  }

  private clearIdleTimer(): void {
    if (this.idleTimer !== null) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private scheduleIdleSuspend(): void {
    this.clearIdleTimer();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (
        this.ctx &&
        this.ctx.state === "running" &&
        this.voices.size === 0
      ) {
        void this.ctx.suspend().catch(() => {});
      }
    }, IDLE_SUSPEND_MS);
  }

  private withContext(run: (ctx: AudioContext) => void): void {
    if (!this.enabled) return;
    if (typeof document !== "undefined" && document.hidden) return;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return;
    try {
      this.bindVisibility();
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new Ctor();
      }
      const ctx = this.ctx;
      if (ctx.state === "running") {
        run(ctx);
        this.scheduleIdleSuspend();
      } else if (ctx.state === "suspended") {
        void ctx
          .resume()
          .then(() => {
            if (!this.enabled || ctx.state !== "running") return;
            if (typeof document !== "undefined" && document.hidden) return;
            run(ctx);
            this.scheduleIdleSuspend();
          })
          .catch(() => {});
      }
    } catch {
      // Ignore AudioContext initialization failures.
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
    this.withContext((ctx) => {
      if (this.voices.size >= MAX_ACTIVE_VOICES) return;
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
      const voice = { osc, gain };
      this.voices.add(voice);
      osc.onended = () => {
        this.voices.delete(voice);
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // Ignore already-disconnected nodes.
        }
      };
      osc.start(t0);
      osc.stop(t0 + durationSec + 0.01);
    });
  }

  /** Soft tactile plastic key tap for navigation, notes, and toggles. */
  playTap = () => {
    this.tone(520, 340, 0.032, 0.09, "triangle");
  };

  /** Bright, snappy pocket-toy pop when you claim a cell. */
  playPop = () => {
    this.tone(540, 880, 0.075, 0.15, "sine");
    this.tone(880, 1180, 0.055, 0.08, "triangle", 0.03);
  };

  /** Subtle lower wooden tick when the opponent claims a cell. */
  playOpponentPop = () => {
    this.tone(360, 290, 0.055, 0.09, "triangle");
  };

  /** Muted low double-buzz on a wrong digit lockout. */
  playWrong = () => {
    this.tone(185, 140, 0.085, 0.14, "sawtooth", 0);
    this.tone(155, 115, 0.11, 0.13, "sawtooth", 0.075);
  };

  /** Soft muffled thud when opponent claimed the cell first. */
  playTaken = () => {
    this.tone(240, 180, 0.07, 0.11, "triangle");
  };

  /** Countdown pips: 3/2/1 low wooden pip, 0 = GO bright chime. */
  playCountdown = (step: number) => {
    if (step <= 0) {
      this.tone(784, 1046, 0.14, 0.15, "triangle");
    } else {
      this.tone(440, 440, 0.065, 0.1, "sine");
    }
  };

  /** Happy 4-note pocket-toy victory arpeggio. */
  playWin = () => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, n * 1.01, 0.16, 0.14, "triangle", idx * 0.075);
    });
  };

  /** Gentle descending two-note sigh on a loss or draw. */
  playLose = () => {
    this.tone(392, 349.23, 0.14, 0.11, "triangle", 0);
    this.tone(329.63, 261.63, 0.22, 0.1, "triangle", 0.12);
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
