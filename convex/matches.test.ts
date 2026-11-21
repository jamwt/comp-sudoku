/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import authCore from "@convex-dev/auth/test";
import authPassword from "@convex-dev/auth/components/password/test";
import authUsername from "@convex-dev/auth/components/username/test";
import presence from "@convex-dev/presence/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import workpool from "@convex-dev/workpool/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { RULES } from "./gameConfig";

const modules = import.meta.glob("./**/*.ts");
const CLOCK_SLACK_MS = 100;

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const GIVENS = "0" + SOLUTION.slice(1, 4) + "0".repeat(4) + SOLUTION.slice(8);

function setup() {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  const t = convexTest(schema, modules);
  authCore.registerCore(t);
  authPassword.registerPassword(t);
  authUsername.registerUsername(t);
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

async function startMatch(t: T) {
  await t.run(async (ctx) => {
    await ctx.db.insert("puzzles", {
      givens: GIVENS,
      solution: SOLUTION,
      tier: "easy",
      hardest: "nakedSingle",
      clueCount: 76,
      status: "available",
    });
  });
  const alice = await signUp(t, "alice");
  const bob = await signUp(t, "bob");
  vi.useFakeTimers();
  const matchId = await alice.mutation(api.matches.create, { tier: "easy" });
  if (matchId === null) throw new Error("pool empty");
  await bob.mutation(api.matches.join, { matchId });
  vi.advanceTimersByTime(RULES.countdownMs + CLOCK_SLACK_MS);
  return { alice, bob, matchId };
}

describe("matches", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.useRealTimers());

  test("the match view never includes the solution", async () => {
    const t = setup();
    const { alice, matchId } = await startMatch(t);
    const view = await alice.query(api.matches.get, { matchId });
    expect(view?.status).toBe("active");
    expect(view?.you).toBe(0);
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain(SOLUTION);
    expect(view).not.toHaveProperty("puzzleId");
    expect(view?.board).toBe(GIVENS);
  });

  test("the puzzle is drawn from the pool and marked used", async () => {
    const t = setup();
    await startMatch(t);
    const statuses = await t.run(async (ctx) =>
      (await ctx.db.query("puzzles").take(10)).map((p) => p.status),
    );
    expect(statuses).toEqual(["used"]);
  });

  test("an empty pool returns null and keeps the scheduled refill", async () => {
    const t = setup();
    const alice = await signUp(t, "alice");
    expect(
      await alice.mutation(api.matches.create, { tier: "hard" }),
    ).toBeNull();
    const scheduled = await t.run(async (ctx) =>
      (await ctx.db.system.query("_scheduled_functions").take(10)).map(
        (f) => f.name,
      ),
    );
    expect(scheduled).toContain("puzzles:topUp");
  });

  test("entries before the countdown ends are rejected", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      await ctx.db.insert("puzzles", {
        givens: GIVENS,
        solution: SOLUTION,
        tier: "easy",
        hardest: "nakedSingle",
        clueCount: 76,
        status: "available",
      });
    });
    const alice = await signUp(t, "alice");
    const bob = await signUp(t, "bob");
    vi.useFakeTimers();
    const matchId = await alice.mutation(api.matches.create, {});
    if (matchId === null) throw new Error("pool empty");
    await bob.mutation(api.matches.join, { matchId });
    const r = await alice.mutation(api.matches.enter, {
      matchId,
      cell: 0,
      digit: 5,
    });
    expect(r.kind).toBe("not_started");
  });

  test("first correct commit claims the cell; the other player sees it taken", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    expect(
      await bob.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 }),
    ).toMatchObject({
      kind: "claimed",
      ended: false,
    });
    expect(
      await alice.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 }),
    ).toEqual({
      kind: "taken",
      cell: 0,
    });
    const view = await alice.query(api.matches.get, { matchId });
    expect(view?.owners[0]).toBe("1");
    expect(view?.participants.map((p) => p.cells)).toEqual([0, 1]);
  });

  test("a wrong digit locks the player out", async () => {
    const t = setup();
    const { alice, matchId } = await startMatch(t);
    const wrong = await alice.mutation(api.matches.enter, {
      matchId,
      cell: 0,
      digit: 1,
    });
    expect(wrong).toMatchObject({
      kind: "wrong",
      lockoutMs: RULES.wrongEntryLockoutMs,
    });
    const locked = await alice.mutation(api.matches.enter, {
      matchId,
      cell: 0,
      digit: 5,
    });
    expect(locked.kind).toBe("locked");
    vi.advanceTimersByTime(RULES.wrongEntryLockoutMs + CLOCK_SLACK_MS);
    const ok = await alice.mutation(api.matches.enter, {
      matchId,
      cell: 0,
      digit: 5,
    });
    expect(ok.kind).toBe("claimed");
  });

  test("holding more than half the empty cells ends the match", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    const cells = [0, 4, 5, 6, 7];
    await alice.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 });
    await bob.mutation(api.matches.enter, { matchId, cell: 4, digit: 7 });
    await alice.mutation(api.matches.enter, { matchId, cell: 5, digit: 8 });
    const r = await alice.mutation(api.matches.enter, {
      matchId,
      cell: 6,
      digit: 9,
    });
    expect(r).toMatchObject({ kind: "claimed", ended: true });
    const view = await bob.query(api.matches.get, { matchId });
    expect(view?.status).toBe("finished");
    expect(view?.result).toEqual({ winner: 0, reason: "clinch" });
    expect(cells.length).toBe(view?.emptyCount);
    expect(
      await bob.mutation(api.matches.enter, { matchId, cell: 7, digit: 1 }),
    ).toEqual({
      kind: "not_active",
    });
  });

  test("resigning is a loss", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    await bob.mutation(api.matches.resign, { matchId });
    const view = await alice.query(api.matches.get, { matchId });
    expect(view?.result).toEqual({ winner: 0, reason: "resign" });
  });

  test("notes are private to each player", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    await alice.mutation(api.notes.toggle, { matchId, cell: 0, digit: 3 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 0, digit: 5 });
    const mine = await alice.query(api.notes.mine, { matchId });
    expect(mine?.[0]).toBe((1 << 2) | (1 << 4));
    expect(await bob.query(api.notes.mine, { matchId })).toBeNull();
    const view = await bob.query(api.matches.get, { matchId });
    expect(JSON.stringify(view)).not.toContain("marks");
  });

  test("a valid placement clears conflicting peer notes for both players, while wrong entries do not", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    // SOLUTION row 0: cell 0 = 5, cell 4 = 7, cell 5 = 8, cell 6 = 9, cell 7 = 1.
    // Alice puts notes on cell 0 ({5, 6}), row-peer cell 4 ({5, 7, 8}), and non-peer cell 40 ({5, 7}).
    await alice.mutation(api.notes.toggle, { matchId, cell: 0, digit: 5 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 0, digit: 6 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 4, digit: 5 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 4, digit: 7 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 4, digit: 8 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 40, digit: 5 });
    await alice.mutation(api.notes.toggle, { matchId, cell: 40, digit: 7 });

    // Bob puts notes on row-peer cell 5 ({5, 8, 9}) and cell 0 ({5, 9}).
    await bob.mutation(api.notes.toggle, { matchId, cell: 5, digit: 5 });
    await bob.mutation(api.notes.toggle, { matchId, cell: 5, digit: 8 });
    await bob.mutation(api.notes.toggle, { matchId, cell: 5, digit: 9 });
    await bob.mutation(api.notes.toggle, { matchId, cell: 0, digit: 5 });
    await bob.mutation(api.notes.toggle, { matchId, cell: 0, digit: 9 });

    // A wrong entry by Alice (digit 6 at cell 0, where solution is 5) must NOT prune any notes.
    const wrong = await alice.mutation(api.matches.enter, {
      matchId,
      cell: 0,
      digit: 6,
    });
    expect(wrong.kind).toBe("wrong");
    const aliceAfterWrong = await alice.query(api.notes.mine, { matchId });
    expect(aliceAfterWrong?.[0]).toBe((1 << 4) | (1 << 5));
    expect(aliceAfterWrong?.[4]).toBe((1 << 4) | (1 << 6) | (1 << 7));

    // Bob enters the correct digit 5 at cell 0 (opponent claim!).
    // Both Bob's AND Alice's conflicting notes must be pruned, while non-peers stay intact.
    const claimed = await bob.mutation(api.matches.enter, {
      matchId,
      cell: 0,
      digit: 5,
    });
    expect(claimed).toMatchObject({ kind: "claimed", cell: 0, digit: 5 });

    const aliceAfter = await alice.query(api.notes.mine, { matchId });
    expect(aliceAfter?.[0]).toBe(0); // claimed cell cleared
    expect(aliceAfter?.[4]).toBe((1 << 6) | (1 << 7)); // dropped 5, kept {7, 8}
    expect(aliceAfter?.[40]).toBe((1 << 4) | (1 << 6)); // non-peer untouched ({5, 7})

    const bobAfter = await bob.query(api.notes.mine, { matchId });
    expect(bobAfter?.[0]).toBe(0); // claimed cell cleared
    expect(bobAfter?.[5]).toBe((1 << 7) | (1 << 8)); // dropped 5, kept {8, 9}
  });

  test("outsiders cannot play", async () => {
    const t = setup();
    const { matchId } = await startMatch(t);
    vi.useRealTimers();
    const carol = await signUp(t, "carol");
    await expect(
      carol.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 }),
    ).rejects.toThrow();
    await expect(
      carol.mutation(api.matches.join, { matchId }),
    ).rejects.toThrow();
  });

  test("an idle player forfeits", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    for (const player of [alice, bob]) {
      const me = await player.query(api.players.me);
      await player.mutation(api.presence.heartbeat, {
        roomId: matchId,
        userId: me!._id,
        sessionId: me!._id,
        interval: 10 * RULES.idleForfeitMs,
      });
    }
    vi.advanceTimersByTime(RULES.idleForfeitMs - 5_000);
    await alice.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 });
    vi.advanceTimersByTime(5_000 + CLOCK_SLACK_MS);
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.matches.checkForfeits, { matchId });
    });
    const view = await bob.query(api.matches.get, { matchId });
    expect(view?.result).toEqual({ winner: 0, reason: "forfeit_idle" });
  });
});

describe("forfeits", () => {
  afterEach(() => vi.useRealTimers());

  test("a player who never connects forfeits for disconnecting", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    const me = await alice.query(api.players.me);
    await alice.mutation(api.presence.heartbeat, {
      roomId: matchId,
      userId: me!._id,
      sessionId: me!._id,
      interval: 10 * RULES.idleForfeitMs,
    });
    vi.advanceTimersByTime(5_000);
    await alice.mutation(api.matches.enter, { matchId, cell: 0, digit: 5 });
    vi.advanceTimersByTime(RULES.disconnectForfeitMs - 5_000);
    await t.run(async (ctx) => {
      await ctx.runMutation(internal.matches.checkForfeits, { matchId });
    });
    const view = await bob.query(api.matches.get, { matchId });
    expect(view?.result).toEqual({ winner: 0, reason: "forfeit_disconnect" });
  });

  test("presence heartbeats are refused for someone else's player id", async () => {
    const t = setup();
    const { alice, bob, matchId } = await startMatch(t);
    const bobPlayer = await bob.query(api.players.me);
    await expect(
      alice.mutation(api.presence.heartbeat, {
        roomId: matchId,
        userId: bobPlayer!._id,
        sessionId: "x",
        interval: 5_000,
      }),
    ).rejects.toThrow();
  });
});

describe("puzzle pool", () => {
  test("overlapping top-ups never fill a tier past its target", async () => {
    const t = setup();
    const target = RULES.puzzlePool.targetPerTier.easy;
    const batch = Array.from({ length: target }, () => ({
      givens: GIVENS,
      solution: SOLUTION,
      tier: "easy" as const,
      hardest: "nakedSingle",
      clueCount: 76,
    }));
    await t.mutation(internal.puzzles.insertMany, { puzzles: batch });
    await t.mutation(internal.puzzles.insertMany, { puzzles: batch });
    const easy = await t.run(async (ctx) =>
      ctx.db
        .query("puzzles")
        .withIndex("by_tier_and_status", (q) =>
          q.eq("tier", "easy").eq("status", "available"),
        )
        .collect(),
    );
    expect(easy).toHaveLength(target);
  });
});
