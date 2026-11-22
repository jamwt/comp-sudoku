import { describe, expect, test } from "vitest";
import {
  isReservedNickname,
  normalizeNickname,
  validateNickname,
} from "./nickname";

describe("nickname validation", () => {
  test("normalizes whitespace and uppercase", () => {
    expect(normalizeNickname("  Jamie42  ")).toBe("jamie42");
  });

  test("accepts valid 5-20 char handles starting with a letter", () => {
    expect(validateNickname("abcde")).toEqual({ ok: true, nickname: "abcde" });
    expect(validateNickname("Jamie99")).toEqual({
      ok: true,
      nickname: "jamie99",
    });
    expect(validateNickname("a1234567890123456789")).toEqual({
      ok: true,
      nickname: "a1234567890123456789",
    });
  });

  test("rejects handles outside length bounds", () => {
    expect(validateNickname("abcd")).toMatchObject({ ok: false });
    expect(validateNickname("a".repeat(21))).toMatchObject({ ok: false });
  });

  test("rejects handles that do not start with a letter or contain non-alphanumerics", () => {
    expect(validateNickname("1jamie")).toMatchObject({ ok: false });
    expect(validateNickname("jamie_42")).toMatchObject({ ok: false });
    expect(validateNickname("jamie-42")).toMatchObject({ ok: false });
    expect(validateNickname("jamie 42")).toMatchObject({ ok: false });
  });

  test("reserves AI bot names", () => {
    expect(isReservedNickname("marlow")).toBe(true);
    expect(isReservedNickname("juniper")).toBe(true);
    expect(isReservedNickname("tilly")).toBe(true);
    expect(validateNickname("Marlow")).toMatchObject({
      ok: false,
      error: expect.stringMatching(/reserved/i),
    });
  });
});
