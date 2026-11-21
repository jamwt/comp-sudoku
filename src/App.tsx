import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useGuestSession } from "@/lib/guest";
import { navigate, usePathname } from "@/lib/router";
import { Home } from "@/pages/Home";
import { MatchPage } from "@/pages/MatchPage";
import { Leaderboard } from "@/pages/Leaderboard";
import { QueueWatcher } from "@/pages/Ranked";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SoundToggle } from "@/components/SoundToggle";
import { HelpModal } from "@/components/HelpModal";
import { NinepopMark, NinepopWordmark } from "@/components/NinepopLogo";
import { PlayerAvatar } from "@/components/Avatars";
import { isHelpToggleEvent } from "@/lib/keyboard";
import { cn } from "@/lib/utils";
import { sound } from "@/lib/sound";

function handleClientNav(
  e: React.MouseEvent<HTMLAnchorElement>,
  target: string,
) {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0)
    return;
  e.preventDefault();
  sound.playTap();
  navigate(target);
}

export default function App() {
  const { ready, error } = useGuestSession();
  const path = usePathname();
  const matchId = /^\/m\/([a-z0-9]+)$/.exec(path)?.[1] ?? null;
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!isHelpToggleEvent(e)) return;
      e.preventDefault();
      sound.playTap();
      setHelpOpen((open) => !open);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-card/95 backdrop-blur-sm">
        <nav className="container flex h-16 items-center justify-between gap-1.5 sm:gap-2">
          <a
            href="/"
            onClick={(e) => handleClientNav(e, "/")}
            className="group inline-flex items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <NinepopWordmark />
          </a>

          <div className="flex items-center gap-1 sm:gap-2">
            <a
              href="/leaderboard"
              onClick={(e) => handleClientNav(e, "/leaderboard")}
              className={cn(
                "toy-key inline-flex h-9 items-center gap-1.5 rounded-xl px-2 font-display text-xs font-semibold sm:px-3 sm:text-sm",
                path === "/leaderboard"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent",
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 shrink-0"
                aria-hidden="true"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
              <span className="sr-only sm:not-sr-only">Leaderboard</span>
            </a>

            {ready && <PlayerChip />}

            <button
              type="button"
              onClick={() => {
                sound.playTap();
                setHelpOpen(true);
              }}
              aria-label="How to play and keyboard shortcuts"
              aria-haspopup="dialog"
              aria-expanded={helpOpen}
              title="How to play & shortcuts (?)"
              data-testid="help-toggle"
              className={cn(
                "toy-key inline-flex h-9 w-9 items-center justify-center rounded-xl font-display text-base font-bold",
                helpOpen
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-accent",
              )}
            >
              ?
            </button>

            <SoundToggle />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {ready && <QueueWatcher path={path} />}

      <main className="container flex grow flex-col py-3 sm:py-5">
        {error ? (
          <div className="toy-card mx-auto my-12 max-w-md p-6 text-center">
            <p className="font-display text-lg font-bold text-destructive">
              Connection hiccup
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          </div>
        ) : !ready ? (
          <div className="mx-auto my-16 flex flex-col items-center gap-3 text-center">
            <NinepopMark className="h-12 w-12 animate-bounce" />
            <p className="font-display text-base font-semibold text-muted-foreground">
              Powering up Ninepop…
            </p>
          </div>
        ) : matchId ? (
          <MatchPage
            key={matchId}
            matchId={matchId}
            helpOpen={helpOpen}
            onOpenHelp={() => {
              sound.playTap();
              setHelpOpen(true);
            }}
          />
        ) : path === "/leaderboard" ? (
          <Leaderboard />
        ) : (
          <Home />
        )}
      </main>

      <HelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

function PlayerChip() {
  const me = useQuery(api.players.me);
  if (!me) return null;
  return (
    <div
      className="hidden items-center gap-2 rounded-xl border-2 border-ink bg-secondary/75 px-2.5 py-1 md:inline-flex"
      title={me.name}
    >
      <PlayerAvatar name={me.name} isBot={false} size="xs" />
      <span
        className="max-w-[120px] truncate text-xs font-bold text-foreground"
        data-testid="player-name"
      >
        {me.name}
      </span>
    </div>
  );
}
