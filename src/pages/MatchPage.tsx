import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import usePresence from "@convex-dev/presence/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { MatchView } from "../../convex/matches";
import { RULES } from "../../convex/gameConfig";
import type { Slot } from "../../convex/lib/engine";
import { Board } from "@/game/Board";
import { DigitPad } from "@/game/DigitPad";
import { slotTone, TONE } from "@/game/colors";
import { Button } from "@/components/ui/button";
import { navigate } from "@/lib/router";
import { useNow } from "@/lib/useNow";
import { cn } from "@/lib/utils";

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

export function MatchPage({ matchId }: { matchId: string }) {
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

  if (match === undefined)
    return <p className="text-muted-foreground">Loading match…</p>;
  if (match === null) return <p>That match does not exist.</p>;
  if (joinError) return <p className="text-destructive">{joinError}</p>;
  if (match.status === "waiting") return <WaitingRoom match={match} />;
  return <Game match={match} />;
}

function WaitingRoom({ match }: { match: MatchView }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/m/${match._id}`;
  if (match.you === null)
    return <p className="text-muted-foreground">Joining…</p>;
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 pt-6">
      <h2 className="text-2xl font-bold">Waiting for an opponent</h2>
      <p className="text-muted-foreground">
        Send this link to the person you want to race. The board unlocks{" "}
        {RULES.countdownMs / 1000}s after they join.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          data-testid="invite-link"
          className="h-9 w-full rounded-md border bg-muted px-3 font-mono text-sm"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          onClick={() => {
            void navigator.clipboard
              ?.writeText(link)
              .then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">Difficulty: {match.tier}</p>
    </div>
  );
}

function Game({ match }: { match: MatchView }) {
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
  const [flash, setFlash] = useState<{
    cell: number;
    kind: "wrong" | "taken";
  } | null>(null);
  const [lockUntil, setLockUntil] = useState(0);
  const [showResult, setShowResult] = useState(true);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  const startsAt = match.startsAt ?? 0;
  const now = useNow(match.status === "active");
  const countdown = startsAt - now;
  const locked = now < lockUntil;
  const canInput = playing && countdown <= 0 && !locked;

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
    flashTimer.current = setTimeout(() => setFlash(null), 600);
  }, []);

  const place = useCallback(
    async (cell: number, digit: number) => {
      if (!canInput || match.board[cell] !== "0" || pending.has(cell)) return;
      setPending((s) => new Set(s).add(cell));
      try {
        const result = await enter({ matchId, cell, digit });
        if (result.kind === "wrong" || result.kind === "locked") {
          setLockUntil(Date.now() + result.lockoutMs);
          if (result.kind === "wrong") showFlash(cell, "wrong");
        } else if (result.kind === "taken") {
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
      void toggleNote({ matchId, cell, digit });
    },
    [playing, match.board, toggleNote, matchId],
  );

  const clear = useCallback(
    (cell: number) => {
      if (!playing || !notes?.[cell]) return;
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
    function onKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
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
        if (digitFirst && !e.shiftKey)
          setArmedDigit((d) => (d === digit ? null : digit));
        else act(cursor, digit, e.shiftKey || notesMode);
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
      if (key === "n") setNotesMode((m) => !m);
      else if (key === "f") setDigitFirst((m) => !m);
      else if (key === "escape") setArmedDigit(null);
      else if (key === "backspace" || key === "delete") {
        e.preventDefault();
        clear(cursor);
      } else if (
        (key === "enter" || key === " ") &&
        digitFirst &&
        armedDigit !== null
      ) {
        e.preventDefault();
        act(cursor, armedDigit, notesMode);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, digitFirst, notesMode, armedDigit, act, clear]);

  const onCellClick = (cell: number) => {
    setCursor(cell);
    if (digitFirst && armedDigit !== null) act(cell, armedDigit, notesMode);
  };

  const onPadDigit = (digit: number) => {
    if (digitFirst) setArmedDigit((d) => (d === digit ? null : digit));
    else act(cursor, digit, notesMode);
  };

  const selectedValue = Number(match.board[cursor]);
  const activeDigit = digitFirst ? armedDigit : selectedValue || null;

  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-10">
      <div className="relative flex w-full max-w-[560px] flex-col gap-3">
        <Scoreboard match={match} />
        <StatusBar match={match} now={now} lockUntil={lockUntil} />
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
            flash={flash}
            disabled={!canInput}
            onCellClick={onCellClick}
          />
          {match.status === "active" && countdown > 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70 text-7xl font-bold"
              data-testid="countdown"
            >
              {Math.ceil(countdown / 1000)}
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
            onDigit={onPadDigit}
            onToggleNotes={() => setNotesMode((m) => !m)}
            onToggleDigitFirst={() => setDigitFirst((m) => !m)}
            onClearNotes={() => clear(cursor)}
          />
        )}
      </div>
      <aside className="flex w-full max-w-[560px] flex-col gap-4 text-sm lg:w-64">
        {you !== null && match.status === "active" && (
          <PresenceStatus match={match} you={you} />
        )}
        {playing && <ResignButton matchId={matchId} />}
        <Help />
        {match.status === "finished" && !showResult && (
          <Button variant="outline" onClick={() => setShowResult(true)}>
            Show result
          </Button>
        )}
      </aside>
      {match.status === "finished" && showResult && (
        <ResultOverlay match={match} onClose={() => setShowResult(false)} />
      )}
    </div>
  );
}

function Scoreboard({ match }: { match: MatchView }) {
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="scoreboard">
      {match.participants.map((p, i) => {
        const tone = TONE[slotTone(i as Slot, match.you)];
        return (
          <div
            key={p.playerId}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2",
              i === 1 && "flex-row-reverse text-right",
            )}
          >
            <div
              className={cn(
                "flex items-center gap-2",
                i === 1 && "flex-row-reverse",
              )}
            >
              <span className={cn("h-3 w-3 rounded-full", tone.chip)} />
              <span className="font-medium">
                {p.name}
                {i === match.you && (
                  <span className="text-muted-foreground"> (you)</span>
                )}
              </span>
            </div>
            <span
              className={cn("text-2xl font-bold tabular-nums", tone.text)}
              data-testid={`score-${i}`}
            >
              {p.score}
            </span>
          </div>
        );
      })}
      <p className="col-span-2 text-center text-xs text-muted-foreground">
        {Math.floor(match.emptyCount / 2) + 1} of {match.emptyCount} open cells
        clinches
      </p>
    </div>
  );
}

function StatusBar({
  match,
  now,
  lockUntil,
}: {
  match: MatchView;
  now: number;
  lockUntil: number;
}) {
  const me = match.you !== null ? match.participants[match.you] : null;
  const lockLeft = lockUntil - now;
  if (match.status !== "active" || !me) return <div className="h-9" />;
  if (lockLeft > 0) {
    return (
      <div
        className="relative h-9 overflow-hidden rounded-md bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100"
        data-testid="lockout"
      >
        <div
          className="absolute inset-y-0 left-0 bg-red-300/70 dark:bg-red-800/70"
          style={{ width: `${(lockLeft / RULES.wrongEntryLockoutMs) * 100}%` }}
        />
        <span className="relative flex h-full items-center justify-center text-sm font-medium">
          Wrong digit · locked for {(lockLeft / 1000).toFixed(1)}s
        </span>
      </div>
    );
  }
  const idleLeft =
    Math.max(me.lastActiveAt, match.startsAt ?? 0) + RULES.idleForfeitMs - now;
  if (idleLeft < 10_000 && now > (match.startsAt ?? 0)) {
    return (
      <div className="flex h-9 items-center justify-center rounded-md bg-amber-100 text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
        Make a move · you forfeit for inactivity in{" "}
        {Math.max(0, Math.ceil(idleLeft / 1000))}s
      </div>
    );
  }
  return <div className="h-9" />;
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
  return (
    <div
      className="flex items-center gap-2 rounded-md border px-3 py-2"
      data-testid="opponent-presence"
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          online ? "bg-emerald-500" : "bg-zinc-400",
        )}
      />
      {opponent.name} is{" "}
      {online
        ? "connected"
        : `offline · forfeits after ${RULES.disconnectForfeitMs / 1000}s`}
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
        onClick={() => setConfirming(true)}
        data-testid="resign"
      >
        Resign
      </Button>
    );
  }
  return (
    <div className="flex gap-2">
      <Button
        variant="destructive"
        className="flex-1"
        onClick={() => void resign({ matchId })}
        data-testid="resign-confirm"
      >
        Resign match
      </Button>
      <Button variant="outline" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}

function Help() {
  return (
    <div className="space-y-1 rounded-md border p-3 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">Controls</p>
      <p>Move: arrows, WASD, or hjkl</p>
      <p>Enter: 1-9 · Note: Shift+digit or N to toggle notes</p>
      <p>Clear notes: Backspace</p>
      <p>
        Digit-first (F): pick a digit, then click cells; Enter places at the
        cursor
      </p>
    </div>
  );
}

const REASONS: Record<string, (loser: string) => string> = {
  board_full: () => "The board is complete.",
  clinch: () => "Clinched: more than half of the open cells.",
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
  const result = match.result;
  if (!result) return null;
  const winner = result.winner;
  const loserName =
    winner === null
      ? ""
      : (match.participants[winner === 0 ? 1 : 0]?.name ?? "");
  const headline =
    winner === null
      ? "Draw"
      : match.you === null
        ? `${match.participants[winner]?.name} wins`
        : winner === match.you
          ? "You win!"
          : "You lose";
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      data-testid="result"
    >
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-xl">
        <h2 className="text-3xl font-bold" data-testid="result-headline">
          {headline}
        </h2>
        <p className="text-muted-foreground" data-testid="result-reason">
          {REASONS[result.reason](loserName)}
        </p>
        <div className="space-y-1">
          {match.participants.map((p, i) => (
            <div key={p.playerId} className="flex justify-between">
              <span className={TONE[slotTone(i as Slot, match.you)].text}>
                {p.name}
              </span>
              <span className="tabular-nums">
                {p.cells} {p.cells === 1 ? "cell" : "cells"} · {p.wrong} wrong
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => navigate("/")}>
            New match
          </Button>
          <Button variant="outline" onClick={onClose}>
            View board
          </Button>
        </div>
      </div>
    </div>
  );
}
