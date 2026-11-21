import { describe, expect, it } from "vitest";
import {
  BOT_AVATAR_KEYS,
  detectGuestAnimal,
  extractInitials,
  getHumanAvatarSpec,
  hashName,
  resolveBotKey,
} from "./avatars";

describe("avatars", () => {
  it("resolves all 6 AI bots regardless of casing or whitespace", () => {
    for (const key of BOT_AVATAR_KEYS) {
      expect(resolveBotKey(key)).toBe(key);
      expect(resolveBotKey(key.toUpperCase())).toBe(key);
      expect(resolveBotKey(`  ${key}  `)).toBe(key);
    }
    expect(resolveBotKey("Swift Otter")).toBeNull();
    expect(resolveBotKey("")).toBeNull();
  });

  it("detects guest animal names cleanly", () => {
    expect(detectGuestAnimal("Swift Otter")).toBe("otter");
    expect(detectGuestAnimal("Bold Falcon")).toBe("falcon");
    expect(detectGuestAnimal("Keen Gecko")).toBe("gecko");
    expect(detectGuestAnimal("Jamie")).toBeNull();
  });

  it("extracts crisp 1-2 character initials", () => {
    expect(extractInitials("Swift Otter")).toBe("SO");
    expect(extractInitials("Jamie")).toBe("JA");
    expect(extractInitials("  ")).toBe("?");
  });

  it("returns deterministic human specs across calls", () => {
    const a = getHumanAvatarSpec("Clever Fox");
    const b = getHumanAvatarSpec("clever fox");
    expect(a).toEqual(b);
    expect(a.animal).toBe("fox");
    expect(hashName("Clever Fox")).toBe(hashName("  CLEVER FOX "));
  });
});
