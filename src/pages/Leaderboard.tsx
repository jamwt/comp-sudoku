import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { PlayerAvatar } from "@/components/Avatars";
import { Button } from "@/components/ui/button";
import { navigate } from "@/lib/router";
import { cn } from "@/lib/utils";
import { sound } from "@/lib/sound";

const TOP_N = 20;

export function Leaderboard() {
  const board = useQuery(api.ratings.leaderboard, { limit: TOP_N });
  if (board === undefined) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4 py-8">
        <div className="toy-card p-6 text-center font-display text-base font-semibold text-muted-foreground">
          Loading high scores…
        </div>
      </div>
    );
  }
  const me = board.me;
  const meInTop =
    me !== null && board.top.some((r) => r.playerId === me.playerId);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-primary text-primary-foreground shadow-toy-xs">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              High Scores
            </h1>
            <p className="text-xs font-medium text-muted-foreground">
              Top {TOP_N} Ninepop players &amp; AI critters
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            sound.playTap();
            navigate("/");
          }}
        >
          ← Lobby
        </Button>
      </div>

      {me && (
        <div
          className="toy-card-sm flex items-center justify-between gap-3 bg-accent/60 px-4 py-3"
          data-testid="my-standing"
        >
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar name={me.name} isBot={false} size="sm" />
            <p className="text-xs font-semibold text-foreground sm:text-sm">
              {me.rank === null
                ? `You are unranked at ${me.rating}. Finish a ranked race to claim a spot!`
                : `You are #${me.rank} of ${me.total}, ahead of ${me.percentile}% of rated players.`}
            </p>
          </div>
          <span className="shrink-0 rounded-lg border-2 border-ink bg-screen px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-foreground">
            {me.rating}
          </span>
        </div>
      )}

      <div className="toy-card overflow-hidden">
        {board.top.length === 0 ? (
          <p className="p-8 text-center text-sm font-medium text-muted-foreground">
            Nobody has finished a ranked match yet. Be the first on the board!
          </p>
        ) : (
          <table className="w-full table-fixed text-sm" data-testid="leaderboard">
            <thead>
              <tr className="border-b-2 border-ink bg-secondary/70 text-left font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <th className="w-12 py-2.5 pl-3 pr-1 sm:w-14 sm:pl-4 sm:pr-2">#</th>
                <th className="py-2.5">Player</th>
                <th className="w-16 py-2.5 text-right sm:w-20">Elo</th>
                <th className="w-16 py-2.5 pl-2 pr-3 text-right sm:w-20 sm:pl-4 sm:pr-4">Games</th>
              </tr>
            </thead>
            <tbody>
              {board.top.map((row) => (
                <Row
                  key={row.playerId}
                  {...row}
                  highlight={row.playerId === me?.playerId}
                />
              ))}
              {me && !meInTop && me.rank !== null && (
                <>
                  <tr className="bg-muted/40">
                    <td
                      colSpan={4}
                      className="py-1 text-center font-mono text-xs text-muted-foreground"
                    >
                      • • •
                    </td>
                  </tr>
                  <Row
                    rank={me.rank}
                    name={me.name}
                    rating={me.rating}
                    ratedGames={me.ratedGames}
                    isBot={false}
                    highlight
                  />
                </>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border-[1.5px] border-ink bg-[#FFCC1F] font-display text-xs font-bold text-[#1C1825] tabular-nums">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border-[1.5px] border-ink bg-[#E2E8F0] font-display text-xs font-bold text-[#1E293B] tabular-nums">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border-[1.5px] border-ink bg-[#FDBA74] font-display text-xs font-bold text-[#7C2D12] tabular-nums">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center font-mono text-xs font-bold tabular-nums text-muted-foreground">
      {rank}
    </span>
  );
}

function Row({
  rank,
  name,
  rating,
  ratedGames,
  isBot,
  highlight,
}: {
  rank: number;
  name: string;
  rating: number;
  ratedGames: number;
  isBot: boolean;
  highlight: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b border-border/80 last:border-0 transition-colors",
        highlight
          ? "bg-primary/25 font-semibold"
          : "hover:bg-accent/40",
      )}
      data-testid={highlight ? "leaderboard-me" : undefined}
    >
      <td className="py-2.5 pl-3 pr-1 sm:pl-4 sm:pr-2">
        <RankBadge rank={rank} />
      </td>
      <td className="py-2.5 pr-2">
        <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <PlayerAvatar name={name} isBot={isBot} size="sm" />
          <span className="min-w-0 truncate font-display text-sm font-bold text-foreground">
            {name}
          </span>
          {isBot && (
            <span className="shrink-0 rounded-md border border-ink/30 bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none text-muted-foreground">
              AI
            </span>
          )}
          {highlight && (
            <span className="shrink-0 rounded-md border border-ink/40 bg-primary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase leading-none text-primary-foreground">
              YOU
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 text-right font-mono text-sm font-bold tabular-nums text-foreground">
        {rating}
      </td>
      <td className="py-2.5 pl-2 pr-3 text-right font-mono text-xs font-semibold tabular-nums text-muted-foreground sm:pl-4 sm:pr-4">
        {ratedGames}
      </td>
    </tr>
  );
}
