import { useEffect, useRef, useState } from "react";
import { useConvex, useConvexAuth } from "convex/react";
import {
  useSignInWithUsernamePassword,
  useSignUpWithUsernamePassword,
} from "@convex-dev/auth/methods/username-password/react";
import { api } from "../../convex/_generated/api";
import {
  clearOAuthHandoff,
  consumeLocalOAuthHandoff,
  oauthHandoffLeaseKey,
  oauthHandoffRemainingMs,
} from "@/lib/oauthHandoff";

type Credentials = { username: string; password: string };

const STORAGE_KEY = `comp-sudoku:guest:${import.meta.env.VITE_CONVEX_URL}`;

function randomToken(length: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function loadCredentials(): Credentials | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Credentials;
  } catch {
    return null;
  }
}

/**
 * Guest sign-in on top of Convex Auth's username + password method: the first
 * visit mints random credentials and keeps them in localStorage, so the same
 * browser returns as the same guest even after its session expires.
 */
export function useGuestSession(): { ready: boolean; error: string | null } {
  const convex = useConvex();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const { signIn } = useSignInWithUsernamePassword(api.auth);
  const { signUp } = useSignUpWithUsernamePassword(api.auth);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [handoffTick, setHandoffTick] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      started.current = false;
      clearOAuthHandoff(window.localStorage, convex.url);
      return;
    }
    if (isLoading || started.current) return;

    if (consumeLocalOAuthHandoff()) {
      clearOAuthHandoff(window.localStorage, convex.url);
    } else {
      const remaining = oauthHandoffRemainingMs(
        window.localStorage,
        convex.url,
      );
      if (remaining > 0) {
        const leaseKey = oauthHandoffLeaseKey(convex.url);
        const wake = () => setHandoffTick((n) => n + 1);
        const timer = window.setTimeout(wake, remaining);
        const onStorage = (e: StorageEvent) => {
          if (e.key === leaseKey && e.newValue === null) wake();
        };
        window.addEventListener("storage", onStorage);
        return () => {
          window.clearTimeout(timer);
          window.removeEventListener("storage", onStorage);
        };
      }
    }

    started.current = true;
    void (async () => {
      const saved = loadCredentials();
      if (saved) {
        const result = await signIn(saved);
        if (result.status === "complete") return;
        if (result.userError.error !== "USER_NOT_FOUND") {
          setError(
            "Could not restore your guest session. Reload to try again.",
          );
          started.current = false;
          return;
        }
      }
      const fresh = {
        username: `guest_${randomToken(16)}`,
        password: randomToken(32),
      };
      const result = await signUp(fresh);
      if (result.status === "complete") {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
      } else {
        setError("Could not create a guest session. Reload to try again.");
        started.current = false;
      }
    })();
  }, [convex.url, isLoading, isAuthenticated, signIn, signUp, handoffTick]);

  return { ready: isAuthenticated, error };
}
