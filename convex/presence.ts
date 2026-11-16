import { ConvexError, v } from "convex/values";
import { Presence } from "@convex-dev/presence";
import { components } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { requirePlayer } from "./players";
import type { Id } from "./_generated/dataModel";

/**
 * Presence rooms are match ids, plus one queue room per player while they wait
 * for a ranked match; presence users are player ids.
 */
export const presence = new Presence(components.presence);

export function queueRoom(playerId: Id<"players">) {
  return `queue:${playerId}`;
}

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number(),
  },
  returns: v.object({ roomToken: v.string(), sessionToken: v.string() }),
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    const player = await requirePlayer(ctx);
    if (userId !== player._id) throw new ConvexError("Presence user mismatch");
    if (roomId === queueRoom(player._id)) {
      return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
    }
    const matchId = ctx.db.normalizeId("matches", roomId);
    const match = matchId && (await ctx.db.get("matches", matchId));
    if (!match || !match.participants.some((p) => p.playerId === player._id)) {
      throw new ConvexError("Not a participant in this match");
    }
    return await presence.heartbeat(ctx, roomId, userId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => await presence.list(ctx, roomToken),
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, { sessionToken }) =>
    await presence.disconnect(ctx, sessionToken),
});
