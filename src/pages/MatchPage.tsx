import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import usePresence from "@convex-dev/presence/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchView } from "../../convex/matches";
import { RULES } from "../../convex/gameConfig";
import type { Slot } from "../../convex/lib/engine";
import { pruneNotesForPlacement } from "../../convex/lib/notes";
import { isEditableTarget } from "@/lib/keyboard";
import { Board } from "@/game/Board";
import { DigitPad } from "@/game/DigitPad";
import { slotTone, TONE } from "@/game/colors";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/Avatars";
import { NinepopMark } from "@/components/NinepopLogo";
import { matchPath, navigate } from "@/lib/router";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";
import { sound } from "@/lib/sound";

const MOVES: Record<string, [number, number]> = {
  arrowup: [-1, 0],
  w: [-1, 0],
  k: [-1, 0],
  arrowdown: [1, 0],
  s: [1, 0],
  j: [1, 0],
  arrowleft: [0, -1],
  a: [0, -1],
  h: [0, -1],
  arrowright: [0, 1],
  d: [0, 1],
  l: [0, 1],
};

function setChar(s: string, i: number, ch: string) {
  return s.slice(0, i) + ch + s.slice(i + 1);
}

export function MatchPage({
  matchId,
  helpOpen = false,
  onOpenHelp,
}: {
  matchId: string;
  helpOpen?: boolean;
  onOpenHelp?: () => void;
}) {
  const match = useQuery(api.matches.get, { matchId });
  const join = useMutation(api.matches.join);
  const joinAttempted = useRef(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  useEffect(() => {
    if (
      !match ||
      match.status !== "waiting" ||
      match.you !== null ||
      joinAttempted.current
    )
      return;
    joinAttempted.current = true;
    join({ matchId: match._id }).catch(() =>
      setJoinError("Could not join this match."),
    );
  }, [match, join]);

  if (match === undefined) {
    return (
      <div className="mx-auto my-16 flex flex-col items-center gap-3 text-center">
        <NinepopMark className="h-11 w-11 animate-bounce" />
        <p className="font-display text-base font-semibold text-muted-foreground">
          Loading puzzle cartridge…
        </p>
      </div>
    );
  }
  if (match === null) {
    return (
      <div className="toy-card mx-auto my-12 max-w-md space-y-4 p-6 text-center">
        <h2 className="font-display text-2xl font-bold">Match not found</h2>
        <p className="text-sm text-muted-foreground">
          That Ninepop link does not match an active or finished game.
        </p>
        <Button onClick={() => navigate("/")}>Back to Lobby</Button>
      </div>
    );
  }
  if (joinError) {
    return (
      <div className="toy-card mx-auto my-12 max-w-md space-y-4 p-6 text-center">
        <p className="font-display text-lg font-bold text-destructive">
          {joinError}
        </p>
        <Button onClick={() => navigate("/")}>Back to Lobby</Button>
      </div>
    );
  }
  if (match.status === "waiting") return <WaitingRoom match={match} />;
  return <Game match={match} helpOpen={helpOpen} onOpenHelp={onOpenHelp} />;
}

function WaitingRoom({ match }: { match: MatchView }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/m/${match._id}`;
  const host = match.participants[0];

  if (match.you === null) {
    return (
      <div className="mx-auto my-16 flex flex-col items-center gap-3 text-center">
        <NinepopMark className="h-11 w-11 animate-bounce" />
        <p className="font-display text-base font-semibold text-muted-foreground">
          Joining match…
        </p>
      </div>
    );
  }

  function onCopy() {
    sound.playTap();
    void navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5 pt-4 sm:pt-8">
      <div className="toy-card space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-primary px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase text-primary-foreground">
            Private Invite
          </span>
          <span className="rounded-lg border border-ink/40 bg-secondary px-2 py-0.5 font-mono text-xs font-bold capitalize text-foreground">
            {match.tier} grid
          </span>
        </div>

        {/* Tactile VS preview */}
        <div className="flex items-center justify-center gap-4 rounded-xl border-2 border-ink bg-screen p-4 shadow-toy-inset">
          <div className="flex flex-col items-center gap-1.5">
            <PlayerAvatar
              name={host?.name ?? "You"}
              isBot={false}
              size="lg"
            />
            <span className="max-w-[100px] truncate font-display text-xs font-bold text-[#1D4ED8] dark:text-[#7DD3FC]">
              {host?.name ?? "You"}
            </span>
          </div>

          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-primary font-display text-sm font-bold text-primary-foreground shadow-toy-xs">
            VS
          </span>

          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl border-2 border-dashed border-ink/60 bg-muted font-display text-2xl font-bold text-muted-foreground">
              ?
            </div>
            <span className="font-display text-xs font-semibold text-muted-foreground">
              Waiting…
            </span>
          </div>
        </div>

        <div className="space-y-1.5 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Waiting for your rival
          </h2>
          <p className="text-sm text-muted-foreground">
            Send this Ninepop link to a friend. The board unlocks{" "}
            {RULES.countdownMs / 1000}s after they hop in.
          </p>
        </div>

        <div className="space-y-2">
          <input
            readOnly
            value={link}
            data-testid="invite-link"
            aria-label="Match invite link"
            className="h-10 w-full rounded-xl border-2 border-ink bg-screen px-3 font-mono text-xs font-medium text-foreground shadow-toy-inset focus:outline-none focus:ring-2 focus:ring-ring"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            className="w-full"
            size="lg"
            variant={copied ? "cobalt" : "default"}
            onClick={onCopy}
          >
            {copied ? "✓ Link Copied!" : "Copy Invite Link"}
          </Button>
        </div>
      </div>

      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            sound.playTap();
            navigate("/");
          }}
        >
          ← Back to Lobby
        </Button>
      </div>
    </div>
  );
}

function Game({
  match,
  helpOpen,
  onOpenHelp,
}: {
  match: MatchView;
  helpOpen: boolean;
  onOpenHelp?: () => void;
}) {
  const matchId = match._id;
  const you = match.you;
  const playing = you !== null && match.status === "active";
  const notes = useQuery(api.notes.mine, you !== null ? { matchId } : "skip");

  const [cursor, setCursor] = useState(() =>
    Math.max(0, match.board.indexOf("0")),
  );
  const [notesMode, setNotesMode] = useState(false);
  const [digitFirst, setDigitFirst] = useState(false);
  const [armedDigit, setArmedDigit] = useState<number | null>(null);
  const [pending, setPending] = useState<ReadonlySet<number>>(new Set());
  const [popped, setPopped] = useState<ReadonlySet<number>>(new Set());
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const [flash, setFlash] = useState<{
    cell: number;
    kind: "wrong" | "taken";
  } | null>(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [showResult, setShowResult] = useState(true);

  const flashTimer = useRef<ReturnType<typeof setTimeout>>();
  const keyTimer = useRef<ReturnType<typeof setTimeout>>();
  const prevOwnersRef = useRef<string>(match.owners);
  const prevCountdownRef = useRef<number | null>(null);
  const prevStatusRef = useRef<MatchView["status"]>(match.status);

  const startsAt = match.startsAt ?? 0;
  const now = useNow(match.status === "active");
  const countdown = startsAt - now;
  const countdownStep = countdown > 0 ? Math.ceil(countdown / 1000) : 0;
  const locked = now < lockUntil;
  const canInput = playing && countdown <= 0 && !locked;

  const pulseKey = useCallback((keyId: string) => {
    clearTimeout(keyTimer.current);
    setPressedKey(keyId);
    keyTimer.current = setTimeout(() => setPressedKey(null), 115);
  }, []);

  // Detect newly claimed cells for spring-pop animation + claim sound
  useEffect(() => {
    const prev = prevOwnersRef.current;
    const curr = match.owners;
    if (prev === curr) return;
    prevOwnersRef.current = curr;

    const newlyClaimed: number[] = [];
    let opponentClaimed = false;
    for (let i = 0; i < 81; i++) {
      if (prev[i] !== curr[i] && (curr[i] === "0" || curr[i] === "1")) {
        newlyClaimed.push(i);
        if (you !== null && Number(curr[i]) !== you) {
          opponentClaimed = true;
        }
      }
    }
    if (newlyClaimed.length === 0) return;
    if (opponentClaimed) sound.playOpponentPop();

    setPopped((s) => {
      const next = new Set(s);
      for (const c of newlyClaimed) next.add(c);
      return next;
    });
    const timer = setTimeout(() => {
      setPopped((s) => {
        const next = new Set(s);
        for (const c of newlyClaimed) next.delete(c);
        return next;
      });
    }, 180);
    return () => clearTimeout(timer);
  }, [match.owners, you]);

  // Countdown audio pips (3, 2, 1, GO!)
  useEffect(() => {
    if (match.status !== "active") return;
    if (prevCountdownRef.current === null) {
      prevCountdownRef.current = countdownStep;
      return;
    }
    if (countdownStep !== prevCountdownRef.current) {
      prevCountdownRef.current = countdownStep;
      if (countdownStep >= 0 && countdownStep <= 3) {
        sound.playCountdown(countdownStep);
      }
    }
  }, [match.status, countdownStep]);

  // Match finish chime
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = match.status;
    if (prev !== "finished" && match.status === "finished" && match.result) {
      const won =
        match.result.winner !== null &&
        match.you !== null &&
        match.result.winner === match.you;
      if (won) sound.playWin();
      else sound.playLose();
    }
  }, [match.status, match.result, match.you]);

  const enter = useMutation(api.matches.enter).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.matches.get, { matchId });
      if (!current || current.you === null || current.board[args.cell] !== "0")
        return;
      const me = current.you;
      store.setQuery(
        api.matches.get,
        { matchId },
        {
          ...current,
          board: setChar(current.board, args.cell, String(args.digit)),
          owners: setChar(current.owners, args.cell, String(me)),
          participants: current.participants.map((p, i) =>
            i === me ? { ...p, cells: p.cells + 1, score: p.score + 1 } : p,
          ),
        },
      );
      const currentNotes = store.getQuery(api.notes.mine, { matchId });
      if (currentNotes) {
        const pruned = pruneNotesForPlacement(
          currentNotes,
          args.cell,
          args.digit,
        );
        if (pruned !== null) {
          store.setQuery(api.notes.mine, { matchId }, pruned);
        }
      }
    },
  );

  const toggleNote = useMutation(api.notes.toggle).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.notes.mine, { matchId: args.matchId });
      if (current === undefined) return;
      const marks = current ?? new Array<number>(81).fill(0);
      store.setQuery(
        api.notes.mine,
        { matchId: args.matchId },
        marks.map((m, i) =>
          i === args.cell ? m ^ (1 << (args.digit - 1)) : m,
        ),
      );
    },
  );

  const clearNotes = useMutation(api.notes.clear).withOptimisticUpdate(
    (store, args) => {
      const current = store.getQuery(api.notes.mine, { matchId: args.matchId });
      if (!current) return;
      store.setQuery(
        api.notes.mine,
        { matchId: args.matchId },
        current.map((m, i) => (i === args.cell ? 0 : m)),
      );
    },
  );

  const showFlash = useCallback((cell: number, kind: "wrong" | "taken") => {
    clearTimeout(flashTimer.current);
    setFlash({ cell, kind });
    flashTimer.current = setTimeout(() => setFlash(null), 550);
  }, []);

  const place = useCallback(
    async (cell: number, digit: number) => {
      if (!canInput || match.board[cell] !== "0" || pending.has(cell)) return;
      setPending((s) => new Set(s).add(cell));
      try {
        const result = await enter({ matchId, cell, digit });
        if (result.kind === "claimed") {
          sound.playPop();
        } else if (result.kind === "wrong" || result.kind === "locked") {
          setLockUntil(Date.now() + result.lockoutMs);
          if (result.kind === "wrong") {
            sound.playWrong();
            showFlash(cell, "wrong");
          }
        } else if (result.kind === "taken") {
          sound.playTaken();
          showFlash(cell, "taken");
        }
      } finally {
        setPending((s) => {
          const next = new Set(s);
          next.delete(cell);
          return next;
        });
      }
    },
    [canInput, match.board, pending, enter, matchId, showFlash],
  );

  const note = useCallback(
    (cell: number, digit: number) => {
      if (!playing || match.board[cell] !== "0") return;
      sound.playTap();
      void toggleNote({ matchId, cell, digit });
    },
    [playing, match.board, toggleNote, matchId],
  );

  const clear = useCallback(
    (cell: number) => {
      if (!playing || !notes?.[cell]) return;
      sound.playTap();
      void clearNotes({ matchId, cell });
    },
    [playing, notes, clearNotes, matchId],
  );

  const act = useCallback(
    (cell: number, digit: number, asNote: boolean) => {
      if (asNote) note(cell, digit);
      else void place(cell, digit);
    },
    [note, place],
  );

  useEffect(() => {
    if (helpOpen) return;
    function onKey(e: KeyboardEvent) {
      if (
        isEditableTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      const key = e.key.toLowerCase();
      const digitMatch = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
      if (digitMatch) {
        e.preventDefault();
        const digit = Number(digitMatch[1]);
        pulseKey(String(digit));
        if (digitFirst && !e.shiftKey) {
          sound.playTap();
          setArmedDigit((d) => (d === digit ? null : digit));
        } else {
          act(cursor, digit, e.shiftKey || notesMode);
        }
        return;
      }
      const move = MOVES[key];
      if (move) {
        e.preventDefault();
        const row = (Math.floor(cursor / 9) + move[0] + 9) % 9;
        const col = ((cursor % 9) + move[1] + 9) % 9;
        setCursor(row * 9 + col);
        return;
      }
      if (key === "n") {
        pulseKey("notes");
        sound.playTap();
        setNotesMode((m) => !m);
      } else if (key === "f") {
        pulseKey("digitFirst");
        sound.playTap();
        setDigitFirst((m) => !m);
      } else if (key === "escape") {
        setArmedDigit(null);
      } else if (key === "backspace" || key === "delete") {
        e.preventDefault();
        pulseKey("clear");
        clear(cursor);
      } else if (
        (key === "enter" || key === " ") &&
        digitFirst &&
        armedDigit !== null
      ) {
        e.preventDefault();
        pulseKey(String(armedDigit));
        act(cursor, armedDigit, notesMode);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpOpen, cursor, digitFirst, notesMode, armedDigit, act, clear, pulseKey]);

  const onCellClick = (cell: number) => {
    setCursor(cell);
    if (digitFirst && armedDigit !== null) act(cell, armedDigit, notesMode);
  };

  const onPadDigit = (digit: number) => {
    pulseKey(String(digit));
    if (digitFirst) {
      sound.playTap();
      setArmedDigit((d) => (d === digit ? null : digit));
    } else {
      act(cursor, digit, notesMode);
    }
  };

  const selectedValue = Number(match.board[cursor]);
  const activeDigit = digitFirst ? armedDigit : selectedValue || null;
  const isPractice = !match.rated && match.participants.some((p) => p.bot !== null);

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col items-center gap-3.5 lg:flex-row lg:items-start lg:justify-center lg:gap-6">
      {/* Main board & handheld controls column */}
      <div className="relative flex w-full max-w-[468px] flex-col gap-2 sm:gap-2.5">
        <Scoreboard match={match} />
        <StatusBar
          match={match}
          now={now}
          lockUntil={lockUntil}
          notesMode={notesMode}
          digitFirst={digitFirst}
          armedDigit={armedDigit}
        />

        <div className="relative">
          <Board
            givens={match.givens}
            board={match.board}
            owners={match.owners}
            you={you}
            notes={notes ?? null}
            cursor={cursor}
            activeDigit={activeDigit}
            pending={pending}
            popped={popped}
            flash={flash}
            disabled={!canInput}
            onCellClick={onCellClick}
          />
          {match.status === "active" && countdown > 0 && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl bg-background/75 backdrop-blur-[2px]"
              data-testid="countdown"
            >
              <span className="rounded-full border-2 border-ink bg-card px-3 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground shadow-toy-xs">
                Get Ready
              </span>
              <span
                key={countdownStep}
                className="flex h-24 w-24 animate-countdown-pop items-center justify-center rounded-3xl border-[3px] border-ink bg-primary font-display text-6xl font-bold tabular-nums text-primary-foreground shadow-toy-lg"
              >
                {countdownStep}
              </span>
            </div>
          )}
        </div>

        {you !== null && (
          <DigitPad
            board={match.board}
            activeDigit={armedDigit}
            digitFirst={digitFirst}
            notesMode={notesMode}
            disabled={!playing}
            pressedKey={pressedKey}
            onDigit={onPadDigit}
            onToggleNotes={() => {
              pulseKey("notes");
              sound.playTap();
              setNotesMode((m) => !m);
            }}
            onToggleDigitFirst={() => {
              pulseKey("digitFirst");
              sound.playTap();
              setDigitFirst((m) => !m);
            }}
            onClearNotes={() => {
              pulseKey("clear");
              clear(cursor);
            }}
          />
        )}
      </div>

      {/* Right sidebar (stacks cleanly below on mobile) */}
      <aside className="flex w-full max-w-[520px] flex-col gap-3 text-sm lg:w-[272px]">
        {/* Match mode cartridge pill */}
        <div className="toy-card-sm flex items-center justify-between px-3.5 py-2.5">
          <span className="font-display text-sm font-bold text-foreground">
            {match.rated
              ? "Ranked Race"
              : isPractice
                ? "AI Practice"
                : "Friend Race"}
          </span>
          <span className="rounded-lg border border-ink/40 bg-secondary px-2 py-0.5 font-mono text-[11px] font-bold capitalize text-foreground">
            {match.tier}
          </span>
        </div>

        {you !== null && match.status === "active" && (
          <PresenceStatus match={match} you={you} />
        )}

        {match.status === "finished" && !showResult && (
          <Button
            variant="default"
            onClick={() => {
              sound.playTap();
              setShowResult(true);
            }}
          >
            Show Match Result
          </Button>
        )}

        {playing && <ResignButton matchId={matchId} />}

        <Help onOpenHelp={onOpenHelp} />
      </aside>

      {match.status === "finished" && showResult && (
        <ResultOverlay match={match} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}

function Scoreboard({ match }: { match: MatchView }) {
  const clinch = Math.floor(match.emptyCount / 2) + 1;
  const p0 = match.participants[0];
  const p1 = match.participants[1];
  const totalOpen = Math.max(1, match.emptyCount);
  const p0Pct = Math.min(100, ((p0?.cells ?? 0) / totalOpen) * 100);
  const p1Pct = Math.min(100, ((p1?.cells ?? 0) / totalOpen) * 100);
  const tone0 = TONE[slotTone(0, match.you)];
  const tone1 = TONE[slotTone(1, match.you)];
  const remaining = Math.max(
    0,
    match.emptyCount - (p0?.cells ?? 0) - (p1?.cells ?? 0),
  );
  const minToClinch = Math.max(
    0,
    Math.min(clinch - (p0?.cells ?? 0), clinch - (p1?.cells ?? 0)),
  );

  return (
    <div
      className="toy-card-sm flex flex-col gap-2.5 p-2.5 sm:p-3"
      data-testid="scoreboard"
    >
      <div className="grid grid-cols-2 gap-2">
        {match.participants.map((p, i) => {
          const tone = TONE[slotTone(i as Slot, match.you)];
          const rightSide = i === 1;
          return (
            <div
              key={p.playerId}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border-2 border-ink/80 px-2.5 py-1.5",
                tone.softBg,
                rightSide && "flex-row-reverse text-right",
              )}
            >
              <div
                className={cn(
                  "flex min-w-0 items-center gap-2",
                  rightSide && "flex-row-reverse",
                )}
              >
                <PlayerAvatar
                  name={p.name}
                  isBot={p.bot !== null}
                  size="sm"
                />
                <div className="min-w-0">
                  <span className="block truncate font-display text-xs font-bold leading-tight text-foreground sm:text-sm">
                    {p.name}
                  </span>
                  <span className="block font-mono text-[10px] font-semibold leading-tight text-muted-foreground">
                    {i === match.you
                      ? "YOU"
                      : p.bot
                        ? `AI · ${p.bot.rating}`
                        : "RIVAL"}
                  </span>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 font-display text-2xl font-bold leading-none tabular-nums sm:text-3xl",
                  tone.text,
                )}
                data-testid={`score-${i}`}
              >
                {p.score}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live tug-of-war clinch bar */}
      <div className="space-y-1">
        <div
          className="relative h-3.5 w-full overflow-hidden rounded-full border-2 border-ink bg-muted shadow-toy-inset"
          aria-label={`Clinch progress: ${p0?.cells ?? 0} vs ${p1?.cells ?? 0}, ${clinch} to clinch`}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 transition-[width] duration-200 ease-out",
              tone0.bar,
            )}
            style={{ width: `${p0Pct}%` }}
          />
          <div
            className={cn(
              "absolute inset-y-0 right-0 transition-[width] duration-200 ease-out",
              tone1.bar,
            )}
            style={{ width: `${p1Pct}%` }}
          />
          {/* Center clinch threshold notch */}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 z-10 w-[3px] -translate-x-1/2 bg-ink"
          />
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 z-20 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-ink bg-primary"
          />
        </div>
        <div className="flex items-center justify-between px-0.5 font-mono text-[10px] font-semibold text-muted-foreground tabular-nums sm:text-[11px]">
          <span>
            {minToClinch === 0
              ? "Clinched!"
              : minToClinch <= 4
                ? `Match point · ${minToClinch} to clinch`
                : `${clinch} of ${match.emptyCount} to clinch`}
          </span>
          <span>{remaining} open</span>
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  match,
  now,
  lockUntil,
  notesMode,
  digitFirst,
  armedDigit,
}: {
  match: MatchView;
  now: number;
  lockUntil: number;
  notesMode: boolean;
  digitFirst: boolean;
  armedDigit: number | null;
}) {
  const me = match.you !== null ? match.participants[match.you] : null;
  const lockLeft = lockUntil - now;

  if (match.status !== "active" || !me) return <div className="h-9" />;

  if (lockLeft > 0) {
    return (
      <div
        className="relative h-9 overflow-hidden rounded-xl border-2 border-ink bg-[#FEE2E2] text-[#991B1B] shadow-toy-xs dark:bg-[#450A0A] dark:text-[#FECACA]"
        data-testid="lockout"
      >
        <div
          className="lockout-stripes absolute inset-y-0 left-0 bg-[#EF4444]/85 transition-[width] duration-75 dark:bg-[#DC2626]/85"
          style={{
            width: `${Math.max(0, Math.min(100, (lockLeft / RULES.wrongEntryLockoutMs) * 100))}%`,
          }}
        />
        <span className="relative flex h-full items-center justify-center gap-1.5 font-display text-sm font-bold tabular-nums text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.65)]">
          Wrong digit · locked {(lockLeft / 1000).toFixed(1)}s
        </span>
      </div>
    );
  }

  const idleLeft =
    Math.max(me.lastActiveAt, match.startsAt ?? 0) + RULES.idleForfeitMs - now;
  if (idleLeft < 10_000 && now > (match.startsAt ?? 0)) {
    return (
      <div className="flex h-9 items-center justify-center rounded-xl border-2 border-ink bg-[#FEF3C7] font-display text-xs font-bold text-[#92400E] shadow-toy-xs dark:bg-[#78350F] dark:text-[#FEF3C7] sm:text-sm">
        Make a move! Forfeit in {Math.max(0, Math.ceil(idleLeft / 1000))}s
      </div>
    );
  }

  return (
    <div className="flex h-9 items-center justify-between rounded-xl border border-border bg-card/70 px-3 text-xs font-medium text-muted-foreground">
      <span>
        {notesMode
          ? "Notes ON · placing pencil marks"
          : digitFirst
            ? armedDigit !== null
              ? `Digit-first · tap any cell to place ${armedDigit}`
              : "Digit-first ON · pick a digit 1–9"
            : "Tap a cell or use arrows, then press 1–9"}
      </span>
      <span className="hidden font-mono text-[10px] font-bold uppercase tracking-wider sm:inline">
        {notesMode ? "NOTES" : digitFirst ? "STAMP" : "SPEED"}
      </span>
    </div>
  );
}

function PresenceStatus({ match, you }: { match: MatchView; you: Slot }) {
  const myId = match.participants[you].playerId;
  const opponent = match.participants[you === 0 ? 1 : 0];
  const states = usePresence(
    api.presence,
    match._id,
    myId,
    RULES.presenceHeartbeatMs,
  );
  const online =
    states?.find((s) => s.userId === opponent?.playerId)?.online ?? false;
  if (!opponent) return null;

  if (opponent.bot) {
    return (
      <div
        className="toy-card-sm flex items-center gap-3 px-3.5 py-2.5"
        data-testid="opponent-presence"
      >
        <PlayerAvatar name={opponent.name} isBot={true} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-bold text-foreground">
            {opponent.name}
          </p>
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-[#38BDF8]" />
            AI · {opponent.bot.level} · {opponent.bot.rating}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="toy-card-sm flex items-center gap-3 px-3.5 py-2.5"
      data-testid="opponent-presence"
    >
      <PlayerAvatar name={opponent.name} isBot={false} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-foreground">
          {opponent.name}
        </p>
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              online ? "bg-emerald-500" : "bg-zinc-400",
            )}
          />
          {online
            ? "Connected"
            : `Offline · forfeits in ${RULES.disconnectForfeitMs / 1000}s`}
        </p>
      </div>
    </div>
  );
}

function ResignButton({ matchId }: { matchId: Id<"matches"> }) {
  const resign = useMutation(api.matches.resign);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          sound.playTap();
          setConfirming(true);
        }}
        data-testid="resign"
      >
        Resign match
      </Button>
    );
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="destructive"
        size="sm"
        className="flex-1"
        onClick={() => {
          sound.playTap();
          void resign({ matchId });
        }}
        data-testid="resign-confirm"
      >
        Confirm resign
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          sound.playTap();
          setConfirming(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}

function Help({ onOpenHelp }: { onOpenHelp?: () => void }) {
  return (
    <div className="toy-card-sm space-y-2 p-3.5 text-xs text-muted-foreground">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-sm font-bold text-foreground">Controls</p>
        {onOpenHelp && (
          <button
            type="button"
            onClick={onOpenHelp}
            className="inline-flex items-center gap-1 rounded-lg border border-ink/40 bg-secondary/80 px-2 py-0.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
          >
            Full guide <kbd className="kbd-cap">?</kbd>
          </button>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span>Move</span>
          <span className="flex items-center gap-1">
            <kbd className="kbd-cap">↑↓←→</kbd>
            <kbd className="kbd-cap">WASD</kbd>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Place digit</span>
          <kbd className="kbd-cap">1–9</kbd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Notes</span>
          <span className="flex items-center gap-1">
            <kbd className="kbd-cap">N</kbd>
            <span className="text-[10px]">or</span>
            <kbd className="kbd-cap">⇧+1–9</kbd>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Digit-first</span>
          <span className="flex items-center gap-1">
            <kbd className="kbd-cap">F</kbd>
            <span className="text-[10px]">+</span>
            <kbd className="kbd-cap">↵</kbd>
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Clear notes</span>
          <kbd className="kbd-cap">⌫</kbd>
        </div>
      </div>
    </div>
  );
}

function RatingChanges({ match }: { match: MatchView }) {
  if (!match.rated) {
    return (
      <p
        className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-center text-xs font-semibold text-muted-foreground"
        data-testid="result-rating"
      >
        Unrated match · Elo unchanged
      </p>
    );
  }
  return (
    <div
      className="space-y-2 rounded-xl border-2 border-ink bg-screen p-3 shadow-toy-inset"
      data-testid="result-rating"
    >
      <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        Rated Elo Shift
      </p>
      {match.participants.map((p, i) => {
        const change = match.ratingChanges.find(
          (c) => c.playerId === p.playerId,
        );
        if (!change) return null;
        return (
          <div
            key={p.playerId}
            className="flex items-center justify-between text-sm"
          >
            <span
              className={cn(
                "font-display font-bold",
                TONE[slotTone(i as Slot, match.you)].text,
              )}
            >
              {i === match.you ? "You" : p.name}
            </span>
            <span className="flex items-center gap-2 font-mono text-xs font-bold tabular-nums">
              <span className="text-muted-foreground">{change.before} →</span>
              <span className="text-foreground">{change.after}</span>
              <span
                className={cn(
                  "rounded-md border border-ink/40 px-1.5 py-0.5 text-[11px] font-bold",
                  change.delta > 0
                    ? "bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-200"
                    : change.delta < 0
                      ? "bg-red-200 text-red-950 dark:bg-red-900 dark:text-red-200"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {change.delta > 0 ? "+" : ""}
                {change.delta}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const REASONS: Record<string, (loser: string) => string> = {
  board_full: () => "The board is complete!",
  clinch: () => "Clinched: held more than half of the open cells.",
  resign: (loser) => `${loser} resigned.`,
  forfeit_idle: (loser) =>
    `${loser} was idle for ${RULES.idleForfeitMs / 1000}s.`,
  forfeit_disconnect: (loser) =>
    `${loser} disconnected for ${RULES.disconnectForfeitMs / 1000}s.`,
};

function ResultOverlay({
  match,
  onClose,
}: {
  match: MatchView;
  onClose: () => void;
}) {
  const startPractice = useMutation(api.bots.startPractice);
  const [rematching, setRematching] = useState(false);

  const result = match.result;
  if (!result) return null;
  const winner = result.winner;
  const loserName =
    winner === null
      ? ""
      : (match.participants[winner === 0 ? 1 : 0]?.name ?? "");
  const youWon =
    winner !== null && match.you !== null && winner === match.you;
  const isDraw = winner === null;

  const headline = isDraw
    ? "Draw!"
    : match.you === null
      ? `${match.participants[winner]?.name} wins!`
      : youWon
        ? "You win!"
        : "You lose";

  const opponent =
    match.you !== null ? match.participants[match.you === 0 ? 1 : 0] : null;
  const canRematchBot = !match.rated && opponent?.bot != null;

  async function onRematch() {
    if (!opponent) return;
    sound.playTap();
    setRematching(true);
    try {
      const id = await startPractice({
        botId: opponent.playerId,
        tier: match.tier,
      });
      if (id) navigate(matchPath(id));
      else setRematching(false);
    } catch {
      setRematching(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/75 p-4 backdrop-blur-sm"
      data-testid="result"
    >
      <div className="toy-card relative w-full max-w-sm animate-banner-pop space-y-4 overflow-hidden p-6 shadow-toy-lg">
        {/* Celebratory corner sparkles on win */}
        {youWon && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-20 overflow-hidden"
          >
            <span className="animate-sparkle-float absolute left-6 top-4 h-3 w-3 rotate-45 rounded-[2px] bg-[#2563EB]" />
            <span className="animate-sparkle-float absolute left-16 top-9 h-2.5 w-2.5 rounded-full bg-[#F97316]" />
            <span className="animate-sparkle-float absolute right-8 top-5 h-3.5 w-3.5 rotate-12 rounded-[2px] bg-[#FFCC1F] border border-ink" />
            <span className="animate-sparkle-float absolute right-16 top-11 h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
        )}

        <div className="relative flex flex-col items-center text-center">
          <div
            className={cn(
              "mb-2 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-ink shadow-toy-sm",
              youWon
                ? "bg-primary text-primary-foreground"
                : isDraw
                  ? "bg-secondary text-foreground"
                  : "bg-[#FFEDD5] text-[#C2410C] dark:bg-[#5B2514] dark:text-[#FDBA74]",
            )}
          >
            {youWon ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
              </svg>
            ) : (
              <NinepopMark className="h-8 w-8" />
            )}
          </div>
          <h2
            className="font-display text-3xl font-bold tracking-tight"
            data-testid="result-headline"
          >
            {headline}
          </h2>
          <p
            className="mt-1 text-sm font-medium text-muted-foreground"
            data-testid="result-reason"
          >
            {REASONS[result.reason](loserName)}
          </p>
        </div>

        <RatingChanges match={match} />

        <div className="space-y-2">
          {match.participants.map((p, i) => {
            const tone = TONE[slotTone(i as Slot, match.you)];
            return (
              <div
                key={p.playerId}
                className={cn(
                  "flex items-center justify-between rounded-xl border-2 border-ink/70 px-3 py-2",
                  tone.softBg,
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerAvatar
                    name={p.name}
                    isBot={p.bot !== null}
                    size="sm"
                  />
                  <span
                    className={cn(
                      "truncate font-display text-sm font-bold",
                      tone.text,
                    )}
                  >
                    {p.name}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs font-bold tabular-nums text-foreground">
                  {p.cells} {p.cells === 1 ? "cell" : "cells"} · {p.wrong} wrong
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 pt-1">
          {canRematchBot && opponent && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => void onRematch()}
              disabled={rematching}
            >
              {rematching ? "Starting rematch…" : `Rematch ${opponent.name}`}
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              className="flex-1"
              variant={canRematchBot ? "cobalt" : "default"}
              onClick={() => {
                sound.playTap();
                navigate("/");
              }}
            >
              New match
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                sound.playTap();
                onClose();
              }}
            >
              View board
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
