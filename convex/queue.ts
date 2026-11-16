import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { MATCHMAKING } from "./gameConfig";
import { pairQueue } from "./lib/matchmaking";
import { createActiveMatch } from "./matches";
import { currentPlayer, requirePlayer } from "./players";
import { presence, queueRoom } from "./presence";
import { rateLimiter } from "./rateLimits";
import { getRating } from "./ratings";

/**
 * The ranked queue. Joining runs a pairing pass at once and makes sure a
 * self-rescheduling sweep reruns it every `MATCHMAKING.sweepIntervalMs` while
 * anyone is waiting. Paired players land in an active rated match.
 */

const vQueueStatus = v.union(
  v.object({ state: v.literal("idle") }),
  v.object({
    state: v.literal("waiting"),
    joinedAt: v.number(),
    rating: v.number(),
  }),
  v.object({ state: v.literal("matched"), matchId: v.id("matches") }),
  v.object({ state: v.literal("dropped") }),
);

async function entryFor(ctx: QueryCtx, playerId: Id<"players">) {
  return await ctx.db
    .query("queue")
    .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
    .unique();
}

/** Where the caller stands in the ranked queue. */
export const status = query({
  args: {},
  returns: vQueueStatus,
  handler: async (ctx) => {
    const player = await currentPlayer(ctx);
    const entry = player && (await entryFor(ctx, player._id));
    if (!entry) return { state: "idle" as const };
    switch (entry.status) {
      case "waiting":
        return {
          state: "waiting" as const,
          joinedAt: entry.joinedAt,
          rating: entry.rating,
        };
      case "dropped":
        return { state: "dropped" as const };
      case "matched": {
        const match =
          entry.matchId && (await ctx.db.get("matches", entry.matchId));
        return match && match.status !== "finished"
          ? { state: "matched" as const, matchId: match._id }
          : { state: "idle" as const };
      }
    }
  },
});

/** Join the ranked queue. A no-op while already waiting or in a live queue match. */
export const join = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const existing = await entryFor(ctx, player._id);
    if (existing?.status === "waiting") return null;
    if (existing?.status === "matched" && existing.matchId) {
      const match = await ctx.db.get("matches", existing.matchId);
      if (match && match.status !== "finished") return null;
    }
    await rateLimiter.limit(ctx, "joinQueue", {
      key: player._id,
      throws: true,
    });
    if (existing) await ctx.db.delete("queue", existing._id);
    const { rating } = await getRating(ctx, player._id);
    await ctx.db.insert("queue", {
      playerId: player._id,
      status: "waiting",
      rating,
      joinedAt: Date.now(),
    });
    await runPairingPass(ctx);
    await ensureSweep(ctx);
    return null;
  },
});

/** Leave the queue, or clear a "dropped" notice. A matched player stays matched. */
export const cancel = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const player = await requirePlayer(ctx);
    const entry = await entryFor(ctx, player._id);
    if (!entry || entry.status === "matched") return null;
    await ctx.db.delete("queue", entry._id);
    await removeQueuePresence(ctx, player._id);
    return null;
  },
});

/** Scheduled pairing pass; reschedules itself while anyone is still waiting. */
export const sweep = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const state = await ctx.db.query("queueSweep").first();
    if (state)
      await ctx.db.patch("queueSweep", state._id, { scheduledId: undefined });
    await runPairingPass(ctx);
    const stillWaiting = await ctx.db
      .query("queue")
      .withIndex("by_status_and_joinedAt", (q) => q.eq("status", "waiting"))
      .first();
    if (stillWaiting) await ensureSweep(ctx);
    return null;
  },
});

async function ensureSweep(ctx: MutationCtx) {
  const state = await ctx.db.query("queueSweep").first();
  if (state?.scheduledId) {
    const job = await ctx.db.system.get(
      "_scheduled_functions",
      state.scheduledId,
    );
    if (job?.state.kind === "pending") return;
  }
  const scheduledId = await ctx.scheduler.runAfter(
    MATCHMAKING.sweepIntervalMs,
    internal.queue.sweep,
    {},
  );
  if (state) await ctx.db.patch("queueSweep", state._id, { scheduledId });
  else await ctx.db.insert("queueSweep", { scheduledId });
}

/**
 * A waiting player is gone once their queue presence has been offline for
 * `disconnectGraceMs`. Someone never seen online counts as offline since joining.
 */
async function isGone(ctx: MutationCtx, entry: Doc<"queue">, now: number) {
  const [seen] = await presence.listRoom(
    ctx,
    queueRoom(entry.playerId),
    false,
    1,
  );
  if (seen?.online) return false;
  const offlineSince = Math.max(seen?.lastDisconnected ?? 0, entry.joinedAt);
  return now - offlineSince >= MATCHMAKING.disconnectGraceMs;
}

async function removeQueuePresence(ctx: MutationCtx, playerId: Id<"players">) {
  const room = queueRoom(playerId);
  const [seen] = await presence.listRoom(ctx, room, false, 1);
  if (seen) await presence.removeRoomUser(ctx, room, playerId);
}

async function leaveQueue(
  ctx: MutationCtx,
  entry: Doc<"queue">,
  update: { status: "matched"; matchId: Id<"matches"> } | { status: "dropped" },
) {
  await ctx.db.patch("queue", entry._id, update);
  await removeQueuePresence(ctx, entry.playerId);
}

/**
 * Drop disconnected players, pair the rest by rating window, and offer a bot
 * to anyone past the bot fallback wait. One pass looks at the
 * `maxPerPass` longest-waiting players.
 */
async function runPairingPass(ctx: MutationCtx) {
  const now = Date.now();
  const entries = await ctx.db
    .query("queue")
    .withIndex("by_status_and_joinedAt", (q) => q.eq("status", "waiting"))
    .take(MATCHMAKING.maxPerPass);
  const live = new Map<Id<"queue">, Doc<"queue">>();
  for (const entry of entries) {
    if (await isGone(ctx, entry, now))
      await leaveQueue(ctx, entry, { status: "dropped" });
    else live.set(entry._id, entry);
  }
  const { pairs, botCandidates } = pairQueue(
    [...live.values()].map((e) => ({
      id: e._id,
      rating: e.rating,
      joinedAt: e.joinedAt,
    })),
    now,
    MATCHMAKING,
  );
  for (const ids of pairs) {
    const [a, b] = ids.map((id) => live.get(id)!);
    const matchId = await createActiveMatch(ctx, {
      tier: MATCHMAKING.tier,
      playerIds: [a.playerId, b.playerId],
      rated: true,
    });
    if (matchId === null) return;
    await leaveQueue(ctx, a, { status: "matched", matchId });
    await leaveQueue(ctx, b, { status: "matched", matchId });
  }
  for (const candidate of botCandidates) {
    const entry = live.get(candidate.id)!;
    const botId: Id<"players"> | null = await ctx.runQuery(
      internal.bots.pickForRating,
      { rating: entry.rating },
    );
    if (botId === null) continue;
    const matchId = await createActiveMatch(ctx, {
      tier: MATCHMAKING.tier,
      playerIds: [entry.playerId, botId],
      rated: true,
    });
    if (matchId === null) return;
    await leaveQueue(ctx, entry, { status: "matched", matchId });
    await ctx.scheduler.runAfter(0, internal.bots.onMatchStarted, { matchId });
  }
}
