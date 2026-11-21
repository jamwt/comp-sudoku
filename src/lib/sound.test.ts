import { describe, expect, it } from "vitest";
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
});
