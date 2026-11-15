export type Grid = number[];

const rowsOf = (): number[][] =>
  Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => r * 9 + c),
  );
const colsOf = (): number[][] =>
  Array.from({ length: 9 }, (_, c) =>
    Array.from({ length: 9 }, (_, r) => r * 9 + c),
  );
const boxesOf = (): number[][] =>
  Array.from({ length: 9 }, (_, b) =>
    Array.from({ length: 9 }, (_, i) => {
      const r = Math.floor(b / 3) * 3 + Math.floor(i / 3);
      const c = (b % 3) * 3 + (i % 3);
      return r * 9 + c;
    }),
  );

export const ROWS: number[][] = rowsOf();
export const COLS: number[][] = colsOf();
export const BOXES: number[][] = boxesOf();
export const UNITS: number[][] = [...ROWS, ...COLS, ...BOXES];

export const PEERS: number[][] = Array.from({ length: 81 }, (_, cell) => {
  const r = Math.floor(cell / 9);
  const c = cell % 9;
  const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
  const set = new Set<number>([...ROWS[r], ...COLS[c], ...BOXES[b]]);
  set.delete(cell);
  return [...set];
});

/** Counts the set bits in a candidate bitmask. */
export function popcount(n: number): number {
  let count = 0;
  while (n) {
    n &= n - 1;
    count++;
  }
  return count;
}

/** Parses an 81-character puzzle string ('0' or '.' for empty) into a grid; throws on bad input. */
export function parseGrid(s: string): Grid {
  if (s.length !== 81)
    throw new Error(`Grid string must have 81 characters, got ${s.length}`);
  const g: Grid = [];
  for (const ch of s) {
    if (ch === "." || ch === "0") g.push(0);
    else if (ch >= "1" && ch <= "9") g.push(Number(ch));
    else throw new Error(`Invalid grid character: ${ch}`);
  }
  return g;
}

/** Serializes a grid to an 81-character string with '0' for empty cells. */
export function gridToString(g: Grid): string {
  return g.join("");
}

/** True when placing digit in cell conflicts with no peer (the cell's current value is ignored). */
export function isValidPlacement(
  g: Grid,
  cell: number,
  digit: number,
): boolean {
  return !PEERS[cell].some((p) => g[p] === digit);
}

/** True when the grid is fully filled and every unit holds each digit 1-9 exactly once. */
export function isCompleteSolution(g: Grid): boolean {
  if (g.length !== 81) return false;
  return UNITS.every((unit) => {
    let seen = 0;
    for (const cell of unit) {
      const v = g[cell];
      if (!Number.isInteger(v) || v < 1 || v > 9) return false;
      seen |= 1 << (v - 1);
    }
    return seen === 0x1ff;
  });
}
