import { v } from "convex/values";
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { RATING } from "./gameConfig";
import { rateMatch } from "./lib/elo";
import type { MatchResult } from "./lib/engine";
import { currentPlayer } from "./players";

/** Every rated player, sorted by rating, for rank and percentile lookups. */
export const ratingAggregate = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "ratings";
}>(components.ratingAggregate, { sortKey: (doc) => doc.rating });

async function ratingRow(ctx: QueryCtx, playerId: Id<"players">) {
  return await ctx.db
    .query("ratings")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .unique();
}

/**
 * A player's live rating and rated-game count. Before their first rated match
 * a bot starts at its seed rating and a human at `RATING.initial`.
 */
export async function getRating(ctx: QueryCtx, playerId: Id<"players">) {
  const [row, player] = await Promise.all([
    ratingRow(ctx, playerId),
    ctx.db.get("players", playerId),
  ]);
  return {
    rating: row?.rating ?? player?.rating ?? RATING.initial,
    ratedGames: row?.ratedGames ?? 0,
  };
}

/**
 * Apply Elo to both participants of a finished rated match, in the caller's
 * transaction. Writes the live ratings, the aggregate, and one history row
 * per player. A match that already has history is left alone.
 */
export async function applyRatedResult(
  ctx: MutationCtx,
  match: Doc<"matches">,
  result: MatchResult,
) {
  const already = await ctx.db
    .query("ratingHistory")
    .withIndex("by_matchId", (q) => q.eq("matchId", match._id))
    .first();
  if (already) return;
  const ids = match.participants.map((p) => p.playerId);
  const rows = await Promise.all(ids.map((id) => ratingRow(ctx, id)));
  const current = await Promise.all(ids.map((id) => getRating(ctx, id)));
  const changes = rateMatch(current[0], current[1], result.winner, RATING);
  for (let i = 0; i < 2; i++) {
    const row = rows[i];
    const change = changes[i];
    const fields = {
      rating: change.after,
      ratedGames: current[i].ratedGames + 1,
    };
    if (row) {
      await ctx.db.patch("ratings", row._id, fields);
      await ratingAggregate.replace(ctx, row, { ...row, ...fields });
    } else {
      const id = await ctx.db.insert("ratings", {
        playerId: ids[i],
        ...fields,
      });
      await ratingAggregate.insert(ctx, (await ctx.db.get("ratings", id))!);
    }
    await ctx.db.insert("ratingHistory", {
      playerId: ids[i],
      matchId: match._id,
      opponentId: ids[1 - i],
      ratingBefore: change.before,
      ratingAfter: change.after,
      delta: change.delta,
      k: change.k,
      score: change.score,
    });
  }
}

/** Rating changes recorded for a match: empty for casual or unfinished matches. */
export async function ratingChangesFor(ctx: QueryCtx, matchId: Id<"matches">) {
  const rows = await ctx.db
    .query("ratingHistory")
    .withIndex("by_matchId", (q) => q.eq("matchId", matchId))
    .take(2);
  return rows.map((r) => ({
    playerId: r.playerId,
    before: r.ratingBefore,
    after: r.ratingAfter,
    delta: r.delta,
  }));
}

const vMyRating = v.object({
  playerId: v.id("players"),
  name: v.string(),
  rating: v.number(),
  ratedGames: v.number(),
  /** Competition rank (1 + players rated strictly higher); null until the first rated match. */
  rank: v.union(v.number(), v.null()),
  /** Percent of rated players rated strictly lower; null while unranked. */
  percentile: v.union(v.number(), v.null()),
  /** Number of rated players. */
  total: v.number(),
});

async function myRating(ctx: QueryCtx) {
  const player = await currentPlayer(ctx);
  if (!player) return null;
  const row = await ratingRow(ctx, player._id);
  const total = await ratingAggregate.count(ctx);
  const base = {
    playerId: player._id,
    name: player.name,
    rating: row?.rating ?? player.rating ?? RATING.initial,
    ratedGames: row?.ratedGames ?? 0,
    total,
  };
  if (!row) return { ...base, rank: null, percentile: null };
  const [higher, lower] = await Promise.all([
    ratingAggregate.count(ctx, {
      bounds: { lower: { key: row.rating, inclusive: false } },
    }),
    ratingAggregate.count(ctx, {
      bounds: { upper: { key: row.rating, inclusive: false } },
    }),
  ]);
  return {
    ...base,
    rank: higher + 1,
    percentile: Math.round((100 * lower) / total),
  };
}

/** The caller's rating, games played, rank, and percentile. */
export const mine = query({
  args: {},
  returns: v.union(v.null(), vMyRating),
  handler: async (ctx) => await myRating(ctx),
});

/** The top `limit` rated players plus the caller's own standing. */
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.object({
    top: v.array(
      v.object({
        rank: v.number(),
        playerId: v.id("players"),
        name: v.string(),
        rating: v.number(),
        ratedGames: v.number(),
      }),
    ),
    me: v.union(v.null(), vMyRating),
  }),
  handler: async (ctx, { limit }) => {
    const n = Math.max(1, Math.min(limit ?? 20, RATING.leaderboardMax));
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_rating")
      .order("desc")
      .take(n);
    const top: {
      rank: number;
      playerId: Id<"players">;
      name: string;
      rating: number;
      ratedGames: number;
    }[] = [];
    for (const [i, row] of rows.entries()) {
      const prev = top[i - 1];
      const player = await ctx.db.get("players", row.playerId);
      top.push({
        rank: prev && prev.rating === row.rating ? prev.rank : i + 1,
        playerId: row.playerId,
        name: player?.name ?? "Unknown",
        rating: row.rating,
        ratedGames: row.ratedGames,
      });
    }
    return { top, me: await myRating(ctx) };
  },
});
