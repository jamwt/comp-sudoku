import { components, internal } from "./_generated/api";
import { env } from "./_generated/server";
import { setupConvexAuth } from "@convex-dev/auth/server";
import { setupGoogle } from "@convex-dev/auth/methods/google/server";
import { setupUsernamePassword } from "@convex-dev/auth/methods/username-password/server";

const auth = setupConvexAuth({ component: components.auth });

export const { signOut, refreshSession, isAuthenticated } = auth;

export const { signUpWithUsernamePassword, signInWithUsernamePassword } =
  setupUsernamePassword(auth, {
    component: components.authPassword,
    usernameComponent: components.authUsername,
  }).attachUserCallbacks({ createUser: internal.users.createUser });

function buildAllowedRedirectOrigins(): string[] {
  const origins = new Set<string>([
    "https://ninepop.gg",
    "http://localhost:5173",
  ]);
  try {
    const siteUrl = env.CONVEX_SITE_URL;
    if (siteUrl) origins.add(new URL(siteUrl).origin);
  } catch {
    // Ignore unset or malformed CONVEX_SITE_URL in tests or non-standard environments.
  }
  return [...origins];
}

export const { startSignInWithGoogle, completeSignInWithGoogle } = setupGoogle(
  auth,
  {
    component: components.authGoogle,
    allowedRedirectOrigins: buildAllowedRedirectOrigins(),
  },
).attachUserCallbacks({
  createUser: internal.users.createUserGoogle,
  onSignIn: internal.users.onSignInGoogle,
});
