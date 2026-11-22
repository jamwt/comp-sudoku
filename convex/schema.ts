import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vTier = v.union(
  v.literal("easy"),
  v.literal("medium"),
  v.literal("hard"),
);

export const vEndReason = v.union(
  v.literal("board_full"),
  v.literal("clinch"),
  v.literal("resign"),
  v.literal("forfeit_idle"),
  v.literal("forfeit_disconnect"),
);

export const vMoveStrategy = v.union(
  v.literal("fullHouse"),
  v.literal("hiddenSingle"),
  v.literal("nakedSingle"),
  v.literal("pointing"),
  v.literal("boxLineReduction"),
  v.literal("nakedPair"),
  v.literal("hiddenPair"),
  v.literal("nakedTriple"),
  v.literal("hiddenTriple"),
  v.literal("xWing"),
  v.literal("deep"),
);

export const vMove = v.object({
  at: v.number(),
  slot: v.union(v.literal(0), v.literal(1)),
  cell: v.number(),
  strategy: vMoveStrategy,
});

export const vParticipant = v.object({
  playerId: v.id("players"),
  score: v.number(),
  cells: v.number(),
  wrong: v.number(),
  lockedUntil: v.number(),
  lastActiveAt: v.number(),
});

export default defineSchema({
  users: defineTable({}),

  players: defineTable({
    kind: v.union(v.literal("human"), v.literal("bot")),
    /** Set for humans; bots have no auth user. */
    userId: v.optional(v.id("users")),
    name: v.string(),
    /** Starting Elo rating for bots, from `BOTS` in gameConfig. */
    rating: v.optional(v.number()),
    /** Key into `BOTS` in gameConfig; set for bots only. */
    botProfile: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_kind_and_rating", ["kind", "rating"]),

  puzzles: defineTable({
    givens: v.string(),
    solution: v.string(),
    tier: vTier,
    hardest: v.string(),
    clueCount: v.number(),
    status: v.union(v.literal("available"), v.literal("used")),
  }).index("by_tier_and_status", ["tier", "status"]),

  matches: defineTable({
    status: v.union(
      v.literal("waiting"),
      v.literal("active"),
      v.literal("finished"),
    ),
    tier: vTier,
    puzzleId: v.id("puzzles"),
    givens: v.string(),
    board: v.string(),
    owners: v.string(),
    emptyCount: v.number(),
    participants: v.array(vParticipant),
    startsAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    result: v.optional(
      v.object({ winner: v.union(v.number(), v.null()), reason: vEndReason }),
    ),
    forfeitCheckId: v.optional(v.id("_scheduled_functions")),
    /** Queue matches are rated; invite-link matches leave this unset (casual). */
    rated: v.optional(v.boolean()),
    /** Claim history recorded in chronological order for post-match analytics. */
    moves: v.optional(v.array(vMove)),
  }),

  /** Live Elo per player. A player with no row has the initial rating and no games. */
  ratings: defineTable({
    playerId: v.id("players"),
    rating: v.number(),
    ratedGames: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_rating", ["rating"]),

  /** One row per player per rated match, for rating charts. */
  ratingHistory: defineTable({
    playerId: v.id("players"),
    matchId: v.id("matches"),
    opponentId: v.id("players"),
    ratingBefore: v.number(),
    ratingAfter: v.number(),
    delta: v.number(),
    k: v.number(),
    /** 1 win, 0 loss, 0.5 draw. */
    score: v.number(),
  })
    .index("by_playerId", ["playerId"])
    .index("by_matchId", ["matchId"]),

  /** The ranked queue: at most one row per player. */
  queue: defineTable({
    playerId: v.id("players"),
    status: v.union(
      v.literal("waiting"),
      v.literal("matched"),
      v.literal("dropped"),
    ),
    /** Rating when the player joined; pairing uses it. */
    rating: v.number(),
    joinedAt: v.number(),
    matchId: v.optional(v.id("matches")),
  })
    .index("by_playerId", ["playerId"])
    .index("by_status_and_joinedAt", ["status", "joinedAt"]),

  /** Singleton holding the pending pairing pass, so only one sweep chain runs. */
  queueSweep: defineTable({
    scheduledId: v.optional(v.id("_scheduled_functions")),
  }),

  /** One per bot per active match: what the bot plans to enter, and when. */
  botRuns: defineTable({
    matchId: v.id("matches"),
    playerId: v.id("players"),
    status: v.union(v.literal("thinking"), v.literal("stuck")),
    /** Bumped on every reschedule; a scheduled step with an older seq is stale. */
    seq: v.number(),
    plan: v.optional(
      v.object({
        cell: v.number(),
        digit: v.number(),
        dueAt: v.number(),
        intent: v.union(
          v.literal("deduce"),
          v.literal("blunder"),
          v.literal("guess"),
        ),
        technique: v.string(),
      }),
    ),
    /** This match's think-time multiplier for the bot; see BOT_RULES.formSigma. */
    form: v.number(),
    /** Guesses the server rejected, which the brain eliminates. */
    excluded: v.array(v.object({ cell: v.number(), digit: v.number() })),
    /** Most recent cell claimed by this bot, used for human follow-up momentum. */
    lastMove: v.optional(v.object({ cell: v.number(), digit: v.number() })),
  }).index("by_matchId_and_playerId", ["matchId", "playerId"]),

  notes: defineTable({
    matchId: v.id("matches"),
    playerId: v.id("players"),
    marks: v.array(v.number()),
  }).index("by_matchId_and_playerId", ["matchId", "playerId"]),
});
