import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { RULES } from "./gameConfig";
import {
  applyEntry,
  checkForfeit,
  countEmpty,
  emptyOwners,
  resign as resignResult,
  type MatchResult,
  type Slot,
} from "./lib/engine";
import { currentPlayer, requirePlayer } from "./players";
import { drawPuzzle } from "./puzzles";
import { presence } from "./presence";
import { rateLimiter } from "./rateLimits";
import { vEndReason, vTier } from "./schema";

const vMatchView = v.object({
  _id: v.id("matches"),
  status: v.union(
    v.literal("waiting"),
    v.literal("active"),
    v.literal("finished"),
  ),
  tier: vTier,
  givens: v.string(),
  board: v.string(),
  owners: v.string(),
  emptyCount: v.number(),
  participants: v.array(
    v.object({
      playerId: v.id("players"),
      name: v.string(),
      score: v.number(),
      cells: v.number(),
      wrong: v.number(),
      lockedUntil: v.number(),
      lastActiveAt: v.number(),
    }),
  ),
  you: v.union(v.literal(0), v.literal(1), v.null()),
  startsAt: v.union(v.number(), v.null()),
  endedAt: v.union(v.number(), v.null()),
  result: v.union(
    v.null(),
    v.object({ winner: v.union(v.number(), v.null()), reason: vEndReason }),
  ),
});
export type MatchView = Infer<typeof vMatchView>;

const vEntryOutcome = v.union(
  v.object({
    kind: v.literal("claimed"),
    cell: v.number(),
    digit: v.number(),
    ended: v.boolean(),
  }),
  v.object({
    kind: v.literal("wrong"),
    cell: v.number(),
    digit: v.number(),
    lockedUntil: v.number(),
    lockoutMs: v.number(),
  }),
  v.object({
    kind: v.literal("locked"),
    lockedUntil: v.number(),
    lockoutMs: v.number(),
  }),
  v.object({ kind: v.literal("taken"), cell: v.number() }),
  v.object({ kind: v.literal("not_started"), startsAt: v.number() }),
  v.object({ kind: v.literal("not_active") }),
  v.object({ kind: v.literal("rate_limited"), retryAfter: v.number() }),
);
export type EntryResult = Infer<typeof vEntryOutcome>;

/** Public view of a match. The solution is never part of it. */
export const get = query({
  args: { matchId: v.string() },
  returns: v.union(v.null(), vMatchView),
  handler: async (ctx, args) => {
    const matchId = ctx.db.normalizeId("matches", args.matchId);
    const match = matchId && (await ctx.db.get("matches", matchId));
    if (!match) return null;
    const me = await currentPlayer(ctx);
    const participants = await Promise.all(
      match.participants.map(async (p) => {
        const player = await ctx.db.get("players", p.playerId);
        return { ...p, name: player?.name ?? "Unknown" };
      }),
    );
    const index = match.participants.findIndex((p) => p.playerId === me?._id);
    const slot: Slot | null = index === 0 || index === 1 ? index : null;
    return {
      _id: match._id,
      status: match.status,
      tier: match.tier,
      givens: match.givens,
      board: match.board,
      owners: match.owners,
      emptyCount: match.emptyCount,
      participants,
      you: slot,
      startsAt: match.startsAt ?? null,
      endedAt: match.endedAt ?? null,
      result: match.result ?? null,
    };
  },
});

/**
 * Create a match from the puzzle pool and wait for an opponent. Returns null
 * when the tier's pool is empty; returning instead of throwing lets the refill
 * job `drawPuzzle` scheduled commit.
 */
export const create = mutation({
  args: { tier: v.optional(vTier) },
  returns: v.union(v.id("matches"), v.null()),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    await rateLimiter.limit(ctx, "createMatch", {
      key: player._id,
      throws: true,
    });
    const tier = args.tier ?? RULES.defaultTier;
    const puzzle = await drawPuzzle(ctx, tier);
    if (puzzle === null) return null;
    const now = Date.now();
    return await ctx.db.insert("matches", {
      status: "waiting",
      tier,
      puzzleId: puzzle._id,
      givens: puzzle.givens,
      board: puzzle.givens,
      owners: emptyOwners(),
      emptyCount: countEmpty(puzzle.givens),
      participants: [newParticipant(player._id, now)],
    });
  },
});

function newParticipant(playerId: Id<"players">, now: number) {
  return {
    playerId,
    score: 0,
    cells: 0,
    wrong: 0,
    lockedUntil: 0,
    lastActiveAt: now,
  };
}

/** Take the second slot of a waiting match; the board unlocks after a countdown. */
export const join = mutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const player = await requirePlayer(ctx);
    const match = await ctx.db.get("matches", matchId);
    if (!match) throw new ConvexError("Match not found");
    if (match.participants.some((p) => p.playerId === player._id)) return null;
    if (match.status !== "waiting" || match.participants.length >= 2) {
      throw new ConvexError("This match already has two players");
    }
    const startsAt = Date.now() + RULES.countdownMs;
    const participants = [
      ...match.participants,
      newParticipant(player._id, startsAt),
    ].map((p) => ({ ...p, lastActiveAt: startsAt }));
    const forfeitCheckId = await ctx.scheduler.runAt(
      startsAt + Math.min(RULES.idleForfeitMs, RULES.disconnectForfeitMs),
      internal.matches.checkForfeits,
      { matchId },
    );
    await ctx.db.patch("matches", matchId, {
      status: "active",
      participants,
      startsAt,
      forfeitCheckId,
    });
    return null;
  },
});

async function loadActive(ctx: MutationCtx, matchId: Id<"matches">) {
  const player = await requirePlayer(ctx);
  const match = await ctx.db.get("matches", matchId);
  if (!match) throw new ConvexError("Match not found");
  const index = match.participants.findIndex((p) => p.playerId === player._id);
  if (index === -1) throw new ConvexError("You are not playing in this match");
  return { player, match, slot: index as Slot };
}

async function finish(
  ctx: MutationCtx,
  match: Doc<"matches">,
  result: MatchResult,
) {
  if (match.forfeitCheckId) {
    const scheduled = await ctx.db.system.get(
      "_scheduled_functions",
      match.forfeitCheckId,
    );
    if (scheduled?.state.kind === "pending")
      await ctx.scheduler.cancel(match.forfeitCheckId);
  }
  await ctx.db.patch("matches", match._id, {
    status: "finished",
    endedAt: Date.now(),
    result,
    forfeitCheckId: undefined,
  });
}

/** Enter a digit. A correct digit in an empty cell claims it; the first commit wins. */
export const enter = mutation({
  args: { matchId: v.id("matches"), cell: v.number(), digit: v.number() },
  returns: vEntryOutcome,
  handler: async (ctx, { matchId, cell, digit }): Promise<EntryResult> => {
    const { player, match, slot } = await loadActive(ctx, matchId);
    if (match.status !== "active") return { kind: "not_active" };
    const limit = await rateLimiter.limit(ctx, "enterDigit", {
      key: player._id,
    });
    if (!limit.ok)
      return { kind: "rate_limited", retryAfter: limit.retryAfter };
    const puzzle = await ctx.db.get("puzzles", match.puzzleId);
    if (!puzzle) throw new Error(`Puzzle ${match.puzzleId} missing`);
    const now = Date.now();
    const { outcome, next } = applyEntry(
      match,
      puzzle.solution,
      slot,
      cell,
      digit,
      now,
      match.startsAt ?? now,
      RULES,
    );
    if (next !== match) {
      await ctx.db.patch("matches", matchId, {
        board: next.board,
        owners: next.owners,
        participants: match.participants.map((p, i) => ({
          ...next.participants[i],
          playerId: p.playerId,
        })),
      });
    }
    switch (outcome.kind) {
      case "claimed":
        if (outcome.result) await finish(ctx, match, outcome.result);
        return { kind: "claimed", cell, digit, ended: outcome.result !== null };
      case "wrong":
      case "locked":
        return {
          ...outcome,
          lockoutMs: outcome.lockedUntil - now,
        };
      default:
        return outcome;
    }
  },
});

/** Resign an active match. It counts as a loss. */
export const resign = mutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const { match, slot } = await loadActive(ctx, matchId);
    if (match.status !== "active")
      throw new ConvexError("The match is not in progress");
    await finish(ctx, match, resignResult(slot));
    return null;
  },
});

/** Forfeit a player who has been idle or offline too long, else check again later. */
export const checkForfeits = internalMutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get("matches", matchId);
    if (!match || match.status !== "active") return null;
    const room = await presence.listRoom(ctx, matchId);
    const presenceInfo = match.participants.map((p) => {
      const entry = room.find((r) => r.userId === p.playerId);
      return entry
        ? {
            online: entry.online,
            lastDisconnected: entry.lastDisconnected || null,
          }
        : { online: false, lastDisconnected: null };
    });
    const now = Date.now();
    const { result, nextCheckAt } = checkForfeit(
      match,
      presenceInfo,
      match.startsAt ?? now,
      now,
      RULES,
    );
    if (result) {
      await finish(ctx, { ...match, forfeitCheckId: undefined }, result);
      return null;
    }
    const forfeitCheckId = await ctx.scheduler.runAt(
      Math.max(nextCheckAt, now + 250),
      internal.matches.checkForfeits,
      { matchId },
    );
    await ctx.db.patch("matches", matchId, { forfeitCheckId });
    return null;
  },
});
