import {
  JWT_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
} from "@convex-dev/auth/browser";

const OAUTH_CODE_PARAM = "convexAuthCode";
const OAUTH_ERROR_PARAM = "convexAuthError";

/** How long a sibling tab waits for an active OAuth callback redemption before falling back to guest sign-in. */
export const OAUTH_HANDOFF_TTL_MS = 15_000;

export type OAuthStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

let activeLocalHandoff = false;

function namespaceSuffix(namespace: string): string {
  return namespace.replace(/[^a-zA-Z0-9]/g, "");
}

export function oauthHandoffLeaseKey(namespace: string): string {
  return `comp-sudoku:oauth-handoff:${namespaceSuffix(namespace)}`;
}

function authTokenKeys(namespace: string): {
  jwtKey: string;
  refreshKey: string;
} {
  const suffix = namespaceSuffix(namespace);
  return {
    jwtKey: `${JWT_STORAGE_KEY}_${suffix}`,
    refreshKey: `${REFRESH_TOKEN_STORAGE_KEY}_${suffix}`,
  };
}

/**
 * Prepares browser storage before `<ConvexAuthProvider>` mounts.
 *
 * When returning from Google OAuth with `?convexAuthCode=`, an already-signed-in
 * guest session in localStorage causes Convex's startup auth handshake to fire
 * `refreshSession` for the old guest concurrently with `completeSignInWithGoogle`.
 * Because `setSession` does not acquire the refresh mutex, the slower HTTP guest
 * refresh silently overwrites the newly minted Google session.
 *
 * Clearing the guest tokens synchronously before `AuthClient.init()` reads them
 * prevents the guest refresh from ever starting while preserving instant guest
 * continuity when the user cancels (`?convexAuthError=`) or navigates back.
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
  let params: URLSearchParams;
  try {
    params = new URL(href).searchParams;
  } catch {
    activeLocalHandoff = false;
    return { handlingCallback: false, previousRefreshToken: null };
  }

  const leaseKey = oauthHandoffLeaseKey(namespace);

  if (params.has(OAUTH_CODE_PARAM)) {
    activeLocalHandoff = true;
    try {
      // Publish the cross-tab lease before removing tokens so any other open
      // tab reacting to the storage event pauses guest auto-sign-in.
      storage.setItem(leaseKey, String(now + OAUTH_HANDOFF_TTL_MS));
    } catch {
      // Ignore storage quota / privacy mode errors; single-tab handoff still works.
    }
    const { jwtKey, refreshKey } = authTokenKeys(namespace);
    const previousRefreshToken = storage.getItem(refreshKey);
    storage.removeItem(jwtKey);
    storage.removeItem(refreshKey);
    return { handlingCallback: true, previousRefreshToken };
  }

  activeLocalHandoff = false;
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
