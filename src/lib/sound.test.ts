import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadSoundEnabled,
  saveSoundEnabled,
  sound,
  SOUND_STORAGE_KEY,
} from "./sound";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

describe("sound helpers", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    sound.setEnabled(true);
  });

  it("defaults to enabled when storage is empty or unavailable", () => {
    expect(loadSoundEnabled(null)).toBe(true);
    expect(loadSoundEnabled(memoryStorage())).toBe(true);
  });

  it("persists enabled and muted state in storage", () => {
    const store = memoryStorage();
    saveSoundEnabled(false, store);
    expect(store.getItem(SOUND_STORAGE_KEY)).toBe("0");
    expect(loadSoundEnabled(store)).toBe(false);

    saveSoundEnabled(true, store);
    expect(store.getItem(SOUND_STORAGE_KEY)).toBe("1");
    expect(loadSoundEnabled(store)).toBe(true);
  });

  it("safely no-ops playback when AudioContext is unavailable", () => {
    expect(() => {
      sound.playTap();
      sound.playPop();
      sound.playOpponentPop();
      sound.playWrong();
      sound.playTaken();
      sound.playCountdown(3);
      sound.playCountdown(0);
      sound.playWin();
      sound.playLose();
    }).not.toThrow();
  });

  it("resumes a suspended AudioContext, disconnects finished nodes, and suspends when idle or muted", async () => {
    vi.useFakeTimers();

    const oscDisconnect = vi.fn();
    const gainDisconnect = vi.fn();
    const oscStart = vi.fn();
    const endedCallbacks: Array<() => void> = [];
    const suspend = vi.fn(async () => {
      mockCtx.state = "suspended";
    });
    const resume = vi.fn(async () => {
      mockCtx.state = "running";
    });

    const mockCtx = {
      state: "suspended" as AudioContextState,
      currentTime: 0,
      destination: {},
      resume,
      suspend,
      createOscillator: vi.fn(() => ({
        type: "sine",
        frequency: {
          setValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: oscDisconnect,
        start: oscStart,
        stop: vi.fn(),
        set onended(fn: (() => void) | null) {
          if (fn) endedCallbacks.push(fn);
        },
      })),
      createGain: vi.fn(() => ({
        gain: {
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: gainDisconnect,
      })),
    };

    vi.stubGlobal("window", {
      AudioContext: vi.fn(function MockAudioContext() {
        return mockCtx;
      }),
    });

    sound.playTap();
    expect(resume).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(oscStart).toHaveBeenCalledTimes(1);

    // Finish voice -> disconnects both nodes
    expect(endedCallbacks).toHaveLength(1);
    endedCallbacks[0]();
    expect(oscDisconnect).toHaveBeenCalledTimes(1);
    expect(gainDisconnect).toHaveBeenCalledTimes(1);

    // Idle suspend releases Chrome's audio thread after 1.5s
    vi.advanceTimersByTime(1_600);
    expect(suspend).toHaveBeenCalledTimes(1);
  });
});
