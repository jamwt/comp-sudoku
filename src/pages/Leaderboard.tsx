import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";

const TOP_N = 20;

export function Leaderboard() {
  const board = useQuery(api.ratings.leaderboard, { limit: TOP_N });
  if (board === undefined)
    return <p className="text-muted-foreground">Loading leaderboard…</p>;
  const me = board.me;
  const meInTop =
    me !== null && board.top.some((r) => r.playerId === me.playerId);
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 pt-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Leaderboard</h1>
        <a
          href="/"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Back
        </a>
      </div>
      {board.top.length === 0 ? (
        <p className="text-muted-foreground">
          Nobody has finished a ranked match yet.
        </p>
      ) : (
        <table className="w-full text-sm" data-testid="leaderboard">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 font-medium">Player</th>
              <th className="py-2 text-right font-medium">Rating</th>
              <th className="py-2 pl-4 text-right font-medium">Games</th>
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
                <tr>
                  <td
                    colSpan={4}
                    className="py-1 text-center text-muted-foreground"
                  >
                    ⋯
                  </td>
                </tr>
                <Row
                  rank={me.rank}
                  name={me.name}
                  rating={me.rating}
                  ratedGames={me.ratedGames}
                  highlight
                />
              </>
            )}
          </tbody>
        </table>
      )}
      {me && (
        <p className="text-sm text-muted-foreground" data-testid="my-standing">
          {me.rank === null
            ? `You are unranked at ${me.rating}. Finish a ranked match to join the board.`
            : `You are #${me.rank} of ${me.total}, above ${me.percentile}% of rated players.`}
        </p>
      )}
    </div>
  );
}

function Row({
  rank,
  name,
  rating,
  ratedGames,
  highlight,
}: {
  rank: number;
  name: string;
  rating: number;
  ratedGames: number;
  highlight: boolean;
}) {
  return (
    <tr
      className={cn(
        "border-b last:border-0",
        highlight && "bg-accent font-medium",
      )}
      data-testid={highlight ? "leaderboard-me" : undefined}
    >
      <td className="py-2 pr-2 tabular-nums">{rank}</td>
      <td className="py-2">{name}</td>
      <td className="py-2 text-right tabular-nums">{rating}</td>
      <td className="py-2 pl-4 text-right tabular-nums">{ratedGames}</td>
    </tr>
  );
}
