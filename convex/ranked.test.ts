/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import authCore from "@convex-dev/auth/test";
import authPassword from "@convex-dev/auth/components/password/test";
import authUsername from "@convex-dev/auth/components/username/test";
import aggregate from "@convex-dev/aggregate/test";
import presence from "@convex-dev/presence/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import workpool from "@convex-dev/workpool/test";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { MATCHMAKING, RATING, RULES } from "./gameConfig";
import { ratingAggregate } from "./ratings";

const modules = import.meta.glob("./**/*.ts");
const CLOCK_SLACK_MS = 100;

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
/** Five open cells (0, 4, 5, 6, 7): three claims clinch. */
const GIVENS_5 = "0" + SOLUTION.slice(1, 4) + "0".repeat(4) + SOLUTION.slice(8);
/** Four open cells (0, 4, 5, 6): two claims each is a draw. */
const GIVENS_4 = "0" + SOLUTION.slice(1, 4) + "0".repeat(3) + SOLUTION.slice(7);

/** A stand-in for the bots thread: picks the player named "Test Bot". */
const fakeBots = {
  pickForRating: internalQuery({
    args: { rating: v.number() },
    returns: v.union(v.id("players"), v.null()),
    handler: async (ctx) => {
      const players = await ctx.db.query("players").take(20);
      return players.find((p) => p.name === "Test Bot")?._id ?? null;
    },
  }),
  onMatchStarted: internalMutation({
    args: { matchId: v.id("matches") },
    returns: v.null(),
    handler: async () => null,
  }),
};

function setup(opts: { withBots?: boolean } = {}) {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(
    schema,
    opts.withBots ? { ...modules, "./bots.ts": async () => fakeBots } : modules,
  );
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
type Player = Awaited<ReturnType<typeof signUp>>;

async function addPuzzles(t: T, givens: string, count = 3) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      await ctx.db.insert("puzzles", {
        givens,
        solution: SOLUTION,
        tier: MATCHMAKING.tier,
        hardest: "nakedSingle",
        clueCount: 81 - 5,
        status: "available",
      });
    }
  });
}

async function signUp(t: T, username: string) {
  const result = await t.mutation(api.auth.signUpWithUsernamePassword, {
    username,
    password: "a-long-guest-password-123",
  });
  if (result.status !== "complete") throw new Error("sign-up failed");
  return t.withIdentity(authCore.sessionIdentity(result.tokens));
}

async function playerId(player: Player) {
  return (await player.query(api.players.me))!._id;
}

/** Keep a player's queue presence online for the rest of the test. */
async function stayOnline(player: Player) {
  const id = await playerId(player);
  return await player.mutation(api.presence.heartbeat, {
    roomId: `queue:${id}`,
    userId: id,
    sessionId: id,
    interval: 600_000,
  });
}

async function sweep(t: T) {
  await t.run(async (ctx) => {
    await ctx.runMutation(internal.queue.sweep, {});
  });
}

async function setRating(
  t: T,
  player: Player,
  rating: number,
  ratedGames = 30,
) {
  const id = await playerId(player);
  await t.run(async (ctx) => {
    const docId = await ctx.db.insert("ratings", {
      playerId: id,
      rating,
      ratedGames,
    });
    await ratingAggregate.insert(ctx, (await ctx.db.get("ratings", docId))!);
  });
}

/** Queue two fresh players and return the rated match they land in. */
async function rankedMatch(t: T, givens = GIVENS_5) {
  await addPuzzles(t, givens);
  const alice = await signUp(t, "alice");
  const bob = await signUp(t, "bob");
  vi.useFakeTimers();
  await alice.mutation(api.queue.join, {});
  await bob.mutation(api.queue.join, {});
  const status = await alice.query(api.queue.status, {});
  if (status.state !== "matched")
    throw new Error(`not matched: ${status.state}`);
  vi.advanceTimersByTime(RULES.countdownMs + CLOCK_SLACK_MS);
  return { alice, bob, matchId: status.matchId };
}

async function claim(player: Player, matchId: Id<"matches">, cells: number[]) {
  for (const cell of cells) {
    const r = await player.mutation(api.matches.enter, {
      matchId,
      cell,
      digit: Number(SOLUTION[cell]),
    });
    expect(r.kind).toBe("claimed");
  }
}

describe("ranked queue", () => {
  afterEach(() => vi.useRealTimers());

  test("two players within the window land in an active rated match", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    await alice.mutation(api.queue.join, {});
    const waiting = await alice.query(api.queue.status, {});
    expect(waiting).toMatchObject({ state: "waiting", rating: RATING.initial });
    await bob.mutation(api.queue.join, {});
    const a = await alice.query(api.queue.status, {});
    const b = await bob.query(api.queue.status, {});
    expect(a.state).toBe("matched");
    expect(b).toEqual(a);
    if (a.state !== "matched") return;
    const view = await alice.query(api.matches.get, { matchId: a.matchId });
    expect(view).toMatchObject({
      status: "active",
      rated: true,
      tier: MATCHMAKING.tier,
      you: 0,
    });
    expect(view!.startsAt! - Date.now()).toBeGreaterThan(0);
    expect(view!.startsAt! - Date.now()).toBeLessThanOrEqual(RULES.countdownMs);
  });

  test("players too far apart wait until the sweep's widening window covers the gap", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    await setRating(t, bob, RATING.initial + 250);
    vi.useFakeTimers();
    await stayOnline(alice);
    await stayOnline(bob);
    await alice.mutation(api.queue.join, {});
    await bob.mutation(api.queue.join, {});
    expect((await alice.query(api.queue.status, {})).state).toBe("waiting");
    vi.advanceTimersByTime(12_000);
    await sweep(t);
    expect((await alice.query(api.queue.status, {})).state).toBe("waiting");
    vi.advanceTimersByTime(4_000);
    await sweep(t);
    expect((await alice.query(api.queue.status, {})).state).toBe("matched");
    expect((await bob.query(api.queue.status, {})).state).toBe("matched");
  });

  test("joining schedules exactly one sweep chain", async () => {
    const t = setup();
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    await setRating(t, bob, 2000);
    await alice.mutation(api.queue.join, {});
    await bob.mutation(api.queue.join, {});
    const sweeps = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(50)).filter(
        (f) => f.name === "queue:sweep" && f.state.kind === "pending",
      ),
    );
    expect(sweeps).toHaveLength(1);
  });

  test("the sweep keeps rescheduling while players beyond one pass still wait", async () => {
    const t = setup();
    const total = MATCHMAKING.maxPerPass + 5;
    await t.run(async (ctx) => {
      const joinedAt = Date.now() - 60_000;
      for (let i = 0; i < total; i++) {
        const userId = await ctx.db.insert("users", {});
        const playerId = await ctx.db.insert("players", {
          kind: "human",
          userId,
          name: `p${i}`,
        });
        await ctx.db.insert("queue", {
          playerId,
          status: "waiting",
          rating: RATING.initial + i * 1000,
          joinedAt: joinedAt + i,
        });
      }
    });
    await sweep(t);
    const { waiting, sweeps } = await t.run(async (ctx) => ({
      waiting: (
        await ctx.db
          .query("queue")
          .withIndex("by_status_and_joinedAt", (q) => q.eq("status", "waiting"))
          .take(total)
      ).length,
      sweeps: (
        await ctx.db.system.query("_scheduled_functions").take(50)
      ).filter((f) => f.name === "queue:sweep" && f.state.kind === "pending")
        .length,
    }));
    expect(waiting).toBe(5);
    expect(sweeps).toBe(1);
  });

  test("cancel leaves the queue", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    await alice.mutation(api.queue.join, {});
    await alice.mutation(api.queue.cancel, {});
    expect(await alice.query(api.queue.status, {})).toEqual({ state: "idle" });
    await bob.mutation(api.queue.join, {});
    expect((await bob.query(api.queue.status, {})).state).toBe("waiting");
  });

  test("a queued player who disconnects is dropped after the grace period", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    vi.useFakeTimers();
    const { sessionToken } = await stayOnline(alice);
    await alice.mutation(api.queue.join, {});
    await alice.mutation(api.presence.disconnect, { sessionToken });
    vi.advanceTimersByTime(MATCHMAKING.disconnectGraceMs - 1_000);
    await sweep(t);
    expect((await alice.query(api.queue.status, {})).state).toBe("waiting");
    vi.advanceTimersByTime(1_000 + CLOCK_SLACK_MS);
    await sweep(t);
    expect(await alice.query(api.queue.status, {})).toEqual({
      state: "dropped",
    });
    await bob.mutation(api.queue.join, {});
    expect((await bob.query(api.queue.status, {})).state).toBe("waiting");
  });

  test("a queued player whose presence never connects is dropped too", async () => {
    const t = setup();
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    await alice.mutation(api.queue.join, {});
    vi.advanceTimersByTime(MATCHMAKING.disconnectGraceMs + CLOCK_SLACK_MS);
    await sweep(t);
    expect(await alice.query(api.queue.status, {})).toEqual({
      state: "dropped",
    });
  });

  test("queue joins are rate limited", async () => {
    const t = setup();
    const alice = await signUp(t, "alice");
    for (let i = 0; i < MATCHMAKING.joinRateLimit.capacity; i++) {
      await alice.mutation(api.queue.join, {});
      await alice.mutation(api.queue.cancel, {});
    }
    await expect(alice.mutation(api.queue.join, {})).rejects.toThrow();
  });

  test("joining again while waiting is a no-op that spends no rate limit", async () => {
    const t = setup();
    const alice = await signUp(t, "alice");
    for (let i = 0; i < MATCHMAKING.joinRateLimit.capacity + 2; i++) {
      await alice.mutation(api.queue.join, {});
    }
    expect((await alice.query(api.queue.status, {})).state).toBe("waiting");
  });

  test("with no bots seeded, a long wait keeps waiting", async () => {
    const t = setup();
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    await stayOnline(alice);
    await alice.mutation(api.queue.join, {});
    vi.advanceTimersByTime(MATCHMAKING.botFallbackAfterMs + 5_000);
    await sweep(t);
    expect((await alice.query(api.queue.status, {})).state).toBe("waiting");
  });

  test("after 20s with no human, a bot from pickForRating gets a rated match", async () => {
    const t = setup({ withBots: true });
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    await signUp(t, "robot");
    await t.run(async (ctx) => {
      const players = await ctx.db.query("players").take(5);
      await ctx.db.patch("players", players[1]._id, { name: "Test Bot" });
    });
    vi.useFakeTimers();
    await stayOnline(alice);
    await alice.mutation(api.queue.join, {});
    vi.advanceTimersByTime(MATCHMAKING.botFallbackAfterMs - 2_000);
    await sweep(t);
    expect((await alice.query(api.queue.status, {})).state).toBe("waiting");
    vi.advanceTimersByTime(2_000 + CLOCK_SLACK_MS);
    await sweep(t);
    const status = await alice.query(api.queue.status, {});
    expect(status.state).toBe("matched");
    if (status.state !== "matched") return;
    const view = await alice.query(api.matches.get, {
      matchId: status.matchId,
    });
    expect(view?.rated).toBe(true);
    expect(view?.participants.map((p) => p.name)).toContain("Test Bot");
    const scheduled = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(50)).map(
        (f) => f.name,
      ),
    );
    expect(scheduled).toContain("bots:onMatchStarted");
  });
});

describe("bot fallback with the real roster", () => {
  afterEach(() => vi.useRealTimers());

  test("after 20s the nearest seeded bot plays a rated match from its seed rating", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.bots.seed, {});
    });
    const alice = await signUp(t, "alice");
    vi.useFakeTimers();
    await stayOnline(alice);
    await alice.mutation(api.queue.join, {});
    vi.advanceTimersByTime(MATCHMAKING.botFallbackAfterMs + CLOCK_SLACK_MS);
    await sweep(t);
    const status = await alice.query(api.queue.status, {});
    if (status.state !== "matched")
      throw new Error(`not matched: ${status.state}`);
    const view = await alice.query(api.matches.get, {
      matchId: status.matchId,
    });
    const bot = view!.participants[1];
    expect(view?.rated).toBe(true);
    expect(bot.name).toBe("Pip");
    await alice.mutation(api.matches.resign, { matchId: status.matchId });
    const after = await alice.query(api.matches.get, {
      matchId: status.matchId,
    });
    expect(after?.ratingChanges).toEqual(
      expect.arrayContaining([
        { playerId: bot.playerId, before: 400, after: 477, delta: 77 },
        expect.objectContaining({ before: 500, after: 423, delta: -77 }),
      ]),
    );
  });
});

describe("ratings", () => {
  afterEach(() => vi.useRealTimers());

  test("a clinch moves both ratings by K/2 and records history", async () => {
    const t = setup();
    const { alice, bob, matchId } = await rankedMatch(t);
    await claim(alice, matchId, [0, 4, 5]);
    const view = await bob.query(api.matches.get, { matchId });
    expect(view?.result).toEqual({ winner: 0, reason: "clinch" });
    const [aliceId, bobId] = [await playerId(alice), await playerId(bob)];
    expect(view?.ratingChanges).toEqual(
      expect.arrayContaining([
        { playerId: aliceId, before: 500, after: 560, delta: 60 },
        { playerId: bobId, before: 500, after: 440, delta: -60 },
      ]),
    );
    expect(await alice.query(api.ratings.mine, {})).toMatchObject({
      rating: 560,
      ratedGames: 1,
      rank: 1,
      percentile: 50,
      total: 2,
    });
    expect(await bob.query(api.ratings.mine, {})).toMatchObject({
      rating: 440,
      ratedGames: 1,
      rank: 2,
      percentile: 0,
    });
    const history = await t.run(
      async (ctx) =>
        await ctx.db
          .query("ratingHistory")
          .withIndex("by_playerId", (q) => q.eq("playerId", aliceId))
          .take(5),
    );
    expect(history).toEqual([
      expect.objectContaining({
        matchId,
        opponentId: bobId,
        ratingBefore: 500,
        ratingAfter: 560,
        delta: 60,
        k: 120,
        score: 1,
      }),
    ]);
  });

  test("a resign is rated as a loss", async () => {
    const t = setup();
    const { alice, bob, matchId } = await rankedMatch(t);
    await alice.mutation(api.matches.resign, { matchId });
    expect((await alice.query(api.ratings.mine, {}))?.rating).toBe(440);
    expect((await bob.query(api.ratings.mine, {}))?.rating).toBe(560);
  });

  test("a full-board draw is half a point", async () => {
    const t = setup();
    const { alice, bob, matchId } = await rankedMatch(t, GIVENS_4);
    await claim(alice, matchId, [0, 4]);
    await claim(bob, matchId, [5, 6]);
    const view = await alice.query(api.matches.get, { matchId });
    expect(view?.result).toEqual({ winner: null, reason: "board_full" });
    expect(await alice.query(api.ratings.mine, {})).toMatchObject({
      rating: 500,
      ratedGames: 1,
    });
    expect(await bob.query(api.ratings.mine, {})).toMatchObject({
      rating: 500,
      ratedGames: 1,
    });
  });

  test("a disconnect forfeit is rated", async () => {
    const t = setup();
    const { alice, bob, matchId } = await rankedMatch(t);
    const aliceId = await playerId(alice);
    await alice.mutation(api.presence.heartbeat, {
      roomId: matchId,
      userId: aliceId,
      sessionId: aliceId,
      interval: 600_000,
    });
    vi.advanceTimersByTime(RULES.disconnectForfeitMs + CLOCK_SLACK_MS);
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.matches.checkForfeits, { matchId });
    });
    const view = await bob.query(api.matches.get, { matchId });
    expect(view?.result).toEqual({ winner: 0, reason: "forfeit_disconnect" });
    expect((await alice.query(api.ratings.mine, {}))?.rating).toBe(560);
    expect((await bob.query(api.ratings.mine, {}))?.rating).toBe(440);
  });

  test("K drops to 20 after 20 rated games", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    await setRating(t, alice, 1200, RATING.provisionalGames);
    await setRating(t, bob, 1200, RATING.provisionalGames - 1);
    vi.useFakeTimers();
    await alice.mutation(api.queue.join, {});
    await bob.mutation(api.queue.join, {});
    const status = await alice.query(api.queue.status, {});
    if (status.state !== "matched") throw new Error("not matched");
    await bob.mutation(api.matches.resign, { matchId: status.matchId });
    expect(await alice.query(api.ratings.mine, {})).toMatchObject({
      rating: 1210,
      ratedGames: RATING.provisionalGames + 1,
    });
    expect((await bob.query(api.ratings.mine, {}))?.rating).toBe(1180);
  });

  test("invite-link matches stay casual", async () => {
    const t = setup();
    await addPuzzles(t, GIVENS_5);
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    const matchId = await alice.mutation(api.matches.create, {});
    if (matchId === null) throw new Error("pool empty");
    await bob.mutation(api.matches.join, { matchId });
    await bob.mutation(api.matches.resign, { matchId });
    const view = await alice.query(api.matches.get, { matchId });
    expect(view).toMatchObject({
      status: "finished",
      rated: false,
      ratingChanges: [],
    });
    expect(await alice.query(api.ratings.mine, {})).toMatchObject({
      rating: RATING.initial,
      ratedGames: 0,
      rank: null,
      total: 0,
    });
  });

  test("the leaderboard lists the top N with tied ranks and the caller's standing", async () => {
    const t = setup();
    const names = ["carol", "alice", "bob", "dave", "erin"];
    const players = await Promise.all(names.map((n) => signUp(t, n)));
    const [carol, alice, bob, dave, erin] = players;
    await setRating(t, carol, 1300);
    await setRating(t, alice, 1250);
    await setRating(t, bob, 1250);
    await setRating(t, dave, 1100);
    const board = await dave.query(api.ratings.leaderboard, { limit: 3 });
    expect(board.top.map((r) => [r.rank, r.rating])).toEqual([
      [1, 1300],
      [2, 1250],
      [2, 1250],
    ]);
    expect(board.me).toMatchObject({
      rating: 1100,
      rank: 4,
      percentile: 0,
      total: 4,
    });
    expect(await alice.query(api.ratings.mine, {})).toMatchObject({
      rank: 2,
      percentile: 25,
    });
    const unrated = await erin.query(api.ratings.leaderboard, {});
    expect(unrated.top).toHaveLength(4);
    expect(unrated.me).toMatchObject({ rating: RATING.initial, rank: null });
  });
});
