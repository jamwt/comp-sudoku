import { describe, expect, it } from "vitest";
import {
  BOXES,
  COLS,
  PEERS,
  ROWS,
  UNITS,
  gridToString,
  isCompleteSolution,
  isValidPlacement,
  parseGrid,
} from "./grid";

const SOLVED =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("grid helpers", () => {
  it("has the right unit and peer sizes", () => {
    expect(ROWS).toHaveLength(9);
    expect(COLS).toHaveLength(9);
    expect(BOXES).toHaveLength(9);
    expect(UNITS).toHaveLength(27);
    for (const unit of UNITS) expect(new Set(unit).size).toBe(9);
    expect(PEERS).toHaveLength(81);
    for (const peers of PEERS) expect(new Set(peers).size).toBe(20);
  });

  it("round-trips parse and serialize, treating '.' as empty", () => {
    const s =
      "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79";
    const g = parseGrid(s);
    expect(g).toHaveLength(81);
    expect(g[0]).toBe(5);
    expect(g[2]).toBe(0);
    expect(gridToString(g)).toBe(s.replace(/\./g, "0"));
    expect(parseGrid(gridToString(g))).toEqual(g);
  });

  it("throws on invalid input", () => {
    expect(() => parseGrid("123")).toThrow();
    expect(() => parseGrid("x".repeat(81))).toThrow();
    expect(() => parseGrid("0".repeat(82))).toThrow();
  });

  it("checks placements and complete solutions", () => {
    const g = parseGrid(SOLVED);
    expect(isCompleteSolution(g)).toBe(true);
    expect(isCompleteSolution(parseGrid("0" + SOLVED.slice(1)))).toBe(false);
    const swapped = g.slice();
    swapped[0] = g[1];
    expect(isCompleteSolution(swapped)).toBe(false);

    const empty = new Array(81).fill(0);
    empty[0] = 5;
    expect(isValidPlacement(empty, 1, 5)).toBe(false);
    expect(isValidPlacement(empty, 9, 5)).toBe(false);
    expect(isValidPlacement(empty, 10, 5)).toBe(false);
    expect(isValidPlacement(empty, 80, 5)).toBe(true);
    expect(isValidPlacement(empty, 1, 4)).toBe(true);
  });
});
