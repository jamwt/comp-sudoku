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
    kind: v.literal("human"),
    userId: v.id("users"),
    name: v.string(),
  }).index("by_userId", ["userId"]),

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
  }),

  notes: defineTable({
    matchId: v.id("matches"),
    playerId: v.id("players"),
    marks: v.array(v.number()),
  }).index("by_matchId_and_playerId", ["matchId", "playerId"]),
});
