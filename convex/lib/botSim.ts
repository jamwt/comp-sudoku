import type { BotSkill, Rules } from "../gameConfig";
import { nextPlan, sampleForm, type BotPlan, type Excluded } from "./botBrain";
import {
  applyEntry,
  countEmpty,
  emptyOwners,
  evaluateEnd,
  remainingCells,
  type BoardState,
  type MatchResult,
  type Slot,
} from "./engine";
import type { Rng } from "./sudoku";

/**
 * Plays bots against each other (or one bot alone) on a virtual clock with
 * the same brain and rules engine the server uses, for calibration. The
 * engine is the only thing that sees the solution, as on the server.
 */

type BotState = {
  plan: BotPlan | null;
  dueAt: number;
  stuck: boolean;
  excluded: Excluded[];
};

export type SimResult = {
  durationMs: number;
  result: MatchResult | null;
  cells: number[];
  wrong: number[];
  guesses: number[];
  emptyCount: number;
};

export function simulate(
  puzzle: { givens: string; solution: string },
  skills: BotSkill[],
  rules: Pick<Rules, "wrongEntryLockoutMs" | "wrongEntryPointPenalty">,
  rng: Rng,
  maxMs = 60 * 60_000,
): SimResult {
  let state: BoardState = {
    board: puzzle.givens,
    owners: emptyOwners(),
    emptyCount: countEmpty(puzzle.givens),
    participants: skills.map(() => ({
      score: 0,
      cells: 0,
      wrong: 0,
      lockedUntil: 0,
      lastActiveAt: 0,
    })),
  };
  const guesses = skills.map(() => 0);
  const inForm = skills.map((skill) => ({
    ...skill,
    thinkScale: skill.thinkScale * sampleForm(rng),
  }));
  const bots: BotState[] = skills.map(() => ({
    plan: null,
    dueAt: 0,
    stuck: false,
    excluded: [],
  }));
  const replan = (i: number, now: number) => {
    const next = nextPlan(
      { board: state.board, excluded: bots[i].excluded },
      inForm[i],
      now,
      state.participants[i].lockedUntil,
      rng,
    );
    bots[i] = next
      ? { ...bots[i], plan: next.plan, dueAt: next.dueAt, stuck: next.stuck }
      : { ...bots[i], plan: null, dueAt: Infinity, stuck: false };
  };
  bots.forEach((_, i) => replan(i, 0));

  let now = 0;
  let result: MatchResult | null = null;
  for (;;) {
    const i = bots.reduce(
      (best, b, j) => (b.dueAt < bots[best].dueAt ? j : best),
      0,
    );
    const plan = bots[i].plan;
    if (!plan || bots[i].dueAt > maxMs) break;
    now = bots[i].dueAt;
    if (state.board[plan.cell] === "0") {
      if (plan.intent === "guess") guesses[i]++;
      const { outcome, next } = applyEntry(
        state,
        puzzle.solution,
        i as Slot,
        plan.cell,
        plan.digit,
        now,
        0,
        rules,
      );
      state = next;
      if (outcome.kind === "wrong" && plan.intent === "guess") {
        bots[i].excluded = [
          ...bots[i].excluded,
          { cell: plan.cell, digit: plan.digit },
        ];
      }
      if (outcome.kind === "claimed") {
        result = skills.length > 1 ? evaluateEnd(state) : null;
        if (result || remainingCells(state) === 0) break;
        bots.forEach((b, j) => {
          if (j !== i && (b.stuck || b.plan?.cell === plan.cell))
            replan(j, now);
        });
      }
    }
    replan(i, now);
  }
  return {
    durationMs: now,
    result,
    cells: state.participants.map((p) => p.cells),
    wrong: state.participants.map((p) => p.wrong),
    guesses,
    emptyCount: state.emptyCount,
  };
}
