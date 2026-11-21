import { PEERS } from "./sudoku/grid";

/**
 * Strips invalidated pencil marks after a valid placement of `digit` at `cell`:
 * clears `cell` itself and removes `digit` from every row, column, and 3x3 box peer.
 * Returns a new 81-entry array if anything changed, or null when no marks were affected.
 */
export function pruneNotesForPlacement(
  marks: readonly number[],
  cell: number,
  digit: number,
): number[] | null {
  if (cell < 0 || cell > 80 || digit < 1 || digit > 9) return null;
  const bit = 1 << (digit - 1);
  let next: number[] | null = null;

  if (marks[cell] !== 0) {
    next = marks.slice();
    next[cell] = 0;
  }

  for (const peer of PEERS[cell]) {
    if ((marks[peer] & bit) !== 0) {
      if (next === null) next = marks.slice();
      next[peer] &= ~bit;
    }
  }

  return next;
}
