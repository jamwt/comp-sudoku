import { describe, expect, it } from "vitest";
import { generateGradedPuzzle, generatePuzzle } from "./index";
import { TECHNIQUE_TIER, Tier, gradePuzzle } from "./grader";
import { gridToString, parseGrid } from "./grid";
import { mulberry32 } from "./rng";
import { countSolutions, solve } from "./solver";

const EASY =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const NAKED_PAIR =
  "056007000001900800040050160032500609000000000405001280014080030003006900000700510";
const POINTING =
  "200010070040008300005460001302006000500000003000900207800094700009100080020050006";
const AI_ESCARGOT =
  "100007090030020008009600500005300900010080002600004000300000010040000007007000300";

describe("grader", () => {
  it("maps techniques to tiers", () => {
    expect(TECHNIQUE_TIER.nakedSingle).toBe("easy");
    expect(TECHNIQUE_TIER.hiddenSingle).toBe("easy");
    expect(TECHNIQUE_TIER.nakedPair).toBe("medium");
    expect(TECHNIQUE_TIER.pointing).toBe("medium");
    expect(TECHNIQUE_TIER.xWing).toBe("hard");
    expect(TECHNIQUE_TIER.unsolved).toBe("hard");
  });

  it("grades a singles-only puzzle easy", () => {
    expect(countSolutions(parseGrid(EASY))).toBe(1);
    const r = gradePuzzle(parseGrid(EASY));
    expect(r.solved).toBe(true);
    expect(r.tier).toBe("easy");
    expect(["nakedSingle", "hiddenSingle"]).toContain(r.hardest);
    expect(
      Object.keys(r.counts).every(
        (t) => t === "nakedSingle" || t === "hiddenSingle",
      ),
    ).toBe(true);
  });

  it("grades a puzzle that needs a naked pair medium", () => {
    expect(countSolutions(parseGrid(NAKED_PAIR))).toBe(1);
    const r = gradePuzzle(parseGrid(NAKED_PAIR));
    expect(r).toMatchObject({
      tier: "medium",
      hardest: "nakedPair",
      solved: true,
    });
    expect(r.counts.nakedPair).toBeGreaterThanOrEqual(1);
  });

  it("grades a puzzle that needs pointing pairs medium", () => {
    expect(countSolutions(parseGrid(POINTING))).toBe(1);
    const r = gradePuzzle(parseGrid(POINTING));
    expect(r).toMatchObject({
      tier: "medium",
      hardest: "pointing",
      solved: true,
    });
    expect(r.counts.pointing).toBeGreaterThanOrEqual(1);
  });

  it("grades AI Escargot hard and unsolved by the implemented techniques", () => {
    expect(AI_ESCARGOT).toHaveLength(81);
    expect(countSolutions(parseGrid(AI_ESCARGOT))).toBe(1);
    const r = gradePuzzle(parseGrid(AI_ESCARGOT));
    expect(r.tier).toBe("hard");
    expect(r.hardest).toBe("unsolved");
    expect(r.solved).toBe(false);
  });

  it("solves every non-hard generated puzzle, matching the generator's solution", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const { givens, solution } = generatePuzzle(mulberry32(seed));
      const r = gradePuzzle(givens);
      if (r.tier === "hard") continue;
      expect(r.solved).toBe(true);
      expect(solve(givens)).toEqual(solution);
    }
  });

  it("generateGradedPuzzle returns a consistent graded puzzle", () => {
    const p = generateGradedPuzzle(mulberry32(3));
    expect(p.givens).toHaveLength(81);
    expect(p.solution).toHaveLength(81);
    expect(p.clueCount).toBe(
      p.givens.split("").filter((c) => c !== "0").length,
    );
    expect(p.tier).toBe(gradePuzzle(parseGrid(p.givens)).tier);
    expect(gridToString(solve(parseGrid(p.givens))!)).toBe(p.solution);
  });

  it("reports the tier distribution of 200 seeded puzzles", () => {
    const tiers: Record<Tier, number> = { easy: 0, medium: 0, hard: 0 };
    const start = Date.now();
    for (let seed = 1; seed <= 200; seed++)
      tiers[generateGradedPuzzle(mulberry32(seed)).tier]++;
    const perPuzzle = (Date.now() - start) / 200;
    console.log(
      `tier distribution (200 seeds): ${JSON.stringify(tiers)}, ${perPuzzle.toFixed(2)} ms/puzzle`,
    );
    expect(tiers.easy + tiers.medium + tiers.hard).toBe(200);
  });
});
