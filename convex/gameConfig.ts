/**
 * Every tunable game rule lives here. Game logic reads these values and never
 * hard-codes them, so rules can be retuned without touching the engine.
 */
export const TIERS = ["easy", "medium", "hard"] as const;
export type Tier = (typeof TIERS)[number];

export const RULES = {
  /** How long a player's input is locked after a wrong digit. */
  wrongEntryLockoutMs: 3_000,
  /** Points deducted for a wrong digit (0 disables the point penalty). */
  wrongEntryPointPenalty: 0,
  /** A player who makes no entry or note for this long forfeits. */
  idleForfeitMs: 30_000,
  /** A player whose presence is offline for this long forfeits. */
  disconnectForfeitMs: 30_000,
  /** Client presence heartbeat; a silent client goes offline after 2.5 beats. */
  presenceHeartbeatMs: 5_000,
  /** Delay between the second player joining and the board unlocking. */
  countdownMs: 3_000,
  /** Difficulty tier a new match uses unless the creator picks another. */
  defaultTier: "easy" as Tier,
  /** Per-player token bucket on digit entries. */
  entryRateLimit: { rate: 10, periodMs: 1_000, capacity: 15 },
  /** Per-player token bucket on note edits. */
  noteRateLimit: { rate: 20, periodMs: 1_000, capacity: 30 },
  /** Per-player token bucket on match creation. */
  createMatchRateLimit: { rate: 10, periodMs: 60_000, capacity: 5 },
  puzzlePool: {
    /** Available puzzles to keep on hand per difficulty tier. */
    targetPerTier: { easy: 40, medium: 25, hard: 10 },
    /** Max generator attempts in one background action. */
    maxAttemptsPerRun: 600,
    /** Wall-clock budget for one background action. */
    maxRunMs: 60_000,
    /** How often the cron tops up the pool. */
    topUpIntervalMinutes: 10,
  },
};

export type Rules = typeof RULES;
