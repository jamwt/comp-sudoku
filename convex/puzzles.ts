import { v } from "convex/values";
import { Workpool } from "@convex-dev/workpool";
import { components, internal } from "./_generated/api";
import {
  internalAction,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { RULES, TIERS, type Tier } from "./gameConfig";
import { vTier } from "./schema";
import { generateGradedPuzzle, mulberry32 } from "./lib/sudoku";

const puzzleWorkpool = new Workpool(components.puzzleWorkpool, {
  maxParallelism: 1,
});

const vNeeds = v.object({
  easy: v.number(),
  medium: v.number(),
  hard: v.number(),
});
type Needs = Record<Tier, number>;

async function poolDeficits(ctx: MutationCtx): Promise<Needs> {
  const needs: Needs = { easy: 0, medium: 0, hard: 0 };
  for (const tier of TIERS) {
    const target = RULES.puzzlePool.targetPerTier[tier];
    const available = await ctx.db
      .query("puzzles")
      .withIndex("by_tier_and_status", (q) =>
        q.eq("tier", tier).eq("status", "available"),
      )
      .take(target);
    needs[tier] = target - available.length;
  }
  return needs;
}

async function enqueueTopUp(ctx: MutationCtx): Promise<Needs> {
  const needs = await poolDeficits(ctx);
  if (needs.easy + needs.medium + needs.hard > 0) {
    await puzzleWorkpool.enqueueAction(ctx, internal.puzzles.generate, {
      needs,
    });
  }
  return needs;
}

/** Fill the pool up to its target. Run once after deploying: `npx convex run puzzles:seed`. */
export const seed = internalMutation({
  args: {},
  returns: vNeeds,
  handler: async (ctx) => await enqueueTopUp(ctx),
});

/** Cron entry point: top the pool back up to its target. */
export const topUp = internalMutation({
  args: {},
  returns: vNeeds,
  handler: async (ctx) => await enqueueTopUp(ctx),
});

/** Generate and grade puzzles until each tier's need is met or the budget runs out. */
export const generate = internalAction({
  args: { needs: vNeeds },
  returns: v.null(),
  handler: async (ctx, { needs }) => {
    const remaining = { ...needs };
    const rng = mulberry32(Math.floor(Math.random() * 2 ** 32));
    const started = Date.now();
    const batch = [];
    for (
      let attempt = 0;
      attempt < RULES.puzzlePool.maxAttemptsPerRun &&
      Date.now() - started < RULES.puzzlePool.maxRunMs &&
      remaining.easy + remaining.medium + remaining.hard > 0;
      attempt++
    ) {
      const puzzle = generateGradedPuzzle(rng);
      if (remaining[puzzle.tier] > 0) {
        remaining[puzzle.tier]--;
        batch.push(puzzle);
      }
    }
    if (batch.length > 0) {
      await ctx.runMutation(internal.puzzles.insertMany, { puzzles: batch });
    }
    return null;
  },
});

export const insertMany = internalMutation({
  args: {
    puzzles: v.array(
      v.object({
        givens: v.string(),
        solution: v.string(),
        tier: vTier,
        hardest: v.string(),
        clueCount: v.number(),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { puzzles }) => {
    const needs = await poolDeficits(ctx);
    for (const p of puzzles) {
      if (needs[p.tier] <= 0) continue;
      needs[p.tier]--;
      await ctx.db.insert("puzzles", { ...p, status: "available" });
    }
    return null;
  },
});

/** Take an unused puzzle of `tier` out of the pool, or null if the pool is empty. */
export async function drawPuzzle(ctx: MutationCtx, tier: Tier) {
  const puzzle = await ctx.db
    .query("puzzles")
    .withIndex("by_tier_and_status", (q) =>
      q.eq("tier", tier).eq("status", "available"),
    )
    .first();
  if (puzzle === null) {
    await ctx.scheduler.runAfter(0, internal.puzzles.topUp, {});
    return null;
  }
  await ctx.db.patch("puzzles", puzzle._id, { status: "used" });
  return puzzle;
}
