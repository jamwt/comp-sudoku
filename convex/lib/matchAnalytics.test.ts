import { describe, expect, it } from "vitest";
import { classifyPlacement, parseGrid } from "./sudoku";
import {
  buildLeadTimeline,
  buildStrategyBreakdown,
  type MatchMove,
} from "./matchAnalytics";

const SOLUTION =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";

describe("classifyPlacement", () => {
  it("identifies a Full House when a unit has only one empty cell", () => {
    const board = parseGrid("0" + SOLUTION.slice(1));
    expect(classifyPlacement(board, 0, 5)).toBe("fullHouse");
  });

  it("identifies a Hidden Single when a digit has only one spot in a unit", () => {
    // Empty row 0 cells 0 (5) and 1 (3), and also remove 5 from row 1 col 5 (cell 14) so cell 0 is NOT a full house
    // Wait: make sure cell 0 has >=2 candidates (e.g. both 5 and 3 can't both fit unless column allows),
    // while row 0 has only one spot for 5.
    const g = parseGrid(SOLUTION);
    // Clear row 0 cols 0,1 (values 5,3) and row 1 cols 0,1 (values 6,7) -> row 0 has 2 empties, col 0 has 2 empties, box 0 has 4 empties.
    // In cell 0, candidates from peers: 5 and 6 (since 5 is missing from row 0 & col 0? Wait: 6 is in col 0 only at cell 9, so cell 0 can hold 5 or 6!)
    // Meanwhile in row 0, 5 can ONLY go in cell 0 (because col 1 already has 5 in row 6/etc? Let's check col 1 has 5 at row 8 col 2? Let's verify!).
    g[0] = 0; // 5
    g[1] = 0; // 3
    g[9] = 0; // 6
    g[10] = 0; // 7
    // Check col 1 for digit 5: row 3 col 1 is 5 (index 28), so cell 1 cannot be 5!
    // Thus in row 0, digit 5 can only go at cell 0 (hidden single), while cell 0 has candidates {5, 6} (not naked single, not full house).
    expect(classifyPlacement(g, 0, 5)).toBe("hiddenSingle");
  });

  it("identifies a Naked Single when a cell has only one peer-free candidate but is not a hidden single or full house", () => {
    const custom = new Array<number>(81).fill(0);
    // Row 0: place 1,2,3,4 in cols 3..6 -> cell 0 sees 1,2,3,4
    custom[3] = 1;
    custom[4] = 2;
    custom[5] = 3;
    custom[6] = 4;
    // Col 0: place 6,7,8,9 in rows 3..6 -> cell 0 sees 6,7,8,9
    custom[27] = 6;
    custom[36] = 7;
    custom[45] = 8;
    custom[54] = 9;
    // Cell 0's ONLY candidate is 5, while row 0, col 0, and box 0 all have other open spots for 5.
    expect(classifyPlacement(custom, 0, 5)).toBe("nakedSingle");
  });

  it("identifies a Pointing intersection when box-line elimination unlocks the placement", () => {
    // Construct a board where:
    // - Box 0 (rows 0..2, cols 0..2) can ONLY hold digit 1 in row 0 (cells 0 and 1, since rows 1..2 of box 0 are blocked/filled).
    // - That pointing pair eliminates 1 from cell 3 (row 0, col 3).
    // - Cell 3 originally has candidates {1, 5}; removing 1 turns cell 3 into a naked single for 5!
    const custom = new Array<number>(81).fill(0);
    // Block rows 1 and 2 of box 0 with 1s in row 1 col 6 and row 2 col 7 (both in box 2, not box 1!)
    custom[15] = 1; // row 1 col 6
    custom[25] = 1; // row 2 col 7
    // Fill cell 2 (row 0 col 2) with 9 so in box 0, digit 1 is restricted to row 0 cells {0, 1}.
    custom[2] = 9;
    // Give cell 3 (row 0 col 3) peers containing {2,3,4,6,7,8,9} so its candidates are {1, 5}:
    // Row 0 already has 9 at cell 2. Put 2,3,4,6 in row 0 cols 5,6,7,8:
    custom[5] = 2;
    custom[6] = 3;
    custom[7] = 4;
    custom[8] = 6;
    // Put 7,8 in col 3 rows 3,4:
    custom[30] = 7;
    custom[39] = 8;
    // Make sure 5 isn't a hidden single in row 0 (cell 4 can also take 5), col 3 (rows 1..8 can take 5), or box 1 (cell 4 can take 5).
    expect(classifyPlacement(custom, 3, 5)).toBe("pointing");
  });

  it("classifies an unprovable early placement as deep", () => {
    const empty = new Array<number>(81).fill(0);
    expect(classifyPlacement(empty, 0, 5)).toBe("deep");
  });
});

describe("matchAnalytics", () => {
  it("tracks lead changes, comebacks, and timeline points", () => {
    const moves: MatchMove[] = [
      { at: 1_000, slot: 1, cell: 0, strategy: "fullHouse" },
      { at: 2_000, slot: 1, cell: 1, strategy: "hiddenSingle" },
      { at: 3_000, slot: 1, cell: 2, strategy: "hiddenSingle" }, // you down -3
      { at: 4_000, slot: 0, cell: 3, strategy: "nakedSingle" },
      { at: 5_000, slot: 0, cell: 4, strategy: "pointing" },
      { at: 6_000, slot: 0, cell: 5, strategy: "nakedPair" },
      { at: 7_000, slot: 0, cell: 6, strategy: "fullHouse" }, // you up +1 (comeback from -3!)
    ];
    const timeline = buildLeadTimeline(moves, 0, 8_000, 0, 0);
    expect(timeline.leadChanges).toBe(1);
    expect(timeline.maxOppLead).toBe(3);
    expect(timeline.maxYouLead).toBe(1);
    expect(timeline.comebackFrom).toBe(3);
    expect(timeline.wireToWire).toBe(false);
    expect(timeline.points[0]).toEqual({ tMs: 0, lead: 0, youScore: 0, oppScore: 0 });
    expect(timeline.points[timeline.points.length - 1].lead).toBe(1);

    const breakdown = buildStrategyBreakdown(moves, 0);
    expect(breakdown.map((b) => [b.id, b.youCount, b.oppCount])).toEqual([
      ["fullHouse", 1, 1],
      ["hiddenSingle", 0, 2],
      ["nakedSingle", 1, 0],
      ["intersections", 1, 0],
      ["subsets", 1, 0],
    ]);
  });

  it("detects wire-to-wire wins", () => {
    const moves: MatchMove[] = [
      { at: 1_000, slot: 0, cell: 0, strategy: "fullHouse" },
      { at: 2_000, slot: 0, cell: 1, strategy: "hiddenSingle" },
      { at: 3_000, slot: 0, cell: 2, strategy: "hiddenSingle" },
    ];
    const timeline = buildLeadTimeline(moves, 0, 3_000, 0, 0);
    expect(timeline.wireToWire).toBe(true);
    expect(timeline.comebackFrom).toBe(0);
    expect(timeline.leadChanges).toBe(0);
  });
});
