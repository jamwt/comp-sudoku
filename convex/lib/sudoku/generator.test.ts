import { describe, expect, it } from "vitest";
import { generatePuzzle, generateSolvedGrid } from "./generator";
import { isCompleteSolution } from "./grid";
import { mulberry32 } from "./rng";
import { countSolutions } from "./solver";

describe("generator", () => {
  it("is deterministic for a seeded rng", () => {
    expect(generatePuzzle(mulberry32(42))).toEqual(
      generatePuzzle(mulberry32(42)),
    );
    expect(generatePuzzle(mulberry32(42))).not.toEqual(
      generatePuzzle(mulberry32(43)),
    );
    expect(generateSolvedGrid(mulberry32(7))).toEqual(
      generateSolvedGrid(mulberry32(7)),
    );
  });

  it("produces a complete valid solution and consistent, unique givens", () => {
    for (let seed = 1; seed <= 5; seed++) {
      const { givens, solution } = generatePuzzle(mulberry32(seed));
      expect(isCompleteSolution(solution)).toBe(true);
      givens.forEach((v, i) => {
        if (v !== 0) expect(v).toBe(solution[i]);
      });
      expect(givens.some((v) => v === 0)).toBe(true);
      expect(countSolutions(givens)).toBe(1);
    }
  });

  it("produces 180-degree symmetric givens by default and when requested", () => {
    for (const opts of [undefined, { symmetric: true }]) {
      const { givens } = generatePuzzle(mulberry32(11), opts);
      for (let i = 0; i < 81; i++) {
        expect(givens[i] === 0).toBe(givens[80 - i] === 0);
      }
    }
  });

  it("still yields unique puzzles when symmetry is disabled", () => {
    const { givens } = generatePuzzle(mulberry32(5), { symmetric: false });
    expect(countSolutions(givens)).toBe(1);
  });

  it("generates 20 puzzles quickly", () => {
    const start = Date.now();
    for (let seed = 100; seed < 120; seed++) generatePuzzle(mulberry32(seed));
    expect(Date.now() - start).toBeLessThan(5000);
  });
});
