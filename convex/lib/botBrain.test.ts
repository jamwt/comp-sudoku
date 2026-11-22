import { describe, expect, test } from "vitest";
import { BOTS, type BotSkill } from "../gameConfig";
import { planGuess, planMove, thinkTime, type Excluded } from "./botBrain";
import {
  findPlacements,
  generateGradedPuzzle,
  gradePuzzle,
  mulberry32,
  parseGrid,
  type Technique,
} from "./sudoku";

const ALL_TECHNIQUES = BOTS[BOTS.length - 1].skill.techniques;
const perfect = (techniques: readonly Technique[]): BotSkill => ({
  techniques: techniques as BotSkill["techniques"],
  thinkScale: 1,
  errorRate: 0,
  guessAfterMs: 10_000,
});

function puzzles(
  seed: number,
  want: (hardest: Technique) => boolean,
  n: number,
) {
  const rng = mulberry32(seed);
  const out: { givens: string; solution: string; hardest: Technique }[] = [];
  while (out.length < n) {
    const p = generateGradedPuzzle(rng);
    if (want(p.hardest)) out.push(p);
  }
  return out;
}

function setCell(board: string, cell: number, digit: number) {
  return board.slice(0, cell) + digit + board.slice(cell + 1);
}

/** Play the brain alone; the solution is used only to judge entries, like the server. */
function solveAlone(
  puzzle: { givens: string; solution: string },
  skill: BotSkill,
  seed: number,
  allowGuesses: boolean,
) {
  const rng = mulberry32(seed);
  let board = puzzle.givens;
  const excluded: Excluded[] = [];
  let guesses = 0;
  for (let i = 0; i < 500 && board.includes("0"); i++) {
    const plan =
      planMove({ board, excluded }, skill, rng) ??
      (allowGuesses ? planGuess({ board, excluded }, skill, rng) : null);
    if (!plan) break;
    const correct = puzzle.solution[plan.cell] === String(plan.digit);
    if (plan.intent === "guess") {
      guesses++;
      if (!correct) {
        excluded.push({ cell: plan.cell, digit: plan.digit });
        continue;
      }
    } else {
      expect(correct).toBe(true);
    }
    board = setCell(board, plan.cell, plan.digit);
  }
  return { board, guesses, excluded };
}

describe("findPlacements", () => {
  test("every placement it finds matches the solution", () => {
    for (const p of puzzles(1, (h) => h !== "unsolved", 15)) {
      const { placements } = findPlacements(
        parseGrid(p.givens),
        ALL_TECHNIQUES,
      );
      expect(placements.length).toBeGreaterThan(0);
      for (const { cell, digit } of placements) {
        expect(p.solution[cell]).toBe(String(digit));
      }
    }
  });

  test("tags a move with the hardest technique its deduction needed", () => {
    const [p] = puzzles(2, (h) => h === "nakedPair" || h === "pointing", 1);
    let board = p.givens;
    const seen = new Set<Technique>();
    while (board.includes("0")) {
      const { placements } = findPlacements(parseGrid(board), ALL_TECHNIQUES);
      expect(placements.length).toBeGreaterThan(0);
      for (const m of placements) seen.add(m.technique);
      board = setCell(board, placements[0].cell, placements[0].digit);
    }
    expect(seen.has(p.hardest)).toBe(true);
  });

  test("a singles-only solver gets stuck where the grader needed more", () => {
    for (const p of puzzles(
      3,
      (h) => ["pointing", "nakedPair", "hiddenPair"].includes(h),
      5,
    )) {
      const singles = solveAlone(
        p,
        perfect(["hiddenSingle", "nakedSingle"]),
        1,
        false,
      );
      expect(singles.board).toContain("0");
      const full = solveAlone(p, perfect(ALL_TECHNIQUES), 1, false);
      expect(full.board).toBe(p.solution);
    }
  });

  test("excluded digits are eliminated from candidates", () => {
    const [p] = puzzles(
      4,
      (h) => h === "hiddenSingle" || h === "nakedSingle",
      1,
    );
    const grid = parseGrid(p.givens);
    const cell = grid.indexOf(0);
    const correct = Number(p.solution[cell]);
    const wrong = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== correct);
    const { candidates } = findPlacements(
      grid,
      [],
      wrong.map((digit) => ({ cell, digit })),
    );
    expect(candidates[cell]).toBe(1 << (correct - 1));
  });
});

describe("bot brain", () => {
  test("a perfect bot solves easy and medium puzzles by deduction alone", () => {
    for (const p of puzzles(5, (h) => h !== "unsolved", 20)) {
      expect(gradePuzzle(parseGrid(p.givens)).solved).toBe(true);
      const { board, guesses } = solveAlone(
        p,
        perfect(ALL_TECHNIQUES),
        2,
        true,
      );
      expect(board).toBe(p.solution);
      expect(guesses).toBe(0);
    }
  });

  test("a stuck bot guesses, learns from rejected guesses, and finishes", () => {
    for (const p of puzzles(6, (h) => h === "unsolved", 5)) {
      const { board, guesses, excluded } = solveAlone(
        p,
        perfect(["hiddenSingle"]),
        3,
        true,
      );
      expect(board).toBe(p.solution);
      expect(guesses).toBeGreaterThan(0);
      for (const { cell, digit } of excluded) {
        expect(p.solution[cell]).not.toBe(String(digit));
      }
    }
  });

  test("returns null when its techniques find nothing", () => {
    const [p] = puzzles(7, (h) => h === "unsolved", 1);
    const stuck = solveAlone(
      p,
      perfect(["hiddenSingle", "nakedSingle"]),
      4,
      false,
    );
    expect(
      planMove(
        { board: stuck.board, excluded: [] },
        perfect(["hiddenSingle", "nakedSingle"]),
        mulberry32(1),
      ),
    ).toBeNull();
  });

  test("a blunder enters a wrong digit, judged only by logic", () => {
    const [p] = puzzles(
      8,
      (h) => h === "hiddenSingle" || h === "nakedSingle",
      1,
    );
    const skill = { ...perfect(ALL_TECHNIQUES), errorRate: 1 };
    const rng = mulberry32(9);
    for (let i = 0; i < 50; i++) {
      const plan = planMove({ board: p.givens, excluded: [] }, skill, rng)!;
      expect(plan.intent).toBe("blunder");
      expect(p.solution[plan.cell]).not.toBe(String(plan.digit));
    }
  });

  test("blunders happen at roughly the configured rate", () => {
    const [p] = puzzles(
      10,
      (h) => h === "hiddenSingle" || h === "nakedSingle",
      1,
    );
    const skill = { ...perfect(ALL_TECHNIQUES), errorRate: 0.1 };
    const rng = mulberry32(11);
    let blunders = 0;
    for (let i = 0; i < 2000; i++) {
      if (
        planMove({ board: p.givens, excluded: [] }, skill, rng)!.intent ===
        "blunder"
      )
        blunders++;
    }
    expect(blunders / 2000).toBeGreaterThan(0.08);
    expect(blunders / 2000).toBeLessThan(0.12);
  });

  test("think time scales with skill and with technique difficulty", () => {
    const median = (
      technique: Parameters<typeof thinkTime>[0],
      thinkScale: number,
    ) => {
      const rng = mulberry32(12);
      const xs = Array.from({ length: 2001 }, () =>
        thinkTime(technique, { ...perfect([]), thinkScale }, rng),
      ).sort((a, b) => a - b);
      return xs[1000];
    };
    const fast = median("hiddenSingle", 1);
    const slow = median("hiddenSingle", 2);
    expect(slow / fast).toBeGreaterThan(1.8);
    expect(slow / fast).toBeLessThan(2.2);
    expect(median("xWing", 1)).toBeGreaterThan(median("nakedPair", 1));
    expect(median("nakedPair", 1)).toBeGreaterThan(median("nakedSingle", 1));
    expect(median("nakedSingle", 1)).toBeGreaterThan(median("hiddenSingle", 1));
    expect(median("hiddenSingle", 1)).toBeGreaterThan(median("fullHouse", 1));
    // Hard eliminations take substantially longer than simple full houses
    expect(median("pointing", 1) / median("fullHouse", 1)).toBeGreaterThan(8);
  });

  test("strongly favors and speeds up an obvious peer full-house follow-up", () => {
    const solution =
      "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
    // Leave cell 1 (row 0, col 1 — full house in row 0 right next to lastMove cell 0!)
    // plus a 2x2 block of non-full-house hidden singles far away in box 8 (rows 6-7, cols 6-7).
    const chars = solution.split("");
    for (const c of [1, 60, 61, 69, 70]) chars[c] = "0";
    const board = chars.join("");
    const skill = perfect(ALL_TECHNIQUES);
    const rng = mulberry32(42);
    let pickedFollowUp = 0;
    const followUpTimes: number[] = [];
    const coldTimes: number[] = [];

    for (let i = 0; i < 400; i++) {
      const withMomentum = planMove(
        { board, excluded: [], lastMove: { cell: 0, digit: 5 } },
        skill,
        rng,
      )!;
      if (withMomentum.cell === 1) {
        pickedFollowUp++;
        followUpTimes.push(withMomentum.thinkMs);
      }
      const cold = planMove({ board, excluded: [] }, skill, rng)!;
      if (cold.cell === 1) coldTimes.push(cold.thinkMs);
    }

    expect(pickedFollowUp / 400).toBeGreaterThan(0.65);
    const med = (xs: number[]) =>
      [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
    expect(med(followUpTimes)).toBeLessThan(med(coldTimes) * 0.75);
  });
});
