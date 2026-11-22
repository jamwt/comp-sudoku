import { RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";
import { MATCHMAKING, NICKNAME, RULES } from "./gameConfig";

const bucket = (r: { rate: number; periodMs: number; capacity: number }) => ({
  kind: "token bucket" as const,
  rate: r.rate,
  period: r.periodMs,
  capacity: r.capacity,
});

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  enterDigit: bucket(RULES.entryRateLimit),
  editNote: bucket(RULES.noteRateLimit),
  createMatch: bucket(RULES.createMatchRateLimit),
  joinQueue: bucket(MATCHMAKING.joinRateLimit),
  setNickname: bucket(NICKNAME.setRateLimit),
});
