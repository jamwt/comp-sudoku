/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import authCore from "@convex-dev/auth/test";
import authGoogle from "@convex-dev/auth/components/google/test";
import authPassword from "@convex-dev/auth/components/password/test";
import authUsername from "@convex-dev/auth/components/username/test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import * as jevModeration from "./lib/jevModeration";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  vi.stubEnv("CONVEX_CLOUD_URL", "https://test.convex.cloud");
  vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
  vi.stubEnv("AUTH_GOOGLE_CLIENT_ID", "test-google-client-id");
  vi.stubEnv("AUTH_GOOGLE_CLIENT_SECRET", "test-google-client-secret");
  const t = convexTest(schema, modules);
  authCore.registerCore(t);
  authPassword.registerPassword(t);
  authUsername.registerUsername(t);
  authGoogle.registerGoogleOauth(t);
  rateLimiter.register(t);
  return t;
}

async function createGoogleClient(
  t: ReturnType<typeof setup>,
  tag: string,
) {
  const signup = await t.mutation(api.auth.signUpWithUsernamePassword, {
    username: `google_test_${tag}`,
    password: "a-long-test-password-12345",
  });
  if (signup.status !== "complete") throw new Error("signup failed");
  const client = t.withIdentity(authCore.sessionIdentity(signup.tokens));
  const me = await client.query(api.players.me, {});
  if (!me) throw new Error("player missing");
  await t.run(async (ctx) => {
    const player = await ctx.db.get("players", me._id);
    if (!player?.userId) throw new Error("user missing");
    await ctx.db.patch("users", player.userId, {
      provider: "google",
      email: `${tag}@ninepop.gg`,
      name: `Real Name ${tag}`,
    });
  });
  return client;
}

describe("Google OAuth v2", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("createUserGoogle defaults to a random Adjective Animal name instead of the real Google name", async () => {
    const t = setup();
    const userId = await t.mutation(internal.users.createUserGoogle, {
      method: {
        name: "google",
        profile: {
          id: "google-sub-123",
          email: "jamie@ninepop.gg",
          emailVerified: true,
          name: "Jamie Turner",
          picture: "https://lh3.googleusercontent.com/avatar.png",
        },
      },
    });

    const { user, player } = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", userId),
      player: await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
    }));

    expect(user).toMatchObject({
      email: "jamie@ninepop.gg",
      name: "Jamie Turner",
      avatarUrl: "https://lh3.googleusercontent.com/avatar.png",
      provider: "google",
    });
    expect(player?.kind).toBe("human");
    expect(player?.nickname).toBeUndefined();
    expect(player?.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
    expect(player?.name).not.toContain("Jamie");
  });

  test("onSignInGoogle refreshes profile metadata without overwriting custom player nickname", async () => {
    const t = setup();
    const userId = await t.mutation(internal.users.createUserGoogle, {
      method: {
        name: "google",
        profile: {
          id: "google-sub-456",
          email: "old@ninepop.gg",
          emailVerified: true,
          name: "Jamie",
          picture: "https://lh3.googleusercontent.com/old.png",
        },
      },
    });

    await t.run(async (ctx) => {
      const player = await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique();
      await ctx.db.patch("players", player!._id, {
        nickname: "sudokuace",
        name: "sudokuace",
      });
    });

    await t.mutation(internal.users.onSignInGoogle, {
      userId,
      method: {
        name: "google",
        profile: {
          id: "google-sub-456",
          email: "new@ninepop.gg",
          emailVerified: true,
          name: "Jamie Updated",
          picture: "https://lh3.googleusercontent.com/new.png",
        },
      },
    });

    const { user, player } = await t.run(async (ctx) => ({
      user: await ctx.db.get("users", userId),
      player: await ctx.db
        .query("players")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
    }));
    expect(user?.email).toBe("new@ninepop.gg");
    expect(user?.avatarUrl).toBe("https://lh3.googleusercontent.com/new.png");
    expect(player?.nickname).toBe("sudokuace");
    expect(player?.name).toBe("sudokuace");
  });

  test("players.me distinguishes guest sessions from Google sessions", async () => {
    const t = setup();
    const signup = await t.mutation(api.auth.signUpWithUsernamePassword, {
      username: "guest_check",
      password: "a-long-guest-password-123",
    });
    if (signup.status !== "complete") throw new Error("guest sign-up failed");
    const guestClient = t.withIdentity(authCore.sessionIdentity(signup.tokens));
    const guestMe = await guestClient.query(api.players.me, {});
    expect(guestMe).toMatchObject({
      isGuest: true,
      nickname: null,
      email: null,
      avatarUrl: null,
    });
  });

  test("startSignInWithGoogle rejects disallowed redirect origins", async () => {
    const t = setup();
    await expect(
      t.mutation(api.auth.startSignInWithGoogle, {
        redirectTo: "https://evil.example.com/",
      }),
    ).rejects.toThrow(/allowedRedirectOrigins/);
  });
});

describe("exclusive moderated nicknames", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  test("rejects guest accounts without calling Jev moderation", async () => {
    const t = setup();
    const modSpy = vi.spyOn(jevModeration, "moderateNicknameWithJev");
    const signup = await t.mutation(api.auth.signUpWithUsernamePassword, {
      username: "guest_nick_denied",
      password: "a-long-guest-password-123",
    });
    if (signup.status !== "complete") throw new Error("guest sign-up failed");
    const guest = t.withIdentity(authCore.sessionIdentity(signup.tokens));

    await expect(
      guest.action(api.players.setNickname, { nickname: "sudokupop" }),
    ).rejects.toThrow(/Sign in with Google/i);
    expect(modSpy).not.toHaveBeenCalled();
  });

  test("enforces uniqueness via by_nickname and releases the old handle on rename", async () => {
    const t = setup();
    const modSpy = vi
      .spyOn(jevModeration, "moderateNicknameWithJev")
      .mockResolvedValue({
        allowed: true,
        scores: { profanityOrSlur: 0.01, sexualOrAbusive: 0.01 },
      });

    const alice = await createGoogleClient(t, "alice");
    const bob = await createGoogleClient(t, "bob");

    expect(
      await alice.action(api.players.setNickname, { nickname: "Alice99" }),
    ).toEqual({ nickname: "alice99" });
    expect(await alice.query(api.players.me, {})).toMatchObject({
      name: "alice99",
      nickname: "alice99",
      isGuest: false,
    });
    expect(modSpy).toHaveBeenCalledTimes(1);

    // Same nickname again is a no-op (no extra Jev call).
    expect(
      await alice.action(api.players.setNickname, { nickname: "alice99" }),
    ).toEqual({ nickname: "alice99" });
    expect(modSpy).toHaveBeenCalledTimes(1);

    // Bob cannot claim alice99 while Alice holds it (fails before Jev).
    await expect(
      bob.action(api.players.setNickname, { nickname: "alice99" }),
    ).rejects.toThrow(/already taken/i);
    expect(modSpy).toHaveBeenCalledTimes(1);

    // Alice changes to a new handle, releasing alice99 for Bob.
    await alice.action(api.players.setNickname, { nickname: "gridwizard" });
    expect(
      await bob.action(api.players.setNickname, { nickname: "alice99" }),
    ).toEqual({ nickname: "alice99" });
    expect(await bob.query(api.players.me, {})).toMatchObject({
      name: "alice99",
      nickname: "alice99",
    });
  });

  test("blocks nicknames rejected by Jev moderation and leaves prior name untouched", async () => {
    const t = setup();
    vi.spyOn(jevModeration, "moderateNicknameWithJev").mockResolvedValue({
      allowed: false,
      scores: { profanityOrSlur: 0.96, sexualOrAbusive: 0.1 },
    });

    const alice = await createGoogleClient(t, "blocked");
    const before = await alice.query(api.players.me, {});

    await expect(
      alice.action(api.players.setNickname, { nickname: "badword99" }),
    ).rejects.toThrow(/isn't allowed/i);

    const after = await alice.query(api.players.me, {});
    expect(after?.name).toBe(before?.name);
    expect(after?.nickname).toBeNull();
  });

  test("rate limits repeated nickname attempts", async () => {
    const t = setup();
    vi.spyOn(jevModeration, "moderateNicknameWithJev").mockResolvedValue({
      allowed: true,
      scores: { profanityOrSlur: 0.01, sexualOrAbusive: 0.01 },
    });

    const alice = await createGoogleClient(t, "ratelimit");
    for (let i = 1; i <= 5; i++) {
      await alice.action(api.players.setNickname, {
        nickname: `player0${i}`,
      });
    }
    await expect(
      alice.action(api.players.setNickname, { nickname: "player06" }),
    ).rejects.toThrow(/Too many nickname attempts/i);
  });
});
