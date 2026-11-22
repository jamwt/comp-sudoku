import { useEffect, useState } from "react";
import { useConvex, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { MATCHMAKING, RATING } from "../../convex/gameConfig";
import { ratingWindow } from "../../convex/lib/matchmaking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlayerAvatar } from "@/components/Avatars";
import { matchPath, navigate } from "@/lib/router";
import { useNow } from "@/lib/useNow";
import { sound } from "@/lib/sound";

function formatElapsed(ms: number) {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Your player cartridge profile plus the ranked matchmaking queue. */
export function RankedPanel() {
  const me = useQuery(api.players.me);
  const rename = useMutation(api.players.rename);
  const mine = useQuery(api.ratings.mine);
  const status = useQuery(api.queue.status);
  const join = useMutation(api.queue.join);
  const cancel = useMutation(api.queue.cancel);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function onPlay() {
    sound.playTap();
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

  async function onSaveName(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draftName.trim();
    if (!trimmed) {
      setNameError("Enter at least 1 character.");
      return;
    }
    setNameError(null);
    setSavingName(true);
    try {
      await rename({ name: trimmed });
      sound.playPop();
      setEditingName(false);
    } catch (err) {
      setNameError(
        err instanceof ConvexError ? String(err.data) : "Could not save name.",
      );
    } finally {
      setSavingName(false);
    }
  }

  const displayName = me?.name ?? "Guest Player";

  return (
    <section
      className="toy-card flex flex-col gap-4 p-4 sm:p-5"
      data-testid="ranked"
    >
      {/* Top profile cartridge strip */}
      <div className="flex items-start gap-3.5">
        <PlayerAvatar name={displayName} isBot={false} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/40 bg-secondary px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2563EB] dark:bg-[#38BDF8]" />
              Player Card
            </span>
            <a
              href="/leaderboard"
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                sound.playTap();
                navigate("/leaderboard");
              }}
              className="font-display text-xs font-semibold text-[#1D4ED8] underline-offset-4 hover:underline dark:text-[#7DD3FC]"
            >
              View ranks →
            </a>
          </div>

          {editingName ? (
            <form onSubmit={(e) => void onSaveName(e)} className="mt-2 space-y-1.5">
              <div className="flex gap-1.5">
                <Input
                  id="name"
                  aria-label="Your name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  maxLength={24}
                  autoFocus
                  className="h-9"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={savingName}
                >
                  {savingName ? "…" : "Save"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0 px-2.5"
                  onClick={() => {
                    setEditingName(false);
                    setNameError(null);
                  }}
                >
                  ✕
                </Button>
              </div>
              {nameError && (
                <p className="text-xs font-medium text-destructive">
                  {nameError}
                </p>
              )}
            </form>
          ) : (
            <div className="mt-1 flex items-center gap-2">
              <h2 className="truncate font-display text-xl font-bold tracking-tight text-foreground">
                {displayName}
              </h2>
              {me && (
                <button
                  type="button"
                  onClick={() => {
                    sound.playTap();
                    setDraftName(me.name);
                    setNameError(null);
                    setEditingName(true);
                  }}
                  aria-label="Edit display name"
                  title="Edit display name"
                  className="inline-flex h-6 items-center gap-1 rounded-lg border border-ink/40 bg-secondary/80 px-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Edit
                </button>
              )}
            </div>
          )}

          {/* Elo + Rank + Percentile readout */}
          {mine && (
            <div
              className="mt-2 flex flex-wrap items-center gap-2"
              data-testid="my-rating"
            >
              <span className="inline-flex items-baseline gap-1 rounded-xl border-2 border-ink bg-screen px-2.5 py-1 shadow-toy-xs">
                <span className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                  ELO
                </span>
                <span className="font-display text-xl font-bold leading-none tabular-nums text-foreground">
                  {mine.rating}
                </span>
              </span>

              {mine.rank === null ? (
                <span className="rounded-lg bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                  Unranked · {RATING.calibrationGames} calibration games
                </span>
              ) : (
                <>
                  <span className="rounded-lg border border-ink/30 bg-[#DBEAFE] px-2 py-1 font-mono text-xs font-bold tabular-nums text-[#1D4ED8] dark:bg-[#19355E] dark:text-[#7DD3FC]">
                    #{mine.rank} / {mine.total}
                  </span>
                  {mine.ratedGames < RATING.calibrationGames ? (
                    <span
                      title="Ratings adjust faster during your first 10 ranked games so you reach fair matches quickly."
                      className="rounded-lg border border-ink/40 bg-primary/80 px-2 py-1 font-mono text-xs font-bold tabular-nums text-primary-foreground"
                      data-testid="calibrating-badge"
                    >
                      Calibrating · {mine.ratedGames}/{RATING.calibrationGames}
                    </span>
                  ) : (
                    <>
                      <span className="rounded-lg border border-ink/30 bg-accent px-2 py-1 font-mono text-xs font-semibold tabular-nums text-foreground">
                        Top {Math.max(1, 100 - mine.percentile)}%
                      </span>
                      <span className="text-xs font-medium text-muted-foreground tabular-nums">
                        {mine.ratedGames}{" "}
                        {mine.ratedGames === 1 ? "game" : "games"}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Queue wait OR Play Ranked CTA */}
      <div className="border-t-2 border-dashed border-border pt-4">
        {status?.state === "waiting" && mine ? (
          <QueueWait
            joinedAt={status.joinedAt}
            rating={status.rating}
            onCancel={() => {
              sound.playTap();
              void cancel({});
            }}
          />
        ) : status?.state === "matched" ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-ink bg-primary/25 p-3 font-display text-sm font-bold text-foreground">
            <span className="h-2.5 w-2.5 animate-ping rounded-full bg-emerald-500" />
            Rival found! Launching match…
          </div>
        ) : (
          <div className="space-y-2.5">
            {status?.state === "dropped" && (
              <p
                className="rounded-xl border border-amber-500/40 bg-amber-100/70 px-3 py-2 text-xs font-medium text-amber-950 dark:bg-amber-950/60 dark:text-amber-100"
                data-testid="queue-dropped"
              >
                Removed from queue after going offline. Hop right back in!
              </p>
            )}
            <Button
              className="h-auto w-full py-3.5 text-lg font-bold shadow-toy"
              size="lg"
              onClick={() => void onPlay()}
              disabled={joining || status === undefined}
              data-testid="play-ranked"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2" />
              </svg>
              {joining ? "Entering Queue…" : "Play Ranked"}
            </Button>
            <p className="text-center text-xs font-medium text-muted-foreground">
              Rated head-to-head sprint ·{" "}
              <span className="capitalize">{MATCHMAKING.tier}</span> grid ·
              matches near your Elo
            </p>
          </div>
        )}
        {error && (
          <p className="mt-2 text-center text-xs font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
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
    <div
      className="space-y-3 rounded-xl border-2 border-ink bg-screen p-3.5 shadow-toy-inset"
      data-testid="queue-wait"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full border border-ink bg-emerald-500" />
          </span>
          Finding a rival…
        </span>
        <span
          className="rounded-lg border-2 border-ink bg-primary px-2 py-0.5 font-mono text-sm font-bold tabular-nums text-primary-foreground"
          data-testid="queue-elapsed"
        >
          {formatElapsed(waited)}
        </span>
      </div>

      <div className="space-y-1.5">
        <div className="h-3 overflow-hidden rounded-full border-2 border-ink bg-muted">
          <div
            className="h-full rounded-full bg-[#2563EB] transition-[width] duration-200 dark:bg-[#38BDF8]"
            style={{ width: `${Math.max(10, widening * 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span data-testid="queue-window" className="font-mono tabular-nums">
            Window ±{span} ({rating - span}–{rating + span})
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider">
            {MATCHMAKING.tier}
          </span>
        </div>
        {waited >= MATCHMAKING.botFallbackAfterMs && (
          <p className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-foreground">
            Also scanning for an AI critter near your rating.
          </p>
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={onCancel}
        data-testid="queue-cancel"
      >
        Cancel search
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
