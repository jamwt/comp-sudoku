import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useGuestSession } from "@/lib/guest";
import { usePathname } from "@/lib/router";
import { Home } from "@/pages/Home";
import { MatchPage } from "@/pages/MatchPage";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function App() {
  const { ready, error } = useGuestSession();
  const path = usePathname();
  const matchId = /^\/m\/([a-z0-9]+)$/.exec(path)?.[1] ?? null;

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="border-b">
        <nav className="container flex h-14 items-center justify-between">
          <a href="/" className="text-base font-semibold tracking-tight">
            Comp Sudoku
          </a>
          <div className="flex items-center gap-3 text-sm">
            {ready && <PlayerName />}
            <ThemeToggle />
          </div>
        </nav>
      </header>
      <main className="container flex grow flex-col py-6">
        {error ? (
          <p className="text-destructive">{error}</p>
        ) : !ready ? (
          <p className="text-muted-foreground">Signing you in as a guest…</p>
        ) : matchId ? (
          <MatchPage key={matchId} matchId={matchId} />
        ) : (
          <Home />
        )}
      </main>
    </div>
  );
}

function PlayerName() {
  const me = useQuery(api.players.me);
  return (
    <span className="text-muted-foreground" data-testid="player-name">
      {me?.name}
    </span>
  );
}
