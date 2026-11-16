import { useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { MATCHMAKING } from "../../convex/gameConfig";
import { ratingWindow } from "../../convex/lib/matchmaking";
import { Button } from "@/components/ui/button";
import { matchPath, navigate } from "@/lib/router";
import { useNow } from "@/lib/useNow";

function formatElapsed(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Your rating plus the ranked queue: join, wait, cancel. */
export function RankedPanel() {
  const mine = useQuery(api.ratings.mine);
  const status = useQuery(api.queue.status);
  const join = useMutation(api.queue.join);
  const cancel = useMutation(api.queue.cancel);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function onPlay() {
    setError(null);
    setJoining(true);
    try {
      await join({});
    } catch (e) {
      const data = e instanceof ConvexError ? e.data : null;
      setError(
        data?.kind === "RateLimited"
          ? `Too many queue joins. Try again in ${Math.ceil(data.retryAfter / 1000)}s.`
          : "Could not join the queue.",
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border p-4" data-testid="ranked">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">Ranked</span>
        <a
          href="/leaderboard"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Leaderboard
        </a>
      </div>
      {mine && (
        <div className="flex items-baseline gap-3" data-testid="my-rating">
          <span className="text-4xl font-bold tabular-nums">{mine.rating}</span>
          <span className="text-sm text-muted-foreground">
            {mine.rank === null
              ? "Unranked · play a ranked match to get a rank"
              : `#${mine.rank} of ${mine.total} · ahead of ${mine.percentile}% · ${mine.ratedGames} rated ${mine.ratedGames === 1 ? "game" : "games"}`}
          </span>
        </div>
      )}
      {status?.state === "waiting" && mine ? (
        <QueueWait
          joinedAt={status.joinedAt}
          rating={status.rating}
          onCancel={() => void cancel({})}
        />
      ) : status?.state === "matched" ? (
        <p className="text-sm text-muted-foreground">Match found. Joining…</p>
      ) : (
        <>
          {status?.state === "dropped" && (
            <p
              className="text-sm text-muted-foreground"
              data-testid="queue-dropped"
            >
              You were removed from the queue after going offline.
            </p>
          )}
          <Button
            className="w-full"
            size="lg"
            onClick={() => void onPlay()}
            disabled={joining || status === undefined}
            data-testid="play-ranked"
          >
            {joining ? "Joining…" : "Play ranked"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Rated match against someone near your rating, on {MATCHMAKING.tier}{" "}
            puzzles.
          </p>
        </>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}

function QueueWait({
  joinedAt,
  rating,
  onCancel,
}: {
  joinedAt: number;
  rating: number;
  onCancel: () => void;
}) {
  const now = useNow(true, 250);
  const waited = Math.max(0, now - joinedAt);
  const span = ratingWindow(waited, MATCHMAKING);
  const widening = Math.min(1, waited / MATCHMAKING.windowWidenMs);
  return (
    <div className="space-y-3" data-testid="queue-wait">
      <div className="flex items-baseline justify-between">
        <span className="flex items-center gap-2 font-medium">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Finding an opponent
        </span>
        <span
          className="font-mono text-lg tabular-nums"
          data-testid="queue-elapsed"
        >
          {formatElapsed(waited)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${widening * 100}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground" data-testid="queue-window">
          Rating window ±{span}: {rating - span}–{rating + span}
        </p>
        {waited >= MATCHMAKING.botFallbackAfterMs && (
          <p className="text-sm text-muted-foreground">
            Also looking for a bot near your rating.
          </p>
        )}
      </div>
      <Button
        variant="outline"
        className="w-full"
        onClick={onCancel}
        data-testid="queue-cancel"
      >
        Cancel
      </Button>
    </div>
  );
}

/**
 * Mounted for the whole app while signed in: keeps a waiting player's queue
 * presence alive on any page and takes them to their match once paired.
 */
export function QueueWatcher({ path }: { path: string }) {
  const status = useQuery(api.queue.status);
  const me = useQuery(api.players.me);
  useEffect(() => {
    if (status?.state !== "matched") return;
    const target = matchPath(status.matchId);
    if (path !== target) navigate(target);
  }, [status, path]);
  if (status?.state !== "waiting" || !me) return null;
  return <QueuePresence playerId={me._id} />;
}

/**
 * Queue presence that stays online while the tab is hidden, since people tab
 * away while they wait. The Presence hook disconnects hidden tabs, which is
 * right inside a match, so the queue heartbeats on its own. Closing the tab
 * still disconnects at once.
 */
function QueuePresence({ playerId }: { playerId: string }) {
  const convex = useConvex();
  const heartbeat = useMutation(api.presence.heartbeat);
  const disconnect = useMutation(api.presence.disconnect);
  useEffect(() => {
    const args = {
      roomId: `queue:${playerId}`,
      userId: playerId,
      sessionId: crypto.randomUUID(),
      interval: MATCHMAKING.presenceHeartbeatMs,
    };
    let sessionToken: string | null = null;
    let stopped = false;
    const beat = () =>
      heartbeat(args)
        .then((r) => {
          if (stopped) void disconnect({ sessionToken: r.sessionToken });
          else sessionToken = r.sessionToken;
        })
        .catch(() => {});
    void beat();
    const timer = setInterval(beat, MATCHMAKING.presenceHeartbeatMs);
    const onVisible = () => {
      if (!document.hidden) void beat();
    };
    const onUnload = () => {
      if (!sessionToken) return;
      navigator.sendBeacon(
        `${convex.url}/api/mutation`,
        new Blob(
          [
            JSON.stringify({
              path: "presence:disconnect",
              args: { sessionToken },
            }),
          ],
          { type: "application/json" },
        ),
      );
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("beforeunload", onUnload);
      if (sessionToken) disconnect({ sessionToken }).catch(() => {});
    };
  }, [playerId, convex, heartbeat, disconnect]);
  return null;
}
