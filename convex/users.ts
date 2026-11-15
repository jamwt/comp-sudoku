import { internalMutation } from "./_generated/server";
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
    const userId = await ctx.db.insert("users", {});
    const pick = (words: string[]) =>
      words[Math.floor(Math.random() * words.length)];
    await ctx.db.insert("players", {
      kind: "human",
      userId,
      name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    });
    return userId;
  },
});
