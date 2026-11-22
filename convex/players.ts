import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/** The signed-in caller's player, or null when signed out. */
export async function currentPlayer(
  ctx: QueryCtx,
): Promise<Doc<"players"> | null> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) return null;
  return await ctx.db
    .query("players")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function requirePlayer(ctx: QueryCtx): Promise<Doc<"players">> {
  const player = await currentPlayer(ctx);
  if (player === null) throw new ConvexError("Not signed in");
  return player;
}

export const me = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("players"),
      name: v.string(),
      isGuest: v.boolean(),
      email: v.union(v.string(), v.null()),
      avatarUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const player = await currentPlayer(ctx);
    if (!player) return null;
    const user = player.userId
      ? await ctx.db.get("users", player.userId)
      : null;
    return {
      _id: player._id,
      name: player.name,
      isGuest: user?.provider !== "google",
      email: user?.email ?? null,
      avatarUrl: user?.avatarUrl ?? null,
    };
  },
});

export const rename = mutation({
  args: { name: v.string() },
  returns: v.null(),
  handler: async (ctx, { name }) => {
    const player = await requirePlayer(ctx);
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 24) {
      throw new ConvexError("Name must be 1 to 24 characters");
    }
    await ctx.db.patch("players", player._id, { name: trimmed });
    return null;
  },
});
