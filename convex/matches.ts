import { ConvexError, v, type Infer } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { RULES, type Tier } from "./gameConfig";
import {
  applyEntry,
  checkForfeit,
  countEmpty,
  emptyOwners,
  resign as resignResult,
  type MatchResult,
  type Slot,
} from "./lib/engine";
import { botProfile, wakeBots } from "./botRuns";
import { pruneMatchNotes } from "./notes";
import { currentPlayer, requirePlayer } from "./players";
import { drawPuzzle } from "./puzzles";
import { presence } from "./presence";
import { applyRatedResult, ratingChangesFor } from "./ratings";
import { rateLimiter } from "./rateLimits";
import { classifyPlacement, parseGrid } from "./lib/sudoku";
import { vEndReason, vMove, vTier } from "./schema";

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
      bot: v.union(
        v.null(),
        v.object({ level: v.string(), rating: v.number() }),
      ),
    }),
  ),
  you: v.union(v.literal(0), v.literal(1), v.null()),
  startsAt: v.union(v.number(), v.null()),
  endedAt: v.union(v.number(), v.null()),
  result: v.union(
    v.null(),
    v.object({ winner: v.union(v.number(), v.null()), reason: vEndReason }),
  ),
  rated: v.boolean(),
  /** Each player's rating change once a rated match ends; empty otherwise. */
  ratingChanges: v.array(
    v.object({
      playerId: v.id("players"),
      before: v.number(),
      after: v.number(),
      delta: v.number(),
    }),
  ),
  /** Chronological cell claims with deduction strategy; populated once finished. */
  moves: v.array(vMove),
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
        const profile = player && botProfile(player);
        return {
          ...p,
          name: player?.name ?? "Unknown",
          bot: profile
            ? { level: profile.level, rating: player.rating ?? profile.rating }
            : null,
        };
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
      rated: match.rated ?? false,
      ratingChanges:
        match.status === "finished" && match.rated
          ? await ratingChangesFor(ctx, match._id)
          : [],
      moves: match.status === "finished" ? (match.moves ?? []) : [],
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

export function newParticipant(playerId: Id<"players">, now: number) {
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
    const forfeitCheckId = await scheduleFirstForfeitCheck(
      ctx,
      matchId,
      startsAt,
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

function scheduleFirstForfeitCheck(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  startsAt: number,
) {
  return ctx.scheduler.runAt(
    startsAt + Math.min(RULES.idleForfeitMs, RULES.disconnectForfeitMs),
    internal.matches.checkForfeits,
    { matchId },
  );
}

/**
 * Create a match that is already active, for players paired by the queue.
 * The board unlocks after the usual countdown. Returns null when the tier's
 * pool is empty (a refill is scheduled).
 */
export async function createActiveMatch(
  ctx: MutationCtx,
  args: {
    tier: Tier;
    playerIds: [Id<"players">, Id<"players">];
    rated: boolean;
  },
): Promise<Id<"matches"> | null> {
  const puzzle = await drawPuzzle(ctx, args.tier);
  if (puzzle === null) return null;
  const startsAt = Date.now() + RULES.countdownMs;
  const matchId = await ctx.db.insert("matches", {
    status: "active",
    tier: args.tier,
    puzzleId: puzzle._id,
    givens: puzzle.givens,
    board: puzzle.givens,
    owners: emptyOwners(),
    emptyCount: countEmpty(puzzle.givens),
    participants: args.playerIds.map((id) => newParticipant(id, startsAt)),
    startsAt,
    rated: args.rated,
  });
  const forfeitCheckId = await scheduleFirstForfeitCheck(
    ctx,
    matchId,
    startsAt,
  );
  await ctx.db.patch("matches", matchId, { forfeitCheckId });
  return matchId;
}

async function loadActive(ctx: MutationCtx, matchId: Id<"matches">) {
  const player = await requirePlayer(ctx);
  const match = await ctx.db.get("matches", matchId);
  if (!match) throw new ConvexError("Match not found");
  const index = match.participants.findIndex((p) => p.playerId === player._id);
  if (index === -1) throw new ConvexError("You are not playing in this match");
  return { player, match, slot: index as Slot };
}

export async function finish(
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
  if (match.rated) await applyRatedResult(ctx, match, result);
}

/** Enter a digit. A correct digit in an empty cell claims it; the first commit wins. */
export const enter = mutation({
  args: { matchId: v.id("matches"), cell: v.number(), digit: v.number() },
  returns: vEntryOutcome,
  handler: async (ctx, { matchId, cell, digit }): Promise<EntryResult> => {
    const { match, slot } = await loadActive(ctx, matchId);
    return await submitEntry(ctx, match, slot, cell, digit);
  },
});

/**
 * The one server path for a digit entry, used by humans and bots alike:
 * rate limit, engine validation against the stored solution, lockout, and
 * the claim race. A claim wakes any bot in the match that needs to replan.
 * A bot plays many matches at once, so its entries are limited per match.
 */
export async function submitEntry(
  ctx: MutationCtx,
  match: Doc<"matches">,
  slot: Slot,
  cell: number,
  digit: number,
): Promise<EntryResult> {
  if (match.status !== "active") return { kind: "not_active" };
  const playerId = match.participants[slot].playerId;
  const player = await ctx.db.get("players", playerId);
  const key = player?.kind === "bot" ? `${playerId}:${match._id}` : playerId;
  const limit = await rateLimiter.limit(ctx, "enterDigit", { key });
  if (!limit.ok) return { kind: "rate_limited", retryAfter: limit.retryAfter };
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
    const patch: Partial<Doc<"matches">> = {
      board: next.board,
      owners: next.owners,
      participants: match.participants.map((p, i) => ({
        ...next.participants[i],
        playerId: p.playerId,
      })),
    };
    if (outcome.kind === "claimed") {
      const strategy = classifyPlacement(parseGrid(match.board), cell, digit);
      patch.moves = [...(match.moves ?? []), { at: now, slot, cell, strategy }];
    }
    await ctx.db.patch("matches", match._id, patch);
  }
  switch (outcome.kind) {
    case "claimed":
      await pruneMatchNotes(ctx, match._id, cell, digit);
      if (outcome.result) await finish(ctx, match, outcome.result);
      else await wakeBots(ctx, match._id, playerId, cell);
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
}

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
    const players = await Promise.all(
      match.participants.map((p) => ctx.db.get("players", p.playerId)),
    );
    const presenceInfo = match.participants.map((p, i) => {
      if (players[i]?.kind === "bot")
        return { online: true, lastDisconnected: null, exempt: true };
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
    if (nextCheckAt === Infinity) {
      await ctx.db.patch("matches", matchId, { forfeitCheckId: undefined });
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
