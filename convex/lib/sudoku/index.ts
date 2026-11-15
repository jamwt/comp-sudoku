import { gridToString } from "./grid";
import { generatePuzzle } from "./generator";
import { gradePuzzle, Technique, Tier } from "./grader";
import { Rng } from "./rng";

export * from "./grid";
export * from "./solver";
export * from "./rng";
export * from "./generator";
export * from "./grader";

/** Generates a unique puzzle, grades it, and returns it as strings with its tier. */
export function generateGradedPuzzle(
  rng: Rng,
  opts?: { symmetric?: boolean },
): {
  givens: string;
  solution: string;
  tier: Tier;
  hardest: Technique;
  clueCount: number;
} {
  const { givens, solution } = generatePuzzle(rng, opts);
  const { tier, hardest } = gradePuzzle(givens);
  return {
    givens: gridToString(givens),
    solution: gridToString(solution),
    tier,
    hardest,
    clueCount: givens.filter((v) => v !== 0).length,
  };
}
