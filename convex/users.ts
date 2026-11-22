import { internalMutation } from "./_generated/server";
import { vGoogleProfile } from "@convex-dev/auth/methods/google/server";
import { v } from "convex/values";

const ADJECTIVES = [
  "Swift",
  "Clever",
  "Quiet",
  "Bold",
  "Lucky",
  "Sharp",
  "Calm",
  "Brave",
  "Keen",
  "Nimble",
  "Bright",
  "Crisp",
  "Deft",
  "Eager",
  "Gentle",
  "Jolly",
  "Lively",
  "Merry",
  "Plucky",
  "Quick",
  "Snappy",
  "Spry",
  "Steady",
  "Witty",
];

const ANIMALS = [
  "Otter",
  "Falcon",
  "Lynx",
  "Panda",
  "Heron",
  "Fox",
  "Badger",
  "Koala",
  "Raven",
  "Gecko",
  "Finch",
  "Ferret",
  "Crane",
  "Robin",
  "Puffin",
  "Marten",
  "Wombat",
  "Osprey",
  "Marmot",
  "Quokka",
  "Toucan",
  "Alpaca",
  "Gopher",
  "Magpie",
];

function randomAnimalName(): string {
  const pick = (words: string[]) =>
    words[Math.floor(Math.random() * words.length)];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

/** Creates the user row and its human player for a new guest account. */
export const createUser = internalMutation({
  args: {
    method: v.object({
      name: v.literal("usernamePassword"),
      profile: v.object({}),
    }),
  },
  returns: v.id("users"),
  handler: async (ctx) => {
    const userId = await ctx.db.insert("users", { provider: "guest" });
    await ctx.db.insert("players", {
      kind: "human",
      userId,
      name: randomAnimalName(),
    });
    return userId;
  },
});

/**
 * Creates the user row and its human player for a new Google account.
 * Public in-game display names default to a random `Adjective Animal` handle
 * rather than exposing the player's real Google name.
 */
export const createUserGoogle = internalMutation({
  args: {
    method: v.object({
      name: v.literal("google"),
      profile: vGoogleProfile,
    }),
  },
  returns: v.id("users"),
  handler: async (ctx, { method: { profile } }) => {
    const userId = await ctx.db.insert("users", {
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: "google",
    });
    await ctx.db.insert("players", {
      kind: "human",
      userId,
      name: randomAnimalName(),
    });
    return userId;
  },
});

/** Keeps Google profile metadata fresh on returning sign-ins without touching the player's display name or nickname. */
export const onSignInGoogle = internalMutation({
  args: {
    userId: v.id("users"),
    method: v.object({
      name: v.literal("google"),
      profile: vGoogleProfile,
    }),
  },
  returns: v.null(),
  handler: async (ctx, { userId, method: { profile } }) => {
    await ctx.db.patch("users", userId, {
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.picture,
      provider: "google",
    });
    return null;
  },
});
