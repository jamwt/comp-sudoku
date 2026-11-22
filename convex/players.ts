import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { rateLimiter } from "./rateLimits";
import { validateNickname } from "./lib/nickname";
import { moderateNicknameWithJev } from "./lib/jevModeration";

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
      nickname: v.union(v.string(), v.null()),
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
      nickname: player.nickname ?? null,
      isGuest: user?.provider !== "google",
      email: user?.email ?? null,
      avatarUrl: user?.avatarUrl ?? null,
    };
  },
});

export const checkNicknameEligibility = internalMutation({
  args: { nickname: v.string() },
  returns: v.object({
    status: v.union(v.literal("unchanged"), v.literal("proceed")),
    playerId: v.id("players"),
  }),
  handler: async (ctx, { nickname }) => {
    const player = await requirePlayer(ctx);
    const user = player.userId
      ? await ctx.db.get("users", player.userId)
      : null;
    if (user?.provider !== "google") {
      throw new ConvexError("Sign in with Google to claim a custom nickname.");
    }
    if (player.nickname === nickname) {
      return { status: "unchanged" as const, playerId: player._id };
    }

    const limit = await rateLimiter.limit(ctx, "setNickname", {
      key: player._id,
    });
    if (!limit.ok) {
      throw new ConvexError(
        "Too many nickname attempts. Please wait a few minutes and try again.",
      );
    }

    const existing = await ctx.db
      .query("players")
      .withIndex("by_nickname", (q) => q.eq("nickname", nickname))
      .unique();
    if (existing !== null && existing._id !== player._id) {
      throw new ConvexError("That nickname is already taken.");
    }

    return { status: "proceed" as const, playerId: player._id };
  },
});

export const commitNickname = internalMutation({
  args: {
    playerId: v.id("players"),
    nickname: v.string(),
  },
  returns: v.object({ nickname: v.string() }),
  handler: async (ctx, { playerId, nickname }) => {
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      throw new ConvexError(validation.error);
    }
    const normalized = validation.nickname;
    const player = await ctx.db.get("players", playerId);
    if (!player || !player.userId) {
      throw new ConvexError("Not signed in");
    }
    const user = await ctx.db.get("users", player.userId);
    if (user?.provider !== "google") {
      throw new ConvexError("Sign in with Google to claim a custom nickname.");
    }

    const existing = await ctx.db
      .query("players")
      .withIndex("by_nickname", (q) => q.eq("nickname", normalized))
      .unique();
    if (existing !== null && existing._id !== player._id) {
      throw new ConvexError("That nickname is already taken.");
    }

    await ctx.db.patch("players", player._id, {
      nickname: normalized,
      name: normalized,
    });
    return { nickname: normalized };
  },
});

/**
 * Claims or updates an exclusive, Jev-moderated lowercase handle for a
 * Google-authenticated player.
 */
export const setNickname = action({
  args: { nickname: v.string() },
  returns: v.object({ nickname: v.string() }),
  handler: async (ctx, { nickname: raw }): Promise<{ nickname: string }> => {
    const validation = validateNickname(raw);
    if (!validation.ok) {
      throw new ConvexError(validation.error);
    }
    const normalized = validation.nickname;

    const check: { status: "unchanged" | "proceed"; playerId: Id<"players"> } =
      await ctx.runMutation(internal.players.checkNicknameEligibility, {
        nickname: normalized,
      });
    if (check.status === "unchanged") {
      return { nickname: normalized };
    }

    const moderation = await moderateNicknameWithJev(normalized);
    if (!moderation.allowed) {
      throw new ConvexError(
        "That nickname isn't allowed. Please choose another.",
      );
    }

    const committed: { nickname: string } = await ctx.runMutation(
      internal.players.commitNickname,
      {
        playerId: check.playerId,
        nickname: normalized,
      },
    );
    return committed;
  },
});
