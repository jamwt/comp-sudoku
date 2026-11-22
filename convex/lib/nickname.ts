import { BOTS, NICKNAME } from "../gameConfig";

const RESERVED_NAMES = new Set<string>(
  BOTS.flatMap((b) => [b.key.toLowerCase(), b.name.toLowerCase()]),
);

export type NicknameValidation =
  | { ok: true; nickname: string }
  | { ok: false; error: string };

export function normalizeNickname(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isReservedNickname(normalized: string): boolean {
  return RESERVED_NAMES.has(normalized);
}

/**
 * Validates and normalizes an exclusive player handle:
 * lowercase alphanumeric starting with a letter (`^[a-z][a-z0-9]{4,19}$`),
 * excluding reserved AI bot names.
 */
export function validateNickname(raw: string): NicknameValidation {
  const nickname = normalizeNickname(raw);
  if (nickname.length < NICKNAME.minLength) {
    return {
      ok: false,
      error: `Nickname must be at least ${NICKNAME.minLength} characters.`,
    };
  }
  if (nickname.length > NICKNAME.maxLength) {
    return {
      ok: false,
      error: `Nickname must be at most ${NICKNAME.maxLength} characters.`,
    };
  }
  if (!/^[a-z]/.test(nickname)) {
    return {
      ok: false,
      error: "Nickname must start with a lowercase letter (a–z).",
    };
  }
  if (!/^[a-z][a-z0-9]*$/.test(nickname)) {
    return {
      ok: false,
      error: "Use only lowercase letters (a–z) and numbers (0–9).",
    };
  }
  if (isReservedNickname(nickname)) {
    return {
      ok: false,
      error: "That nickname is reserved. Please choose another.",
    };
  }
  return { ok: true, nickname };
}
