import { Grid, popcount } from "./grid";

const boxOf = (cell: number) =>
  Math.floor(cell / 27) * 3 + Math.floor((cell % 9) / 3);

/** Counts solutions with bitmask backtracking and MRV, stopping at limit; 0 for a grid with conflicting givens. */
export function countSolutions(g: Grid, limit = 2): number {
  return search(g, limit, false).count;
}

/** Returns one solution, or null when the grid has none. */
export function solve(g: Grid): Grid | null {
  return search(g, 1, true).solution;
}

function search(
  g: Grid,
  limit: number,
  keep: boolean,
): { count: number; solution: Grid | null } {
  const cells = g.slice();
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i++) {
    const v = cells[i];
    if (v === 0) continue;
    const bit = 1 << (v - 1);
    const r = Math.floor(i / 9);
    const c = i % 9;
    const b = boxOf(i);
    if (rows[r] & bit || cols[c] & bit || boxes[b] & bit)
      return { count: 0, solution: null };
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[b] |= bit;
  }

  let count = 0;
  let solution: Grid | null = null;

  const recurse = (): void => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (cells[i] !== 0) continue;
      const mask =
        ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]) & 0x1ff;
      const n = popcount(mask);
      if (n < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = n;
        if (n <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      if (keep && solution === null) solution = cells.slice();
      return;
    }
    if (bestCount === 0) return;
    const r = Math.floor(best / 9);
    const c = best % 9;
    const b = boxOf(best);
    let mask = bestMask;
    while (mask && count < limit) {
      const bit = mask & -mask;
      mask ^= bit;
      cells[best] = 31 - Math.clz32(bit) + 1;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      recurse();
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      cells[best] = 0;
    }
  };

  recurse();
  return { count, solution };
}
