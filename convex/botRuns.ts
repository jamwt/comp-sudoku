import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { BOTS, type BotProfile } from "./gameConfig";

/**
 * Scheduling helpers for the bot runtime, shared by the match API (which
 * wakes bots when the board changes) and `bots.ts` (which runs them).
 */

/** The roster entry behind a bot player, or null for humans and retired bots. */
export function botProfile(player: Doc<"players">): BotProfile | null {
  if (player.kind !== "bot") return null;
  return BOTS.find((b) => b.key === player.botProfile) ?? null;
}

/** Schedule the run's next step at `at`, invalidating any earlier one. */
export async function scheduleBotStep(
  ctx: MutationCtx,
  runId: Id<"botRuns">,
  at: number,
) {
  const run = await ctx.db.get("botRuns", runId);
  if (!run) return;
  const seq = run.seq + 1;
  await ctx.db.patch("botRuns", runId, { seq });
  await ctx.scheduler.runAt(at, internal.bots.step, { runId, seq });
}

/**
 * After `claimer` claims `cell`, bots in the match that were stuck, or were
 * about to enter that same cell, look at the board again right away.
 */
export async function wakeBots(
  ctx: MutationCtx,
  matchId: Id<"matches">,
  claimer: Id<"players">,
  cell: number,
) {
  const runs = await ctx.db
    .query("botRuns")
    .withIndex("by_matchId_and_playerId", (q) => q.eq("matchId", matchId))
    .take(2);
  for (const run of runs) {
    if (run.playerId === claimer) continue;
    if (run.status !== "stuck" && run.plan?.cell !== cell) continue;
    await ctx.db.patch("botRuns", run._id, {
      status: "thinking",
      plan: undefined,
    });
    await scheduleBotStep(ctx, run._id, Date.now());
  }
}
