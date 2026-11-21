import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { recordActivity, type Slot } from "./lib/engine";
import { pruneNotesForPlacement } from "./lib/notes";
import { currentPlayer, requirePlayer } from "./players";
import { rateLimiter } from "./rateLimits";

/** The caller's own pencil marks for a match: 81 bitmasks (bit d-1 = digit d). Never the opponent's. */
export const mine = query({
  args: { matchId: v.id("matches") },
  returns: v.union(v.null(), v.array(v.number())),
  handler: async (ctx, { matchId }) => {
    const player = await currentPlayer(ctx);
    if (!player) return null;
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_matchId_and_playerId", (q) =>
        q.eq("matchId", matchId).eq("playerId", player._id),
      )
      .unique();
    return notes?.marks ?? null;
  },
});

async function editMarks(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  cell: number,
  edit: (mask: number) => number,
) {
  if (!Number.isInteger(cell) || cell < 0 || cell > 80)
    throw new ConvexError("Invalid cell");
  const player = await requirePlayer(ctx);
  const match = await ctx.db.get("matches", matchId);
  if (!match || match.status !== "active")
    throw new ConvexError("The match is not in progress");
  const slot = match.participants.findIndex((p) => p.playerId === player._id);
  if (slot === -1) throw new ConvexError("You are not playing in this match");
  await rateLimiter.limit(ctx, "editNote", { key: player._id, throws: true });

  const existing = await ctx.db
    .query("notes")
    .withIndex("by_matchId_and_playerId", (q) =>
      q.eq("matchId", matchId).eq("playerId", player._id),
    )
    .unique();
  const marks = existing?.marks.slice() ?? new Array<number>(81).fill(0);
  marks[cell] = edit(marks[cell]);
  if (existing) {
    await ctx.db.patch("notes", existing._id, { marks });
  } else {
    await ctx.db.insert("notes", { matchId, playerId: player._id, marks });
  }

  const now = Date.now();
  const touched = recordActivity(match, slot as Slot, now);
  await ctx.db.patch("matches", matchId, {
    participants: match.participants.map((p, i) => ({
      ...p,
      lastActiveAt: touched.participants[i].lastActiveAt,
    })),
  });
}

export const toggle = mutation({
  args: { matchId: v.id("matches"), cell: v.number(), digit: v.number() },
  returns: v.null(),
  handler: async (ctx, { matchId, cell, digit }) => {
    if (!Number.isInteger(digit) || digit < 1 || digit > 9)
      throw new ConvexError("Invalid digit");
    await editMarks(ctx, matchId, cell, (mask) => mask ^ (1 << (digit - 1)));
    return null;
  },
});

export const clear = mutation({
  args: { matchId: v.id("matches"), cell: v.number() },
  returns: v.null(),
  handler: async (ctx, { matchId, cell }) => {
    await editMarks(ctx, matchId, cell, () => 0);
    return null;
  },
});

/**
 * Prunes invalidated candidate marks across all players in a match after a
 * valid placement of `digit` at `cell`. Called inside `submitEntry` so human
 * and bot claims keep every player's private notes consistent atomically.
 */
export async function pruneMatchNotes(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  cell: number,
  digit: number,
) {
  const docs = await ctx.db
    .query("notes")
    .withIndex("by_matchId_and_playerId", (q) => q.eq("matchId", matchId))
    .take(2);
  for (const doc of docs) {
    const pruned = pruneNotesForPlacement(doc.marks, cell, digit);
    if (pruned !== null) {
      await ctx.db.patch("notes", doc._id, { marks: pruned });
    }
  }
}
