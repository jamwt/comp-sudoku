import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

/** Seed a fresh deployment: fill the puzzle pool and upsert the bot roster. */
export default internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.runMutation(internal.puzzles.seed, {});
    await ctx.runMutation(internal.bots.seed, {});
    return null;
  },
});
