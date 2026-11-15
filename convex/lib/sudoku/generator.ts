import { Grid } from "./grid";
import { countSolutions } from "./solver";
import { Rng, shuffle } from "./rng";

const boxOf = (cell: number) =>
  Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3);

/** Builds a random complete valid grid by randomized backtracking. */
export function generateSolvedGrid(rng: Rng): Grid {
  const cells: Grid = new Array(81).fill(0);
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);

  const fill = (i: number): boolean => {
    if (i === 81) return true;
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = boxOf(i);
    const digits: number[] = [];
    for (let d = 1; d <= 9; d++) {
      if (!((rows[r] | cols[c] | boxes[b]) & (1 << (d - 1)))) digits.push(d);
    }
    shuffle(digits, rng);
    for (const d of digits) {
      const bit = 1 << (d - 1);
      cells[i] = d;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      if (fill(i + 1)) return true;
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      cells[i] = 0;
    }
    return false;
  };

  fill(0);
  return cells;
}

/** Generates a uniquely solvable puzzle by removing clues (180-degree symmetric pairs by default) while the solution stays unique. */
export function generatePuzzle(
  rng: Rng,
  opts: { symmetric?: boolean } = {},
): { givens: Grid; solution: Grid } {
  const symmetric = opts.symmetric ?? true;
  const solution = generateSolvedGrid(rng);
  const givens = solution.slice();

  const order: number[] = [];
  for (let i = 0; i < 81; i++) {
    if (!symmetric || i <= 80 - i) order.push(i);
  }
  shuffle(order, rng);

  for (const cell of order) {
    const targets =
      symmetric && cell !== 80 - cell ? [cell, 80 - cell] : [cell];
    const saved = targets.map((t) => givens[t]);
    for (const t of targets) givens[t] = 0;
    if (countSolutions(givens, 2) !== 1) {
      targets.forEach((t, i) => (givens[t] = saved[i]));
    }
  }

  return { givens, solution };
}
