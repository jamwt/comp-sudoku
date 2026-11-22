import {
  JWT_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from "@convex-dev/auth/browser";

const OAUTH_CODE_PARAM = "convexAuthCode";
const OAUTH_ERROR_PARAM = "convexAuthError";
const OAUTH_FLOW_PREFIX = "__convexAuthProvider_oauth_flow";

/** How long a sibling tab waits for an active OAuth callback redemption before falling back to guest sign-in. */
export const OAUTH_HANDOFF_TTL_MS = 15_000;

export type OAuthStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let activeLocalHandoff = false;
let displacedRefreshToken: string | null = null;

function namespaceSuffix(namespace: string): string {
  return namespace.replace(/[^a-zA-Z0-9]/g, "");
}

export function oauthHandoffLeaseKey(namespace: string): string {
  return `comp-sudoku:oauth-handoff:${namespaceSuffix(namespace)}`;
}

function authTokenKeys(namespace: string): {
  jwtKey: string;
  refreshKey: string;
  oauthFlowKey: string;
} {
  const suffix = namespaceSuffix(namespace);
  return {
    jwtKey: `${JWT_STORAGE_KEY}_${suffix}`,
    refreshKey: `${REFRESH_TOKEN_STORAGE_KEY}_${suffix}`,
    oauthFlowKey: `${OAUTH_FLOW_PREFIX}_${suffix}`,
  };
}

function hasPendingOAuthFlow(
  storage: Pick<Storage, "getItem">,
  oauthFlowKey: string,
): boolean {
  const raw = storage.getItem(oauthFlowKey);
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw) as {
      providerName?: unknown;
      state?: unknown;
      completeSignIn?: unknown;
    };
    return (
      typeof parsed.providerName === "string" &&
      typeof parsed.state === "string" &&
      typeof parsed.completeSignIn === "string"
    );
  } catch {
    return false;
  }
}

/**
 * Prepares browser storage before `<ConvexAuthProvider>` mounts.
 *
 * When returning from Google OAuth with `?convexAuthCode=` and a matching
 * pending flow saved by this browser, an already-signed-in session in
 * localStorage causes Convex's startup auth handshake to fire `refreshSession`
 * for the old session concurrently with `completeSignInWithGoogle`. Because
 * `setSession` does not acquire the refresh mutex, the slower HTTP refresh
 * silently overwrites the newly minted Google session.
 *
 * Suspending the old tokens synchronously before `AuthClient.init()` reads them
 * prevents that race, while requiring a valid pending flow ensures unsolicited
 * or stale `/?convexAuthCode=` links never disrupt an active Google session.
 * The displaced refresh token is kept in memory so it is only revoked after the
 * new session is established, or rotated back in if redemption fails.
 */
export function prepareOAuthCallback({
  href,
  namespace,
  storage,
  now = Date.now(),
}: {
  href: string;
  namespace: string;
  storage: OAuthStorage;
  now?: number;
}): { handlingCallback: boolean; previousRefreshToken: string | null } {
  activeLocalHandoff = false;
  displacedRefreshToken = null;

  let params: URLSearchParams;
  try {
    params = new URL(href).searchParams;
  } catch {
    return { handlingCallback: false, previousRefreshToken: null };
  }

  const leaseKey = oauthHandoffLeaseKey(namespace);
  const { jwtKey, refreshKey, oauthFlowKey } = authTokenKeys(namespace);

  if (params.has(OAUTH_CODE_PARAM) && hasPendingOAuthFlow(storage, oauthFlowKey)) {
    activeLocalHandoff = true;
    try {
      // Publish the cross-tab lease before removing tokens so any other open
      // tab reacting to the storage event pauses guest auto-sign-in.
      storage.setItem(leaseKey, String(now + OAUTH_HANDOFF_TTL_MS));
    } catch {
      // Ignore storage quota / privacy mode errors; single-tab handoff still works.
    }
    const previousRefreshToken = storage.getItem(refreshKey);
    displacedRefreshToken = previousRefreshToken;
    storage.removeItem(jwtKey);
    storage.removeItem(refreshKey);
    return { handlingCallback: true, previousRefreshToken };
  }

  if (params.has(OAUTH_ERROR_PARAM)) {
    try {
      storage.removeItem(leaseKey);
    } catch {
      // Ignore storage errors.
    }
  }
  return { handlingCallback: false, previousRefreshToken: null };
}

export function oauthHandoffRemainingMs(
  storage: Pick<Storage, "getItem">,
  namespace: string,
  now = Date.now(),
): number {
  const raw = storage.getItem(oauthHandoffLeaseKey(namespace));
  if (!raw) return 0;
  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return 0;
  return expiresAt - now;
}

export function consumeLocalOAuthHandoff(): boolean {
  if (!activeLocalHandoff) return false;
  activeLocalHandoff = false;
  return true;
}

export function consumeDisplacedRefreshToken(): string | null {
  const token = displacedRefreshToken;
  displacedRefreshToken = null;
  return token;
}

export function clearOAuthHandoff(
  storage: Pick<Storage, "removeItem">,
  namespace: string,
): void {
  activeLocalHandoff = false;
  try {
    storage.removeItem(oauthHandoffLeaseKey(namespace));
  } catch {
    // Ignore storage errors.
  }
}
