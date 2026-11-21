import { describe, expect, it } from "vitest";
import { pruneNotesForPlacement } from "./notes";

const mask = (...digits: number[]) =>
  digits.reduce((m, d) => m | (1 << (d - 1)), 0);

describe("pruneNotesForPlacement", () => {
  it("drops the placed digit from row, column, and box peers while preserving other candidates", () => {
    const marks = new Array<number>(81).fill(0);
    // Placing 6 at cell 0 (row 0, col 0, box 0)
    marks[0] = mask(6, 7); // claimed cell itself -> cleared completely
    marks[4] = mask(6, 7, 8); // same row -> becomes {7, 8}
    marks[27] = mask(6, 9); // same col -> becomes {9}
    marks[10] = mask(4, 6); // same 3x3 box -> becomes {4}
    marks[40] = mask(6, 7, 8); // non-peer (center cell) -> untouched

    const next = pruneNotesForPlacement(marks, 0, 6);
    expect(next).not.toBeNull();
    expect(next![0]).toBe(0);
    expect(next![4]).toBe(mask(7, 8));
    expect(next![27]).toBe(mask(9));
    expect(next![10]).toBe(mask(4));
    expect(next![40]).toBe(mask(6, 7, 8));
  });

  it("returns null when no notes are affected", () => {
    const marks = new Array<number>(81).fill(0);
    marks[4] = mask(7, 8); // peer without digit 6
    marks[40] = mask(6); // non-peer with digit 6
    expect(pruneNotesForPlacement(marks, 0, 6)).toBeNull();
  });
});
