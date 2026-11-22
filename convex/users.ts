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
];

function randomGuestName(): string {
  const pick = (words: string[]) =>
    words[Math.floor(Math.random() * words.length)];
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}

function initialPlayerName(profile: { name?: string; email?: string }): string {
  const fromName = profile.name?.trim();
  if (fromName && fromName.length > 0) return fromName.slice(0, 24).trim();
  const fromEmail = profile.email?.split("@")[0]?.trim();
  if (fromEmail && fromEmail.length > 0) return fromEmail.slice(0, 24).trim();
  return randomGuestName();
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
      name: randomGuestName(),
    });
    return userId;
  },
});

/** Creates the user row and its human player for a new Google account. */
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
      name: initialPlayerName(profile),
    });
    return userId;
  },
});

/** Keeps Google profile metadata fresh on returning sign-ins without overwriting a custom nickname. */
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
