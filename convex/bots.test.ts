/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import authCore from "@convex-dev/auth/test";
import authPassword from "@convex-dev/auth/components/password/test";
import authUsername from "@convex-dev/auth/components/username/test";
import aggregate from "@convex-dev/aggregate/test";
import presence from "@convex-dev/presence/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import workpool from "@convex-dev/workpool/test";
import { ratingAggregate } from "./ratings";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { BOTS, RULES } from "./gameConfig";
import { countEmpty, emptyOwners } from "./lib/engine";
import { rateLimiter as entryLimiter } from "./rateLimits";

const modules = import.meta.glob("./**/*.ts");

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVENS = "0" + SOLUTION.slice(1, 4) + "0".repeat(4) + SOLUTION.slice(8);
const WIDE_GIVENS = [0, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17].reduce(
  (g, c) => g.slice(0, c) + "0" + g.slice(c + 1),
  SOLUTION,
);

function setup() {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  authCore.registerCore(t);
  authPassword.registerPassword(t);
  authUsername.registerUsername(t);
  aggregate.register(t, "ratingAggregate");
  presence.register(t);
  rateLimiter.register(t);
  workpool.register(t, "puzzleWorkpool");
  return t;
}

type T = ReturnType<typeof setup>;

async function signUp(t: T, username: string) {
  const result = await t.mutation(api.auth.signUpWithUsernamePassword, {
    username,
    password: "a-long-guest-password-123",
  });
  if (result.status !== "complete") throw new Error("sign-up failed");
  return t.withIdentity(authCore.sessionIdentity(result.tokens));
}

async function addPuzzle(t: T, givens = GIVENS) {
  return await t.run(async (ctx) =>
    ctx.db.insert("puzzles", {
      givens,
      solution: SOLUTION,
      tier: "easy",
      hardest: "nakedSingle",
      clueCount: 81 - countEmpty(givens),
      status: "available",
    }),
  );
}

async function botId(t: T, key: string) {
  const ids = await t.mutation(internal.bots.seed, {});
  return ids[BOTS.findIndex((b) => b.key === key)];
}

const runs = (t: T, matchId: Id<"matches">) =>
  t.run(async (ctx) =>
    (await ctx.db.query("botRuns").collect()).filter(
      (r) => r.matchId === matchId,
    ),
  );

/** Let scheduled bot steps and forfeit checks play out on the fake clock. */
async function playOut(t: T, ms: number) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    vi.advanceTimersByTime(250);
    await t.finishInProgressScheduledFunctions();
  }
}

describe("bots", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.useRealTimers());

  test("seed creates the roster once, with distinct names and ratings 400-2000", async () => {
    const t = setup();
    const first = await t.mutation(internal.bots.seed, {});
    const second = await t.mutation(internal.bots.seed, {});
    expect(second).toEqual(first);
    const bots = await t.query(api.bots.list, {});
    expect(bots).toHaveLength(6);
    expect(new Set(bots.map((b) => b.name)).size).toBe(6);
    const ratings = bots.map((b) => b.rating);
    expect(ratings).toEqual([...ratings].sort((a, b) => a - b));
    expect(ratings[0]).toBe(400);
    expect(ratings[5]).toBe(2000);
    const rows = await t.run(async (ctx) => ctx.db.query("players").collect());
    expect(rows.every((p) => p.kind === "bot" && p.userId === undefined)).toBe(
      true,
    );
  });

  test("init can rerun on a live deployment without duplicating bots or resetting ratings", async () => {
    const t = setup();
    const ids = await t.mutation(internal.bots.seed, {});
    await t.run(async (ctx) => {
      await ctx.db.insert("ratings", {
        playerId: ids[0],
        rating: 1111,
        ratedGames: 7,
      });
    });
    await t.mutation(internal.init.default, {});
    await t.mutation(internal.init.default, {});
    const bots = await t.query(api.bots.list, {});
    expect(bots.map((b) => b._id)).toEqual(ids);
    const { players, ratings } = await t.run(async (ctx) => ({
      players: await ctx.db.query("players").collect(),
      ratings: await ctx.db.query("ratings").collect(),
    }));
    expect(players.map((p) => p.rating)).toEqual(BOTS.map((b) => b.rating));
    expect(ratings).toMatchObject([
      { playerId: ids[0], rating: 1111, ratedGames: 7 },
    ]);
  });

  test("seed re-anchors a bot's live rating and aggregate once when its configured tier changes", async () => {
    const t = setup();
    const ids = await t.mutation(internal.bots.seed, {});
    const tillyId = ids[1];
    // Simulate a pre-rebalance deployment where Tilly was seeded at 1050 and had played ranked games
    await t.run(async (ctx) => {
      await ctx.db.patch("players", tillyId, { rating: 1050 });
      const ratingId = await ctx.db.insert("ratings", {
        playerId: tillyId,
        rating: 1068,
        ratedGames: 4,
      });
      await ratingAggregate.insert(ctx, (await ctx.db.get("ratings", ratingId))!);
    });

    await t.mutation(internal.bots.seed, {});
    const afterRebalance = await t.run(async (ctx) => ({
      player: await ctx.db.get("players", tillyId),
      rating: await ctx.db
        .query("ratings")
        .withIndex("by_playerId", (q) => q.eq("playerId", tillyId))
        .unique(),
      countAtNewRating: await ratingAggregate.count(ctx, {
        bounds: {
          lower: { key: BOTS[1].rating, inclusive: true },
          upper: { key: BOTS[1].rating, inclusive: true },
        },
      }),
    }));
    expect(afterRebalance.player?.rating).toBe(BOTS[1].rating);
    expect(afterRebalance.rating?.rating).toBe(BOTS[1].rating);
    expect(afterRebalance.rating?.ratedGames).toBe(4);
    expect(afterRebalance.countAtNewRating).toBe(1);
  });

  test("pickForRating returns the nearest bot, ties to the weaker one", async () => {
    const t = setup();
    expect(
      await t.query(internal.bots.pickForRating, { rating: 1200 }),
    ).toBeNull();
    const ids = await t.mutation(internal.bots.seed, {});
    const pick = (rating: number) =>
      t.query(internal.bots.pickForRating, { rating });
    const byKey = (key: string) => ids[BOTS.findIndex((b) => b.key === key)];
    expect(await pick(0)).toBe(byKey("pip"));
    expect(await pick(5000)).toBe(byKey("ada"));
    expect(await pick(1000)).toBe(byKey("marlow"));
    expect(await pick(1200)).toBe(byKey("juniper"));
    expect(await pick(850)).toBe(byKey("tilly"));
    expect(await pick(1850)).toBe(byKey("vega"));

    // Once a bot has a live rating in `ratings`, both `list` and `pickForRating` use it
    await t.run(async (ctx) => {
      await ctx.db.insert("ratings", {
        playerId: byKey("marlow"),
        rating: 1180,
        ratedGames: 5,
      });
    });
    const listAfter = await t.query(api.bots.list, {});
    expect(listAfter.find((b) => b.name === "Marlow")?.rating).toBe(1180);
    expect(await pick(1200)).toBe(byKey("marlow"));
  });

  test("a practice match starts at once and the bot wins it through the normal entry path", async () => {
    const t = setup();
    await addPuzzle(t);
    const ada = await botId(t, "ada");
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    const matchId = await alice.mutation(api.bots.startPractice, {
      botId: ada,
      tier: "easy",
    });
    if (matchId === null) throw new Error("pool empty");
    const view = await alice.query(api.matches.get, { matchId });
    expect(view?.status).toBe("active");
    expect(view?.you).toBe(0);
    expect(view?.participants[1].bot).toEqual({
      level: "Master",
      rating: 2000,
    });
    expect(view?.participants[0].bot).toBeNull();
    expect(await runs(t, matchId)).toHaveLength(1);

    await playOut(t, RULES.countdownMs + 25_000);
    const done = await alice.query(api.matches.get, { matchId });
    expect(done?.status).toBe("finished");
    expect(done?.result).toEqual({ winner: 1, reason: "clinch" });
    expect(done?.participants[1].cells).toBe(3);
    expect(await runs(t, matchId)).toHaveLength(0);
  });

  test("an idle human still forfeits to a bot, and the bot never does", async () => {
    const t = setup();
    await addPuzzle(t, WIDE_GIVENS);
    const pip = await botId(t, "pip");
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    const matchId = await alice.mutation(api.bots.startPractice, {
      botId: pip,
    });
    if (matchId === null) throw new Error("pool empty");
    await t.run(async (ctx) => {
      const run = (await ctx.db.query("botRuns").collect())[0];
      await ctx.db.delete("botRuns", run._id);
    });
    await playOut(t, RULES.countdownMs + RULES.idleForfeitMs + 1_000);
    const done = await alice.query(api.matches.get, { matchId });
    expect(done?.result?.winner).toBe(1);
    expect(done?.result?.reason).toMatch(/^forfeit_/);
  });

  test("a bot vs bot match runs to the end with no forfeit checks at all", async () => {
    const t = setup();
    const puzzleId = await addPuzzle(t);
    const vega = await botId(t, "vega");
    const ada = await botId(t, "ada");
    const startsAt = Date.now();
    vi.useFakeTimers();
    const matchId = await t.run(async (ctx) =>
      ctx.db.insert("matches", {
        status: "active",
        tier: "easy",
        puzzleId,
        givens: GIVENS,
        board: GIVENS,
        owners: emptyOwners(),
        emptyCount: 5,
        participants: [vega, ada].map((playerId) => ({
          playerId,
          score: 0,
          cells: 0,
          wrong: 0,
          lockedUntil: 0,
          lastActiveAt: startsAt,
        })),
        startsAt,
      }),
    );
    await t.mutation(internal.bots.onMatchStarted, { matchId });
    await t.mutation(internal.bots.onMatchStarted, { matchId });
    expect(await runs(t, matchId)).toHaveLength(2);
    await t.mutation(internal.matches.checkForfeits, { matchId });
    await playOut(t, 60_000);
    const match = await t.run(async (ctx) => ctx.db.get("matches", matchId));
    expect(match?.status).toBe("finished");
    expect(match?.result?.reason).toMatch(/clinch|board_full/);
    expect(match?.forfeitCheckId).toBeUndefined();
    expect(
      match!.participants[0].cells + match!.participants[1].cells,
    ).toBeGreaterThanOrEqual(3);
  });

  test("a bot stops when the match ends", async () => {
    const t = setup();
    await addPuzzle(t);
    const pip = await botId(t, "pip");
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    const matchId = await alice.mutation(api.bots.startPractice, {
      botId: pip,
    });
    if (matchId === null) throw new Error("pool empty");
    vi.advanceTimersByTime(RULES.countdownMs + 100);
    await alice.mutation(api.matches.resign, { matchId });
    const board = (await alice.query(api.matches.get, { matchId }))?.board;
    await playOut(t, 120_000);
    const after = await alice.query(api.matches.get, { matchId });
    expect(after?.board).toBe(board);
    expect(after?.participants[1].cells).toBe(0);
    expect(await runs(t, matchId)).toHaveLength(0);
  });

  test("a claim wakes a stuck bot and a bot aiming at the claimed cell", async () => {
    const t = setup();
    await addPuzzle(t, WIDE_GIVENS);
    const pip = await botId(t, "pip");
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    const matchId = await alice.mutation(api.bots.startPractice, {
      botId: pip,
    });
    if (matchId === null) throw new Error("pool empty");
    vi.advanceTimersByTime(RULES.countdownMs + 100);
    const [run] = await runs(t, matchId);
    const far = Date.now() + 60_000;
    await t.run(async (ctx) =>
      ctx.db.patch("botRuns", run._id, {
        status: "thinking",
        plan: {
          cell: 0,
          digit: 5,
          dueAt: far,
          intent: "deduce",
          technique: "hiddenSingle",
        },
      }),
    );
    await alice.mutation(api.matches.enter, { matchId, cell: 4, digit: 7 });
    const untouched = (await runs(t, matchId))[0];
    expect(untouched.plan?.dueAt).toBe(far);
    await alice.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 });
    const woken = (await runs(t, matchId))[0];
    expect(woken.plan).toBeUndefined();
    expect(woken.seq).toBeGreaterThan(untouched.seq);

    await t.run(async (ctx) =>
      ctx.db.patch("botRuns", run._id, {
        status: "stuck",
        plan: {
          cell: 7,
          digit: 1,
          dueAt: far,
          intent: "guess",
          technique: "guess",
        },
      }),
    );
    await alice.mutation(api.matches.enter, { matchId, cell: 5, digit: 8 });
    const unstuck = (await runs(t, matchId))[0];
    expect(unstuck.status).toBe("thinking");
    expect(unstuck.plan).toBeUndefined();
  });

  test("a bot's entry budget is per match, not shared across its matches", async () => {
    const t = setup();
    await addPuzzle(t);
    const ada = await botId(t, "ada");
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    const matchId = await alice.mutation(api.bots.startPractice, {
      botId: ada,
    });
    if (matchId === null) throw new Error("pool empty");
    vi.advanceTimersByTime(RULES.countdownMs + 100);
    const [run] = await runs(t, matchId);
    await t.run(async (ctx) => {
      const drained = await entryLimiter.limit(ctx, "enterDigit", {
        key: ada,
        count: RULES.entryRateLimit.capacity,
      });
      expect(drained.ok).toBe(true);
      await ctx.db.patch("botRuns", run._id, {
        seq: 100,
        plan: {
          cell: 0,
          digit: 5,
          dueAt: Date.now(),
          intent: "deduce",
          technique: "hiddenSingle",
        },
      });
    });
    await t.mutation(internal.bots.step, { runId: run._id, seq: 100 });
    const view = await alice.query(api.matches.get, { matchId });
    expect(view?.board[0]).toBe("5");
    expect(view?.participants[1].cells).toBe(1);
  });

  test("practice requires a real bot", async () => {
    const t = setup();
    await addPuzzle(t);
    const alice = await signUp(t, "alice");
    const me = await alice.query(api.players.me, {});
    await expect(
      alice.mutation(api.bots.startPractice, { botId: me!._id }),
    ).rejects.toThrow(/Unknown bot/);
  });
});
