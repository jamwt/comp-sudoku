import { describe, expect, test } from "vitest";
import {
  applyEntry,
  checkForfeit,
  countEmpty,
  emptyOwners,
  evaluateEnd,
  resign,
  type BoardState,
  type ParticipantState,
} from "./engine";
import { RULES } from "../gameConfig";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

function puzzleWithEmpty(cells: number[]): string {
  const chars = SOLUTION.split("");
  for (const c of cells) chars[c] = "0";
  return chars.join("");
}

function participant(over: Partial<ParticipantState> = {}): ParticipantState {
  return {
    score: 0,
    cells: 0,
    wrong: 0,
    lockedUntil: 0,
    lastActiveAt: 0,
    ...over,
  };
}

function stateFor(givens: string): BoardState {
  return {
    board: givens,
    owners: emptyOwners(),
    emptyCount: countEmpty(givens),
    participants: [participant(), participant()],
  };
}

const rules = RULES;
const START = 1_000;

describe("applyEntry", () => {
  const givens = puzzleWithEmpty([0, 1, 2, 3, 4]);

  test("a correct digit in an empty cell claims it", () => {
    const { outcome, next } = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      0,
      5,
      START,
      START,
      rules,
    );
    expect(outcome).toEqual({
      kind: "claimed",
      cell: 0,
      digit: 5,
      result: null,
    });
    expect(next.board[0]).toBe("5");
    expect(next.owners[0]).toBe("0");
    expect(next.participants[0]).toMatchObject({
      cells: 1,
      score: 1,
      lastActiveAt: START,
    });
    expect(next.participants[1]).toEqual(participant());
  });

  test("the first commit wins the cell; the second sees it taken", () => {
    const first = applyEntry(
      stateFor(givens),
      SOLUTION,
      1,
      0,
      5,
      START,
      START,
      rules,
    );
    const second = applyEntry(
      first.next,
      SOLUTION,
      0,
      0,
      5,
      START + 1,
      START,
      rules,
    );
    expect(second.outcome).toEqual({ kind: "taken", cell: 0 });
    expect(second.next.owners[0]).toBe("1");
    expect(second.next.participants[0].cells).toBe(0);
  });

  test("a given cell cannot be claimed", () => {
    const { outcome } = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      10,
      2,
      START,
      START,
      rules,
    );
    expect(outcome).toEqual({ kind: "taken", cell: 10 });
  });

  test("a wrong digit locks input for the configured time", () => {
    const { outcome, next } = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      0,
      1,
      START,
      START,
      rules,
    );
    expect(outcome).toEqual({
      kind: "wrong",
      cell: 0,
      digit: 1,
      lockedUntil: START + RULES.wrongEntryLockoutMs,
    });
    expect(next.board).toBe(givens);
    expect(next.participants[0].wrong).toBe(1);
    expect(next.participants[0].score).toBe(0 - RULES.wrongEntryPointPenalty);
  });

  test("entries during the lockout are rejected, and accepted after it", () => {
    const wrong = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      0,
      1,
      START,
      START,
      rules,
    );
    const during = applyEntry(
      wrong.next,
      SOLUTION,
      0,
      0,
      5,
      START + RULES.wrongEntryLockoutMs - 1,
      START,
      rules,
    );
    expect(during.outcome.kind).toBe("locked");
    expect(during.next).toBe(wrong.next);
    const after = applyEntry(
      wrong.next,
      SOLUTION,
      0,
      0,
      5,
      START + RULES.wrongEntryLockoutMs,
      START,
      rules,
    );
    expect(after.outcome.kind).toBe("claimed");
  });

  test("the lockout only affects the player who erred", () => {
    const wrong = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      0,
      1,
      START,
      START,
      rules,
    );
    const other = applyEntry(
      wrong.next,
      SOLUTION,
      1,
      0,
      5,
      START + 1,
      START,
      rules,
    );
    expect(other.outcome.kind).toBe("claimed");
  });

  test("the point penalty is applied when configured", () => {
    const { next } = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      0,
      1,
      START,
      START,
      {
        ...rules,
        wrongEntryPointPenalty: 2,
      },
    );
    expect(next.participants[0].score).toBe(-2);
  });

  test("entries before the countdown ends are rejected", () => {
    const { outcome } = applyEntry(
      stateFor(givens),
      SOLUTION,
      0,
      0,
      5,
      START - 1,
      START,
      rules,
    );
    expect(outcome).toEqual({ kind: "not_started", startsAt: START });
  });

  test("invalid cells and digits throw", () => {
    expect(() =>
      applyEntry(stateFor(givens), SOLUTION, 0, 81, 5, START, START, rules),
    ).toThrow();
    expect(() =>
      applyEntry(stateFor(givens), SOLUTION, 0, 0, 0, START, START, rules),
    ).toThrow();
    expect(() =>
      applyEntry(stateFor(givens), SOLUTION, 0, 0, 10, START, START, rules),
    ).toThrow();
  });
});

describe("match end", () => {
  test("holding more than half of the empty cells clinches early", () => {
    const givens = puzzleWithEmpty([0, 1, 2, 3, 4]);
    let state = stateFor(givens);
    state = applyEntry(state, SOLUTION, 0, 0, 5, START, START, rules).next;
    state = applyEntry(state, SOLUTION, 1, 1, 3, START, START, rules).next;
    const second = applyEntry(state, SOLUTION, 0, 2, 4, START, START, rules);
    expect(second.outcome).toMatchObject({ kind: "claimed", result: null });
    const third = applyEntry(
      second.next,
      SOLUTION,
      0,
      3,
      6,
      START,
      START,
      rules,
    );
    expect(third.outcome).toMatchObject({
      kind: "claimed",
      result: { winner: 0, reason: "clinch" },
    });
  });

  test("exactly half of an even count is not a clinch", () => {
    const givens = puzzleWithEmpty([0, 1, 2, 3]);
    let state = stateFor(givens);
    state = applyEntry(state, SOLUTION, 1, 0, 5, START, START, rules).next;
    const r = applyEntry(state, SOLUTION, 1, 1, 3, START, START, rules);
    expect(r.outcome).toMatchObject({ kind: "claimed", result: null });
  });

  test("a full board ends the match; most cells wins", () => {
    const givens = puzzleWithEmpty([0, 1, 2]);
    let state = stateFor(givens);
    state = applyEntry(state, SOLUTION, 0, 0, 5, START, START, rules).next;
    state = applyEntry(state, SOLUTION, 1, 1, 3, START, START, rules).next;
    const last = applyEntry(state, SOLUTION, 1, 2, 4, START, START, rules);
    expect(last.outcome).toMatchObject({
      kind: "claimed",
      result: { winner: 1, reason: "board_full" },
    });
  });

  test("a full board with equal scores is a draw", () => {
    const state: BoardState = {
      ...stateFor(puzzleWithEmpty([0, 1])),
      participants: [
        participant({ cells: 1, score: 1 }),
        participant({ cells: 1, score: 1 }),
      ],
    };
    expect(evaluateEnd(state)).toEqual({ winner: null, reason: "board_full" });
  });

  test("with a point penalty the full-board winner is the higher score", () => {
    const state: BoardState = {
      ...stateFor(puzzleWithEmpty([0, 1, 2])),
      participants: [
        participant({ cells: 2, score: 0, wrong: 2 }),
        participant({ cells: 1, score: 1 }),
      ],
    };
    expect(evaluateEnd(state)).toEqual({ winner: 1, reason: "board_full" });
  });

  test("resigning hands the win to the opponent", () => {
    expect(resign(0)).toEqual({ winner: 1, reason: "resign" });
    expect(resign(1)).toEqual({ winner: 0, reason: "resign" });
  });
});

describe("checkForfeit", () => {
  const online = { online: true, lastDisconnected: null };
  const base = stateFor(puzzleWithEmpty([0, 1, 2]));

  test("exempt players (bots) never forfeit; the other player still can", () => {
    const bot = { online: true, lastDisconnected: null, exempt: true };
    const state = {
      ...base,
      participants: [
        participant({ lastActiveAt: START }),
        participant({ lastActiveAt: START }),
      ],
    };
    const later = START + RULES.idleForfeitMs + 1;
    const r = checkForfeit(state, [online, bot], START, later, rules);
    expect(r.result).toEqual({ winner: 1, reason: "forfeit_idle" });
    const both = checkForfeit(state, [bot, bot], START, later * 10, rules);
    expect(both.result).toBeNull();
    expect(both.nextCheckAt).toBe(Infinity);
  });

  test("nobody forfeits while both are active; next check is the earliest idle deadline", () => {
    const state = {
      ...base,
      participants: [
        participant({ lastActiveAt: START + 5_000 }),
        participant({ lastActiveAt: START + 2_000 }),
      ],
    };
    const r = checkForfeit(
      state,
      [online, online],
      START,
      START + 10_000,
      rules,
    );
    expect(r.result).toBeNull();
    expect(r.nextCheckAt).toBe(START + 2_000 + RULES.idleForfeitMs);
  });

  test("a player idle past the limit forfeits", () => {
    const state = {
      ...base,
      participants: [
        participant({ lastActiveAt: START + 20_000 }),
        participant({ lastActiveAt: START }),
      ],
    };
    const r = checkForfeit(
      state,
      [online, online],
      START,
      START + RULES.idleForfeitMs,
      rules,
    );
    expect(r.result).toEqual({ winner: 0, reason: "forfeit_idle" });
  });

  test("idle time counts from the start, not from before the countdown", () => {
    const r = checkForfeit(
      base,
      [online, online],
      START,
      START + RULES.idleForfeitMs - 1,
      rules,
    );
    expect(r.result).toBeNull();
  });

  test("a disconnected player forfeits after the grace period", () => {
    const fast = {
      ...rules,
      idleForfeitMs: 60_000,
      disconnectForfeitMs: 30_000,
    };
    const state = {
      ...base,
      participants: [
        participant({ lastActiveAt: START + 9_000 }),
        participant({ lastActiveAt: START + 9_000 }),
      ],
    };
    const offline = { online: false, lastDisconnected: START + 10_000 };
    const before = checkForfeit(
      state,
      [online, offline],
      START,
      START + 39_999,
      fast,
    );
    expect(before.result).toBeNull();
    expect(before.nextCheckAt).toBe(START + 40_000);
    const after = checkForfeit(
      state,
      [online, offline],
      START,
      START + 40_000,
      fast,
    );
    expect(after.result).toEqual({ winner: 0, reason: "forfeit_disconnect" });
  });

  test("when both are overdue, the one overdue longest forfeits", () => {
    const state = {
      ...base,
      participants: [
        participant({ lastActiveAt: START + 1_000 }),
        participant({ lastActiveAt: START + 500 }),
      ],
    };
    const r = checkForfeit(
      state,
      [online, online],
      START,
      START + 60_000,
      rules,
    );
    expect(r.result).toEqual({ winner: 0, reason: "forfeit_idle" });
  });
});
