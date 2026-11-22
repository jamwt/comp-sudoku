/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import authCore from "@convex-dev/auth/test";
import authGoogle from "@convex-dev/auth/components/google/test";
import authPassword from "@convex-dev/auth/components/password/test";
import authUsername from "@convex-dev/auth/components/username/test";
import { api, internal } from "./_generated/api";
import schema from "./schema";

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
  return t;
}

describe("Google OAuth v2", () => {
  beforeEach(() => vi.useRealTimers());
  afterEach(() => vi.unstubAllEnvs());

  test("createUserGoogle creates a Google-backed user and player with sanitized name", async () => {
    const t = setup();
    const userId = await t.mutation(internal.users.createUserGoogle, {
      method: {
        name: "google",
        profile: {
          id: "google-sub-123",
          email: "jamie@ninepop.gg",
          emailVerified: true,
          name: "  Jamie Turner With A Really Long Display Name  ",
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
      avatarUrl: "https://lh3.googleusercontent.com/avatar.png",
      provider: "google",
    });
    expect(player?.kind).toBe("human");
    expect(player?.name).toBe("Jamie Turner With A Real");
    expect(player!.name.length).toBeLessThanOrEqual(24);
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
      await ctx.db.patch("players", player!._id, { name: "SudokuAce" });
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
    expect(player?.name).toBe("SudokuAce");
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
