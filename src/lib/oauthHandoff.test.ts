import { afterEach, describe, expect, test, vi } from "vitest";
import {
  AuthClient,
  InMemoryStorage,
  JWT_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from "@convex-dev/auth/browser";
import { oauth } from "@convex-dev/auth/methods/oauth/react";
import {
  OAUTH_HANDOFF_TTL_MS,
  clearOAuthHandoff,
  consumeDisplacedRefreshToken,
  consumeLocalOAuthHandoff,
  oauthHandoffLeaseKey,
  oauthHandoffRemainingMs,
  prepareOAuthCallback,
} from "./oauthHandoff";

const NAMESPACE = "https://gregarious-snail-500.convex.cloud";
const SUFFIX = "httpsgregarioussnail500convexcloud";
const JWT_KEY = `${JWT_STORAGE_KEY}_${SUFFIX}`;
const REFRESH_KEY = `${REFRESH_TOKEN_STORAGE_KEY}_${SUFFIX}`;
const OAUTH_FLOW_KEY = `__convexAuthProvider_oauth_flow_${SUFFIX}`;

const VALID_PENDING_FLOW = JSON.stringify({
  providerName: "google",
  state: "state-1",
  completeSignIn: "auth:completeSignInWithGoogle",
});

function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("prepareOAuthCallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("suspends existing guest tokens before AuthClient.init when a matching pending flow exists", async () => {
    const storage = new InMemoryStorage();
    storage.setItem(JWT_KEY, "GUEST_JWT");
    storage.setItem(REFRESH_KEY, "GUEST_REFRESH");
    storage.setItem(OAUTH_FLOW_KEY, VALID_PENDING_FLOW);

    const callbackHref = "https://ninepop.gg/?convexAuthCode=valid-code";
    const handoff = prepareOAuthCallback({
      href: callbackHref,
      namespace: NAMESPACE,
      storage,
      now: 1_000,
    });

    expect(handoff).toEqual({
      handlingCallback: true,
      previousRefreshToken: "GUEST_REFRESH",
    });
    expect(storage.getItem(JWT_KEY)).toBeNull();
    expect(storage.getItem(REFRESH_KEY)).toBeNull();
    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 1_000)).toBe(
      OAUTH_HANDOFF_TTL_MS,
    );
    expect(consumeDisplacedRefreshToken()).toBe("GUEST_REFRESH");
    expect(consumeDisplacedRefreshToken()).toBeNull();

    vi.stubGlobal("window", {
      location: { href: callbackHref },
      history: { state: null, replaceState: () => {} },
    });

    const refreshSession = vi.fn(async () => ({
      kind: "rotated" as const,
      tokens: {
        accessToken: "REFRESHED_GUEST_JWT",
        refreshToken: "GUEST_REFRESH_2",
        refreshTokenExpiresAt: 9e12,
        userId: "guest-user",
      },
    }));

    const client = new AuthClient({
      mode: "spa",
      storage,
      storageNamespace: NAMESPACE,
      authApi: {
        refreshSession,
        signOut: async () => {},
      },
      ambientSignIns: {
        signIns: [oauth()],
        signInApi: {
          mutation: (async () => {
            await waitFor(25);
            return {
              status: "complete",
              tokens: {
                accessToken: "GOOGLE_JWT",
                refreshToken: "GOOGLE_REFRESH",
                refreshTokenExpiresAt: 9e12,
                userId: "google-user",
              },
            };
          }) as never,
          action: (async () => undefined) as never,
        },
        convex: { mutation: (async () => undefined) as never },
        replaceUrl: () => {},
      },
    });

    await client.init();
    expect(client.getSnapshot()).toEqual({
      isLoading: true,
      isAuthenticated: false,
      token: null,
    });

    await waitFor(60);

    expect(refreshSession).not.toHaveBeenCalled();
    expect(client.getSnapshot()).toEqual({
      isLoading: false,
      isAuthenticated: true,
      token: "GOOGLE_JWT",
    });
    expect(storage.getItem(JWT_KEY)).toBe("GOOGLE_JWT");
    expect(storage.getItem(REFRESH_KEY)).toBe("GOOGLE_REFRESH");
  });

  test("preserves an existing Google session when ?convexAuthCode= arrives with no matching pending flow", () => {
    const storage = new InMemoryStorage();
    storage.setItem(JWT_KEY, "GOOGLE_JWT");
    storage.setItem(REFRESH_KEY, "GOOGLE_REFRESH");

    const handoff = prepareOAuthCallback({
      href: "https://ninepop.gg/?convexAuthCode=bogus",
      namespace: NAMESPACE,
      storage,
      now: 1_000,
    });

    expect(handoff).toEqual({
      handlingCallback: false,
      previousRefreshToken: null,
    });
    expect(storage.getItem(JWT_KEY)).toBe("GOOGLE_JWT");
    expect(storage.getItem(REFRESH_KEY)).toBe("GOOGLE_REFRESH");
    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 1_000)).toBe(0);
    expect(consumeLocalOAuthHandoff()).toBe(false);
    expect(consumeDisplacedRefreshToken()).toBeNull();
  });

  test("preserves existing session when pending flow JSON is malformed", () => {
    const storage = new InMemoryStorage();
    storage.setItem(JWT_KEY, "GOOGLE_JWT");
    storage.setItem(REFRESH_KEY, "GOOGLE_REFRESH");
    storage.setItem(OAUTH_FLOW_KEY, "{not-json");

    const handoff = prepareOAuthCallback({
      href: "https://ninepop.gg/?convexAuthCode=bogus",
      namespace: NAMESPACE,
      storage,
      now: 1_000,
    });

    expect(handoff).toEqual({
      handlingCallback: false,
      previousRefreshToken: null,
    });
    expect(storage.getItem(JWT_KEY)).toBe("GOOGLE_JWT");
    expect(storage.getItem(REFRESH_KEY)).toBe("GOOGLE_REFRESH");
  });

  test("preserves existing guest tokens and clears lease on ?convexAuthError=", () => {
    const storage = new InMemoryStorage();
    storage.setItem(JWT_KEY, "GUEST_JWT");
    storage.setItem(REFRESH_KEY, "GUEST_REFRESH");
    storage.setItem(oauthHandoffLeaseKey(NAMESPACE), String(20_000));

    const handoff = prepareOAuthCallback({
      href: "https://ninepop.gg/?convexAuthError=access_denied",
      namespace: NAMESPACE,
      storage,
      now: 1_000,
    });

    expect(handoff).toEqual({
      handlingCallback: false,
      previousRefreshToken: null,
    });
    expect(storage.getItem(JWT_KEY)).toBe("GUEST_JWT");
    expect(storage.getItem(REFRESH_KEY)).toBe("GUEST_REFRESH");
    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 1_000)).toBe(0);
    expect(consumeLocalOAuthHandoff()).toBe(false);
  });

  test("tracks local handoff consumption and cross-tab lease expiration", () => {
    const storage = new InMemoryStorage();
    storage.setItem(OAUTH_FLOW_KEY, VALID_PENDING_FLOW);
    prepareOAuthCallback({
      href: "https://ninepop.gg/?convexAuthCode=abc",
      namespace: NAMESPACE,
      storage,
      now: 5_000,
    });

    expect(consumeLocalOAuthHandoff()).toBe(true);
    expect(consumeLocalOAuthHandoff()).toBe(false);

    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 10_000)).toBe(10_000);
    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 20_000)).toBe(0);

    clearOAuthHandoff(storage, NAMESPACE);
    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 10_000)).toBe(0);
  });

  test("does not clear another tab's active lease on an unrelated page load", () => {
    const storage = new InMemoryStorage();
    storage.setItem(JWT_KEY, "GUEST_JWT");
    storage.setItem(oauthHandoffLeaseKey(NAMESPACE), String(25_000));

    const handoff = prepareOAuthCallback({
      href: "https://ninepop.gg/leaderboard",
      namespace: NAMESPACE,
      storage,
      now: 10_000,
    });

    expect(handoff).toEqual({
      handlingCallback: false,
      previousRefreshToken: null,
    });
    expect(storage.getItem(JWT_KEY)).toBe("GUEST_JWT");
    expect(oauthHandoffRemainingMs(storage, NAMESPACE, 10_000)).toBe(15_000);
  });
});
