import { describe, expect, it } from "vitest";
import { gridToString, parseGrid } from "./grid";
import { countSolutions, solve } from "./solver";

const PUZZLE =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("solver", () => {
  it("solves a known puzzle to its known solution", () => {
    const solved = solve(parseGrid(PUZZLE));
    expect(solved && gridToString(solved)).toBe(SOLUTION);
    expect(countSolutions(parseGrid(PUZZLE))).toBe(1);
  });

  it("finds at least two solutions for an empty grid", () => {
    expect(countSolutions(new Array(81).fill(0))).toBeGreaterThanOrEqual(2);
    expect(countSolutions(new Array(81).fill(0), 5)).toBe(5);
  });

  it("returns 2 for a puzzle with two solutions", () => {
    const base = parseGrid(SOLUTION);
    let found: number[] | null = null;
    for (let r1 = 0; r1 < 9 && !found; r1++) {
      for (
        let r2 = r1 + 1;
        r2 < 9 && Math.floor(r2 / 3) === Math.floor(r1 / 3) && !found;
        r2++
      ) {
        for (let c1 = 0; c1 < 9 && !found; c1++) {
          for (let c2 = c1 + 1; c2 < 9 && !found; c2++) {
            if (Math.floor(c1 / 3) === Math.floor(c2 / 3)) continue;
            const a = base[r1 * 9 + c1];
            const b = base[r1 * 9 + c2];
            if (base[r2 * 9 + c1] === b && base[r2 * 9 + c2] === a) {
              found = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
            }
          }
        }
      }
    }
    const g = parseGrid(SOLUTION);
    if (found) for (const cell of found) g[cell] = 0;
    expect(found).not.toBeNull();
    expect(countSolutions(g, 5)).toBe(2);
    expect(countSolutions(g)).toBe(2);
  });

  it("returns 0 for an invalid or unsolvable grid", () => {
    const dup = parseGrid(PUZZLE);
    dup[2] = 5;
    expect(countSolutions(dup)).toBe(0);
    expect(solve(dup)).toBeNull();

    const stuck = new Array(81).fill(0);
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, i) => (stuck[i] = d));
    stuck[9 + 8] = 9;
    expect(countSolutions(stuck)).toBe(0);
  });
});
