import type { Technique } from "./lib/sudoku/grader";

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
  idleForfeitMs: 180_000,
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

/** Techniques a bot can know; they map one-to-one onto the grader's. */
export type BotTechnique = Exclude<Technique, "unsolved">;

export type BotSkill = {
  /** Techniques this bot can use to deduce its next cell. */
  techniques: readonly BotTechnique[];
  /** Multiplier on every technique's think time; lower is faster. */
  thinkScale: number;
  /** Chance that a deduced move is entered with a wrong digit instead. */
  errorRate: number;
  /** How long the bot stares at a board it can't deduce before guessing. */
  guessAfterMs: number;
};

const SINGLES: BotTechnique[] = ["hiddenSingle", "nakedSingle"];
const INTERSECTIONS: BotTechnique[] = ["pointing", "boxLineReduction"];
const PAIRS: BotTechnique[] = ["nakedPair", "hiddenPair"];
const TRIPLES: BotTechnique[] = ["nakedTriple", "hiddenTriple"];

/**
 * Bot roster. `bots:seed` upserts one player row per entry, keyed by `key`;
 * `rating` is only the starting rating. Skill is read from here at move time,
 * so retuning a bot needs no data migration.
 */
export const BOTS = [
  {
    key: "pip",
    name: "Pip",
    level: "Beginner",
    rating: 800,
    skill: {
      techniques: ["hiddenSingle"],
      thinkScale: 4.0,
      errorRate: 0.08,
      guessAfterMs: 25_000,
    },
  },
  {
    key: "tilly",
    name: "Tilly",
    level: "Novice",
    rating: 1050,
    skill: {
      techniques: SINGLES,
      thinkScale: 2.1,
      errorRate: 0.06,
      guessAfterMs: 20_000,
    },
  },
  {
    key: "marlow",
    name: "Marlow",
    level: "Intermediate",
    rating: 1300,
    skill: {
      techniques: [...SINGLES, ...INTERSECTIONS],
      thinkScale: 1.45,
      errorRate: 0.045,
      guessAfterMs: 16_000,
    },
  },
  {
    key: "juniper",
    name: "Juniper",
    level: "Advanced",
    rating: 1550,
    skill: {
      techniques: [...SINGLES, ...INTERSECTIONS, ...PAIRS],
      thinkScale: 1.0,
      errorRate: 0.03,
      guessAfterMs: 13_000,
    },
  },
  {
    key: "vega",
    name: "Vega",
    level: "Expert",
    rating: 1800,
    skill: {
      techniques: [...SINGLES, ...INTERSECTIONS, ...PAIRS, ...TRIPLES],
      thinkScale: 0.7,
      errorRate: 0.02,
      guessAfterMs: 10_000,
    },
  },
  {
    key: "ada",
    name: "Ada",
    level: "Master",
    rating: 2000,
    skill: {
      techniques: [...SINGLES, ...INTERSECTIONS, ...PAIRS, ...TRIPLES, "xWing"],
      thinkScale: 0.5,
      errorRate: 0.01,
      guessAfterMs: 8_000,
    },
  },
] as const satisfies readonly {
  key: string;
  name: string;
  level: string;
  rating: number;
  skill: BotSkill;
}[];

export type BotProfile = (typeof BOTS)[number];

/** How bots pace themselves; per-bot skill scales these. */
export const BOT_RULES = {
  /**
   * Think time per technique at thinkScale 1: a log-normal distribution with
   * this median and spread. A move's think time comes from the hardest
   * technique its deduction needed.
   */
  thinkByTechnique: {
    hiddenSingle: { medianMs: 2_400, sigma: 0.45 },
    nakedSingle: { medianMs: 3_600, sigma: 0.5 },
    pointing: { medianMs: 7_000, sigma: 0.5 },
    boxLineReduction: { medianMs: 7_500, sigma: 0.5 },
    nakedPair: { medianMs: 9_000, sigma: 0.5 },
    hiddenPair: { medianMs: 11_000, sigma: 0.5 },
    nakedTriple: { medianMs: 15_000, sigma: 0.55 },
    hiddenTriple: { medianMs: 17_000, sigma: 0.55 },
    xWing: { medianMs: 20_000, sigma: 0.55 },
  } satisfies Record<BotTechnique, { medianMs: number; sigma: number }>,
  /** Floor on any think time. */
  minThinkMs: 500,
  /** Cap on a think time, as a multiple of its median. */
  maxThinkFactor: 4,
  /** Spread of the wait before a guess, around the bot's guessAfterMs. */
  guessSigma: 0.25,
  /**
   * Spread of a bot's form for one match: its thinkScale is multiplied by a
   * log-normal draw with median 1, so neighbours on the ladder sometimes
   * beat each other, roughly as their Elo gap predicts.
   */
  formSigma: 0.25,
};

/** Elo ratings for rated (queue) matches. */
export const RATING = {
  /** Rating of a player who has never finished a rated match. */
  initial: 1200,
  /** Rated games played with the provisional K before switching to the established K. */
  provisionalGames: 20,
  kProvisional: 40,
  kEstablished: 20,
  /** Score for a drawn match (win = 1, loss = 0). */
  drawScore: 0.5,
  /** Most rows the leaderboard query returns. */
  leaderboardMax: 100,
};

/** The ranked matchmaking queue. */
export const MATCHMAKING = {
  /** Difficulty tier ranked matches use. */
  tier: "easy" as Tier,
  /** Rating window (±) for a player who just joined. */
  windowStart: 100,
  /** Widest rating window (±), reached after `windowWidenMs` in the queue. */
  windowMax: 400,
  /** Wait time over which the window grows linearly from start to max. */
  windowWidenMs: 30_000,
  /** Wait time after which a player with no human match may be paired with a bot. */
  botFallbackAfterMs: 20_000,
  /** How often the pairing pass reruns while anyone is waiting. */
  sweepIntervalMs: 2_000,
  /** A queued player whose presence is offline this long is removed from the queue. */
  disconnectGraceMs: 10_000,
  /**
   * Queue presence heartbeat. Unlike in a match, a hidden tab keeps beating, so
   * this is long enough to survive background-tab timer throttling.
   */
  presenceHeartbeatMs: 15_000,
  /** Most waiting players one pairing pass considers. */
  maxPerPass: 200,
  /** Per-player token bucket on queue joins. */
  joinRateLimit: { rate: 6, periodMs: 60_000, capacity: 6 },
};
