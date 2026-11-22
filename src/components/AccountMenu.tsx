import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  useOauth,
  useSignInWithGoogle,
} from "@convex-dev/auth/methods/google/react";
import { api } from "../../convex/_generated/api";
import { PlayerAvatar } from "@/components/Avatars";
import { NicknameDialog } from "@/components/NicknameDialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { sound } from "@/lib/sound";

export function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden="true"
    >
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.55-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29A7.2 7.2 0 0 1 4.9 12c0-.79.14-1.56.38-2.29v-3.1H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.76c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.28 6.61l4 3.1C6.23 6.87 8.88 4.76 12 4.76z"
      />
    </svg>
  );
}

const AVATAR_SIZE: Record<"xs" | "sm" | "md" | "lg", string> = {
  xs: "h-6 w-6 rounded-md border-[1.5px]",
  sm: "h-8 w-8 rounded-lg border-2",
  md: "h-10 w-10 rounded-xl border-2",
  lg: "h-12 w-12 rounded-xl border-2",
};

/** Renders a Google profile photo when present, falling back to the tactile PlayerAvatar. */
export function UserAvatar({
  name,
  avatarUrl,
  size = "sm",
  className,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  if (avatarUrl && !imgFailed) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={cn(
          "shrink-0 border-ink bg-card object-cover shadow-toy-xs",
          AVATAR_SIZE[size],
          className,
        )}
      />
    );
  }
  return <PlayerAvatar name={name} isBot={false} size={size} className={className} />;
}

export function GoogleSignInButton({
  label = "Continue with Google",
  size = "sm",
  variant = "outline",
  className,
  onError,
}: {
  label?: string;
  size?: "sm" | "default" | "lg";
  variant?: "outline" | "default" | "secondary";
  className?: string;
  onError?: (msg: string) => void;
}) {
  const { signIn } = useSignInWithGoogle(api.auth);
  const [pending, setPending] = useState(false);

  async function onClick() {
    sound.playTap();
    setPending(true);
    const result = await signIn();
    if (result.status === "error") {
      setPending(false);
      onError?.("Could not start Google sign-in. Try again in a moment.");
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() => void onClick()}
      className={cn("gap-2", className)}
      data-testid="google-signin"
    >
      <GoogleIcon />
      <span>{pending ? "Connecting to Google…" : label}</span>
    </Button>
  );
}

/** Shows a dismissible banner if a returning Google OAuth flow failed or was cancelled. */
export function OAuthErrorBanner() {
  const { flowError } = useOauth();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [flowError]);

  if (!flowError || dismissed) return null;

  const message =
    flowError.error === "ACCESS_DENIED"
      ? "Google sign-in was cancelled. You're still playing as a guest."
      : flowError.error === "EXPIRED"
        ? "That Google sign-in link expired. Please try signing in again."
        : flowError.error === "INVALID_FLOW"
          ? "Could not match that Google sign-in attempt to this browser tab. Try again."
          : "Google sign-in hit a snag. Please try again.";

  return (
    <div
      role="status"
      data-testid="oauth-error"
      className="mb-3 flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-destructive/15 px-3.5 py-2 text-xs font-semibold text-destructive sm:text-sm"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss sign-in error"
        className="rounded-md px-1.5 py-0.5 text-xs font-bold hover:bg-destructive/15"
      >
        ✕
      </button>
    </div>
  );
}

/** Header account trigger & dropdown: shows guest sign-in or Google profile + sign-out. */
export function AccountMenu() {
  const me = useQuery(api.players.me);
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [nicknameOpen, setNicknameOpen] = useState(false);

  if (!me) return null;

  async function onSignOut() {
    sound.playTap();
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <>
      <DropdownMenu
        onOpenChange={(open) => {
          if (open) {
            sound.playTap();
            setStartError(null);
          }
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title={me.isGuest ? `${me.name} (Guest) — Sign in` : me.name}
            data-testid="account-menu-trigger"
            className="toy-key inline-flex h-9 items-center gap-2 rounded-xl bg-secondary/85 px-2 text-xs font-bold text-foreground hover:bg-accent sm:px-2.5"
          >
            <UserAvatar name={me.name} avatarUrl={me.avatarUrl} size="xs" />
            <span
              className="hidden max-w-[116px] truncate sm:inline"
              data-testid="player-name"
            >
              {me.name}
            </span>
            {me.isGuest ? (
              <span className="rounded-md border border-ink/40 bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary-foreground">
                Sign in
              </span>
            ) : (
              <GoogleIcon className="hidden h-3.5 w-3.5 sm:inline-block" />
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="end"
          className="w-64 rounded-2xl border-2 border-ink bg-card p-2 shadow-toy-md"
        >
          <div className="flex items-center gap-2.5 px-2 py-2">
            <UserAvatar name={me.name} avatarUrl={me.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-bold text-foreground">
                {me.name}
              </p>
              <p className="truncate text-[11px] font-medium text-muted-foreground">
                {me.isGuest ? "Guest account" : (me.email ?? "Google account")}
              </p>
            </div>
          </div>

          <DropdownMenuSeparator className="bg-ink/15" />

          {me.isGuest ? (
            <div className="space-y-2 p-1.5">
              <p className="text-[11px] font-medium leading-snug text-muted-foreground">
                Sign in with Google to claim an exclusive nickname and save your
                ranked Elo across devices.
              </p>
              <GoogleSignInButton
                className="w-full"
                size="sm"
                variant="default"
                onError={setStartError}
              />
              {startError && (
                <p className="text-[11px] font-semibold text-destructive">
                  {startError}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-1 space-y-1">
              <DropdownMenuItem
                onSelect={() => {
                  sound.playTap();
                  setNicknameOpen(true);
                }}
                data-testid="menu-nickname"
                className="cursor-pointer rounded-xl font-display text-xs font-bold text-foreground focus:bg-accent"
              >
                {me.nickname ? "Change nickname" : "Choose nickname"}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={signingOut}
                onSelect={(e) => {
                  e.preventDefault();
                  void onSignOut();
                }}
                data-testid="sign-out"
                className="cursor-pointer rounded-xl font-display text-xs font-bold text-destructive focus:bg-destructive/15 focus:text-destructive"
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </DropdownMenuItem>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {!me.isGuest && (
        <NicknameDialog
          open={nicknameOpen}
          onOpenChange={setNicknameOpen}
          currentNickname={me.nickname}
          currentName={me.name}
        />
      )}
    </>
  );
}
