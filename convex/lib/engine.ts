import type { Rules } from "../gameConfig";

/**
 * The pure rules engine. It knows nothing about Convex: mutations load a
 * match, call these functions, and persist what they return.
 */

export type Slot = 0 | 1;

export type EndReason =
  | "board_full"
  | "clinch"
  | "resign"
  | "forfeit_idle"
  | "forfeit_disconnect";

export type MatchResult = { winner: Slot | null; reason: EndReason };

export type ParticipantState = {
  score: number;
  cells: number;
  wrong: number;
  lockedUntil: number;
  lastActiveAt: number;
};

export type BoardState = {
  /** 81 chars: givens plus claimed digits, "0" where empty. */
  board: string;
  /** 81 chars: "0"/"1" for the claiming slot, "." for givens and empty cells. */
  owners: string;
  /** Number of cells that were empty in the puzzle. */
  emptyCount: number;
  participants: ParticipantState[];
};

export type EntryOutcome =
  | { kind: "claimed"; cell: number; digit: number; result: MatchResult | null }
  | { kind: "wrong"; cell: number; digit: number; lockedUntil: number }
  | { kind: "locked"; lockedUntil: number }
  | { kind: "taken"; cell: number }
  | { kind: "not_started"; startsAt: number };

export const UNOWNED = ".";

export function emptyOwners(): string {
  return UNOWNED.repeat(81);
}

export function countEmpty(givens: string): number {
  let n = 0;
  for (const ch of givens) if (ch === "0") n++;
  return n;
}

function setChar(s: string, i: number, ch: string): string {
  return s.slice(0, i) + ch + s.slice(i + 1);
}

/**
 * Apply one digit entry by `slot`. The caller guarantees the match is active.
 * Returns the outcome and the next state (unchanged unless claimed or wrong).
 */
export function applyEntry(
  state: BoardState,
  solution: string,
  slot: Slot,
  cell: number,
  digit: number,
  now: number,
  startsAt: number,
  rules: Pick<Rules, "wrongEntryLockoutMs" | "wrongEntryPointPenalty">,
): { outcome: EntryOutcome; next: BoardState } {
  if (!Number.isInteger(cell) || cell < 0 || cell > 80) {
    throw new Error(`Invalid cell ${cell}`);
  }
  if (!Number.isInteger(digit) || digit < 1 || digit > 9) {
    throw new Error(`Invalid digit ${digit}`);
  }
  if (now < startsAt) {
    return { outcome: { kind: "not_started", startsAt }, next: state };
  }
  const me = state.participants[slot];
  if (now < me.lockedUntil) {
    return {
      outcome: { kind: "locked", lockedUntil: me.lockedUntil },
      next: state,
    };
  }
  if (state.board[cell] !== "0") {
    return { outcome: { kind: "taken", cell }, next: touch(state, slot, now) };
  }
  if (solution[cell] !== String(digit)) {
    const lockedUntil = now + rules.wrongEntryLockoutMs;
    const participants = state.participants.map((p, i) =>
      i === slot
        ? {
            ...p,
            lockedUntil,
            lastActiveAt: now,
            wrong: p.wrong + 1,
            score: p.score - rules.wrongEntryPointPenalty,
          }
        : p,
    );
    return {
      outcome: { kind: "wrong", cell, digit, lockedUntil },
      next: { ...state, participants },
    };
  }
  const participants = state.participants.map((p, i) =>
    i === slot
      ? { ...p, cells: p.cells + 1, score: p.score + 1, lastActiveAt: now }
      : p,
  );
  const next: BoardState = {
    ...state,
    board: setChar(state.board, cell, String(digit)),
    owners: setChar(state.owners, cell, String(slot)),
    participants,
  };
  return {
    outcome: { kind: "claimed", cell, digit, result: evaluateEnd(next) },
    next,
  };
}

function touch(state: BoardState, slot: Slot, now: number): BoardState {
  return {
    ...state,
    participants: state.participants.map((p, i) =>
      i === slot ? { ...p, lastActiveAt: now } : p,
    ),
  };
}

/** Record non-entry activity (such as a note edit) for the idle timer. */
export function recordActivity(
  state: BoardState,
  slot: Slot,
  now: number,
): BoardState {
  return touch(state, slot, now);
}

/** Cells still unclaimed. */
export function remainingCells(state: BoardState): number {
  const claimed = state.participants.reduce((n, p) => n + p.cells, 0);
  return state.emptyCount - claimed;
}

/**
 * The match ends when the board is full, or early once one player's score
 * exceeds the best score the opponent could still reach. With no point
 * penalty that is exactly "holds more than half of the originally empty
 * cells".
 */
export function evaluateEnd(state: BoardState): MatchResult | null {
  const [a, b] = state.participants;
  if (!a || !b) return null;
  const remaining = remainingCells(state);
  if (remaining === 0) {
    if (a.score === b.score) return { winner: null, reason: "board_full" };
    return { winner: a.score > b.score ? 0 : 1, reason: "board_full" };
  }
  if (a.score > b.score + remaining) return { winner: 0, reason: "clinch" };
  if (b.score > a.score + remaining) return { winner: 1, reason: "clinch" };
  return null;
}

export function resign(slot: Slot): MatchResult {
  return { winner: other(slot), reason: "resign" };
}

export function other(slot: Slot): Slot {
  return slot === 0 ? 1 : 0;
}

export type PresenceInfo = {
  online: boolean;
  /** When the player last went offline; null if never seen in the room. */
  lastDisconnected: number | null;
};

/**
 * Decide whether anyone forfeits at `now`, and when to check again.
 * A player forfeits after `idleForfeitMs` without an entry or note, or after
 * `disconnectForfeitMs` offline. A player never seen online counts as offline
 * since the match started.
 */
export function checkForfeit(
  state: BoardState,
  presence: PresenceInfo[],
  startsAt: number,
  now: number,
  rules: Pick<Rules, "idleForfeitMs" | "disconnectForfeitMs">,
): { result: MatchResult | null; nextCheckAt: number } {
  const deadlines = state.participants.map((p, i) => {
    const idleAt = Math.max(p.lastActiveAt, startsAt) + rules.idleForfeitMs;
    const info = presence[i];
    if (info.online) return { at: idleAt, reason: "forfeit_idle" as const };
    const offlineSince = Math.max(info.lastDisconnected ?? startsAt, startsAt);
    const disconnectAt = offlineSince + rules.disconnectForfeitMs;
    return disconnectAt <= idleAt
      ? { at: disconnectAt, reason: "forfeit_disconnect" as const }
      : { at: idleAt, reason: "forfeit_idle" as const };
  });
  const due = deadlines
    .map((d, i) => ({ ...d, slot: i as Slot }))
    .filter((d) => d.at <= now)
    .sort((x, y) => x.at - y.at);
  if (due.length > 0) {
    const loser = due[0];
    return {
      result: { winner: other(loser.slot), reason: loser.reason },
      nextCheckAt: now,
    };
  }
  return {
    result: null,
    nextCheckAt: Math.min(...deadlines.map((d) => d.at)),
  };
}
