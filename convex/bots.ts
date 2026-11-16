import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { BOTS, RULES } from "./gameConfig";
import { nextPlan, sampleForm } from "./lib/botBrain";
import { countEmpty, emptyOwners, type Slot } from "./lib/engine";
import { botProfile, scheduleBotStep } from "./botRuns";
import { newParticipant, submitEntry } from "./matches";
import { requirePlayer } from "./players";
import { drawPuzzle } from "./puzzles";
import { rateLimiter } from "./rateLimits";
import { vTier } from "./schema";

const MAX_BOTS = 100;

async function listBots(ctx: { db: MutationCtx["db"] }) {
  return await ctx.db
    .query("players")
    .withIndex("by_kind_and_rating", (q) => q.eq("kind", "bot"))
    .take(MAX_BOTS);
}

/** Upsert one bot player per `BOTS` entry. Run after deploying: `npx convex run bots:seed`. */
export const seed = internalMutation({
  args: {},
  returns: v.array(v.id("players")),
  handler: async (ctx) => {
    const existing = await listBots(ctx);
    const ids = [];
    for (const bot of BOTS) {
      const row = existing.find((p) => p.botProfile === bot.key);
      if (row) {
        await ctx.db.patch("players", row._id, { name: bot.name });
        ids.push(row._id);
      } else {
        ids.push(
          await ctx.db.insert("players", {
            kind: "bot",
            name: bot.name,
            rating: bot.rating,
            botProfile: bot.key,
          }),
        );
      }
    }
    return ids;
  },
});

/** Bots for the Practice vs AI picker, weakest first. */
export const list = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("players"),
      name: v.string(),
      level: v.string(),
      rating: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("players")
      .withIndex("by_kind_and_rating", (q) => q.eq("kind", "bot"))
      .take(MAX_BOTS);
    return rows.flatMap((p) => {
      const profile = botProfile(p);
      return profile
        ? [
            {
              _id: p._id,
              name: p.name,
              level: profile.level,
              rating: p.rating ?? profile.rating,
            },
          ]
        : [];
    });
  },
});

/**
 * Matchmaking fallback: the bot whose rating is nearest `rating`, or null if
 * no bots are seeded. Ties go to the lower-rated bot.
 */
export const pickForRating = internalQuery({
  args: { rating: v.number() },
  returns: v.union(v.id("players"), v.null()),
  handler: async (ctx, { rating }) => {
    const above = await ctx.db
      .query("players")
      .withIndex("by_kind_and_rating", (q) =>
        q.eq("kind", "bot").gte("rating", rating),
      )
      .first();
    const below = await ctx.db
      .query("players")
      .withIndex("by_kind_and_rating", (q) =>
        q.eq("kind", "bot").lt("rating", rating),
      )
      .order("desc")
      .first();
    const distance = (p: Doc<"players"> | null) =>
      p?.rating === undefined ? Infinity : Math.abs(p.rating - rating);
    if (!above && !below) return null;
    return distance(below) <= distance(above) ? below!._id : above!._id;
  },
});

/** Start a run for every bot participant that doesn't have one yet. */
async function startBots(ctx: MutationCtx, match: Doc<"matches">) {
  if (match.status !== "active") return;
  for (const p of match.participants) {
    const player = await ctx.db.get("players", p.playerId);
    if (!player || !botProfile(player)) continue;
    const existing = await ctx.db
      .query("botRuns")
      .withIndex("by_matchId_and_playerId", (q) =>
        q.eq("matchId", match._id).eq("playerId", p.playerId),
      )
      .unique();
    if (existing) continue;
    const runId = await ctx.db.insert("botRuns", {
      matchId: match._id,
      playerId: p.playerId,
      status: "thinking",
      seq: 0,
      form: sampleForm(Math.random),
      excluded: [],
    });
    await scheduleBotStep(
      ctx,
      runId,
      Math.max(Date.now(), match.startsAt ?? 0),
    );
  }
}

/**
 * Entry point for any code that starts a match with bots in it (Practice vs
 * AI here, the ranked queue's bot fallback). Idempotent; call it once the
 * match is active.
 */
export const onMatchStarted = internalMutation({
  args: { matchId: v.id("matches") },
  returns: v.null(),
  handler: async (ctx, { matchId }) => {
    const match = await ctx.db.get("matches", matchId);
    if (match) await startBots(ctx, match);
    return null;
  },
});

/** Start an unrated match against a bot right away. Null if the pool is empty. */
export const startPractice = mutation({
  args: { botId: v.id("players"), tier: v.optional(vTier) },
  returns: v.union(v.id("matches"), v.null()),
  handler: async (ctx, args) => {
    const player = await requirePlayer(ctx);
    const bot = await ctx.db.get("players", args.botId);
    if (!bot || !botProfile(bot)) throw new ConvexError("Unknown bot");
    await rateLimiter.limit(ctx, "createMatch", {
      key: player._id,
      throws: true,
    });
    const tier = args.tier ?? RULES.defaultTier;
    const puzzle = await drawPuzzle(ctx, tier);
    if (puzzle === null) return null;
    const startsAt = Date.now() + RULES.countdownMs;
    const matchId = await ctx.db.insert("matches", {
      status: "active",
      tier,
      puzzleId: puzzle._id,
      givens: puzzle.givens,
      board: puzzle.givens,
      owners: emptyOwners(),
      emptyCount: countEmpty(puzzle.givens),
      participants: [
        newParticipant(player._id, startsAt),
        newParticipant(bot._id, startsAt),
      ],
      startsAt,
    });
    const forfeitCheckId = await ctx.scheduler.runAt(
      startsAt + Math.min(RULES.idleForfeitMs, RULES.disconnectForfeitMs),
      internal.matches.checkForfeits,
      { matchId },
    );
    await ctx.db.patch("matches", matchId, { forfeitCheckId });
    const match = await ctx.db.get("matches", matchId);
    await startBots(ctx, match!);
    return matchId;
  },
});

/**
 * One tick of a bot: enter the planned digit if it is due, through the same
 * path as a human, then deduce the next move from the visible board and
 * schedule it. The bot stops when its match ends.
 */
export const step = internalMutation({
  args: { runId: v.id("botRuns"), seq: v.number() },
  returns: v.null(),
  handler: async (ctx, { runId, seq }) => {
    const run = await ctx.db.get("botRuns", runId);
    if (!run || run.seq !== seq) return null;
    let match = await ctx.db.get("matches", run.matchId);
    const slot = match?.participants.findIndex(
      (p) => p.playerId === run.playerId,
    );
    const player = await ctx.db.get("players", run.playerId);
    const profile = player && botProfile(player);
    if (
      !match ||
      match.status === "finished" ||
      slot === undefined ||
      slot === -1 ||
      !profile
    ) {
      await ctx.db.delete("botRuns", runId);
      return null;
    }
    const now = Date.now();
    const startsAt = match.startsAt ?? now;
    if (match.status !== "active" || now < startsAt) {
      await scheduleBotStep(ctx, runId, Math.max(startsAt, now + 1_000));
      return null;
    }

    let excluded = run.excluded;
    const plan = run.plan;
    if (plan && plan.dueAt > now) {
      await scheduleBotStep(ctx, runId, plan.dueAt);
      return null;
    }
    if (plan && match.board[plan.cell] === "0") {
      const outcome = await submitEntry(
        ctx,
        match,
        slot as Slot,
        plan.cell,
        plan.digit,
      );
      if (outcome.kind === "claimed" && outcome.ended) {
        await ctx.db.delete("botRuns", runId);
        return null;
      }
      if (outcome.kind === "locked" || outcome.kind === "rate_limited") {
        const retryAt =
          outcome.kind === "locked"
            ? outcome.lockedUntil
            : now + outcome.retryAfter;
        await scheduleBotStep(ctx, runId, retryAt);
        return null;
      }
      if (outcome.kind === "wrong" && plan.intent === "guess") {
        excluded = [...excluded, { cell: plan.cell, digit: plan.digit }];
      }
      match = (await ctx.db.get("matches", run.matchId))!;
    }

    const next = nextPlan(
      { board: match.board, excluded },
      { ...profile.skill, thinkScale: profile.skill.thinkScale * run.form },
      now,
      match.participants[slot].lockedUntil,
      Math.random,
    );
    if (!next) {
      await ctx.db.delete("botRuns", runId);
      return null;
    }
    await ctx.db.patch("botRuns", runId, {
      status: next.stuck ? "stuck" : "thinking",
      excluded,
      plan: {
        cell: next.plan.cell,
        digit: next.plan.digit,
        dueAt: next.dueAt,
        intent: next.plan.intent,
        technique: next.plan.technique,
      },
    });
    await scheduleBotStep(ctx, runId, next.dueAt);
    return null;
  },
});
