import { BOXES, COLS, Grid, PEERS, ROWS, UNITS, popcount } from "./grid";

export type Technique =
  | "nakedSingle"
  | "hiddenSingle"
  | "nakedPair"
  | "hiddenPair"
  | "pointing"
  | "boxLineReduction"
  | "nakedTriple"
  | "hiddenTriple"
  | "xWing"
  | "unsolved";

export type Tier = "easy" | "medium" | "hard";

export const TECHNIQUE_TIER: Record<Technique, Tier> = {
  nakedSingle: "easy",
  hiddenSingle: "easy",
  nakedPair: "medium",
  hiddenPair: "medium",
  pointing: "medium",
  boxLineReduction: "medium",
  nakedTriple: "hard",
  hiddenTriple: "hard",
  xWing: "hard",
  unsolved: "hard",
};

interface State {
  values: number[];
  cands: number[];
}

type Step = (s: State) => boolean;

const ALL = 0x1ff;

function place(s: State, cell: number, digit: number): void {
  const bit = 1 << (digit - 1);
  s.values[cell] = digit;
  s.cands[cell] = 0;
  for (const p of PEERS[cell]) s.cands[p] &= ~bit;
}

function eliminate(s: State, cells: number[], mask: number): boolean {
  let changed = false;
  for (const c of cells) {
    if (s.values[c] === 0 && s.cands[c] & mask) {
      s.cands[c] &= ~mask;
      changed = true;
    }
  }
  return changed;
}

function combinations<T>(items: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick = (start: number, chosen: T[]) => {
    if (chosen.length === k) {
      out.push(chosen.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

const nakedSingle: Step = (s) => {
  for (let i = 0; i < 81; i++) {
    if (s.values[i] === 0 && popcount(s.cands[i]) === 1) {
      place(s, i, 32 - Math.clz32(s.cands[i]));
      return true;
    }
  }
  return false;
};

const hiddenSingle: Step = (s) => {
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      let found = -1;
      let n = 0;
      for (const c of unit) {
        if (s.values[c] === 0 && s.cands[c] & bit) {
          found = c;
          n++;
        }
      }
      if (n === 1) {
        place(s, found, d);
        return true;
      }
    }
  }
  return false;
};

const nakedSubset =
  (k: number): Step =>
  (s) => {
    for (const unit of UNITS) {
      const open = unit.filter(
        (c) => s.values[c] === 0 && popcount(s.cands[c]) <= k,
      );
      for (const combo of combinations(open, k)) {
        const union = combo.reduce((m, c) => m | s.cands[c], 0);
        if (popcount(union) !== k) continue;
        if (
          eliminate(
            s,
            unit.filter((c) => !combo.includes(c)),
            union,
          )
        )
          return true;
      }
    }
    return false;
  };

const hiddenSubset =
  (k: number): Step =>
  (s) => {
    for (const unit of UNITS) {
      const digits: number[] = [];
      const where: number[] = [];
      for (let d = 1; d <= 9; d++) {
        let mask = 0;
        unit.forEach((c, i) => {
          if (s.values[c] === 0 && s.cands[c] & (1 << (d - 1))) mask |= 1 << i;
        });
        if (mask !== 0 && popcount(mask) <= k) {
          digits.push(d);
          where.push(mask);
        }
      }
      for (const combo of combinations(
        digits.map((_, i) => i),
        k,
      )) {
        const positions = combo.reduce((m, i) => m | where[i], 0);
        if (popcount(positions) !== k) continue;
        const keep = combo.reduce((m, i) => m | (1 << (digits[i] - 1)), 0);
        let changed = false;
        unit.forEach((c, i) => {
          if (positions & (1 << i) && s.cands[c] & ~keep) {
            s.cands[c] &= keep;
            changed = true;
          }
        });
        if (changed) return true;
      }
    }
    return false;
  };

const pointing: Step = (s) => {
  for (const box of BOXES) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      const cells = box.filter((c) => s.values[c] === 0 && s.cands[c] & bit);
      if (cells.length < 2) continue;
      const row = Math.floor(cells[0] / 9);
      const col = cells[0] % 9;
      if (cells.every((c) => Math.floor(c / 9) === row)) {
        if (
          eliminate(
            s,
            ROWS[row].filter((c) => !box.includes(c)),
            bit,
          )
        )
          return true;
      }
      if (cells.every((c) => c % 9 === col)) {
        if (
          eliminate(
            s,
            COLS[col].filter((c) => !box.includes(c)),
            bit,
          )
        )
          return true;
      }
    }
  }
  return false;
};

const boxLineReduction: Step = (s) => {
  for (const line of [...ROWS, ...COLS]) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      const cells = line.filter((c) => s.values[c] === 0 && s.cands[c] & bit);
      if (cells.length < 2) continue;
      const box = BOXES.find((b) => b.includes(cells[0]))!;
      if (!cells.every((c) => box.includes(c))) continue;
      if (
        eliminate(
          s,
          box.filter((c) => !line.includes(c)),
          bit,
        )
      )
        return true;
    }
  }
  return false;
};

const xWing: Step = (s) => {
  for (const lines of [ROWS, COLS]) {
    for (let d = 1; d <= 9; d++) {
      const bit = 1 << (d - 1);
      const spans = lines.map((line) => {
        let mask = 0;
        line.forEach((c, i) => {
          if (s.values[c] === 0 && s.cands[c] & bit) mask |= 1 << i;
        });
        return mask;
      });
      for (let a = 0; a < 9; a++) {
        if (popcount(spans[a]) !== 2) continue;
        for (let b = a + 1; b < 9; b++) {
          if (spans[b] !== spans[a]) continue;
          const targets: number[] = [];
          for (let other = 0; other < 9; other++) {
            if (other === a || other === b) continue;
            for (let i = 0; i < 9; i++) {
              if (spans[a] & (1 << i)) targets.push(lines[other][i]);
            }
          }
          if (eliminate(s, targets, bit)) return true;
        }
      }
    }
  }
  return false;
};

const STEPS: { technique: Technique; run: Step }[] = [
  { technique: "nakedSingle", run: nakedSingle },
  { technique: "hiddenSingle", run: hiddenSingle },
  { technique: "nakedPair", run: nakedSubset(2) },
  { technique: "hiddenPair", run: hiddenSubset(2) },
  { technique: "pointing", run: pointing },
  { technique: "boxLineReduction", run: boxLineReduction },
  { technique: "nakedTriple", run: nakedSubset(3) },
  { technique: "hiddenTriple", run: hiddenSubset(3) },
  { technique: "xWing", run: xWing },
];

/** Solves with human techniques, easiest first, and rates the puzzle by the hardest technique it needed. */
export function gradePuzzle(givens: Grid): {
  tier: Tier;
  hardest: Technique;
  solved: boolean;
  counts: Partial<Record<Technique, number>>;
} {
  const s: State = {
    values: new Array(81).fill(0),
    cands: new Array(81).fill(ALL),
  };
  givens.forEach((d, i) => {
    if (d !== 0) place(s, i, d);
  });

  const counts: Partial<Record<Technique, number>> = {};
  let hardestRank = 0;

  for (;;) {
    if (s.values.every((v) => v !== 0)) break;
    if (s.values.some((v, i) => v === 0 && s.cands[i] === 0)) break;
    const rank = STEPS.findIndex((step) => step.run(s));
    if (rank === -1) break;
    const technique = STEPS[rank].technique;
    counts[technique] = (counts[technique] ?? 0) + 1;
    hardestRank = Math.max(hardestRank, rank);
  }

  const solved = s.values.every((v) => v !== 0);
  const hardest = solved ? STEPS[hardestRank].technique : "unsolved";
  return { tier: TECHNIQUE_TIER[hardest], hardest, solved, counts };
}

export const MOVE_STRATEGIES = [
  "fullHouse",
  "hiddenSingle",
  "nakedSingle",
  "pointing",
  "boxLineReduction",
  "nakedPair",
  "hiddenPair",
  "nakedTriple",
  "hiddenTriple",
  "xWing",
  "deep",
] as const;

export type MoveStrategy = (typeof MOVE_STRATEGIES)[number];

const ELIMINATION_STEPS: {
  strategy: Exclude<MoveStrategy, "fullHouse" | "hiddenSingle" | "nakedSingle" | "deep">;
  run: Step;
}[] = [
  { strategy: "pointing", run: pointing },
  { strategy: "boxLineReduction", run: boxLineReduction },
  { strategy: "nakedPair", run: nakedSubset(2) },
  { strategy: "hiddenPair", run: hiddenSubset(2) },
  { strategy: "nakedTriple", run: nakedSubset(3) },
  { strategy: "hiddenTriple", run: hiddenSubset(3) },
  { strategy: "xWing", run: xWing },
];

/**
 * Classifies the simplest human deduction strategy sufficient to prove `digit`
 * in `cell` from the given `board` state right before the claim.
 */
export function classifyPlacement(
  board: Grid,
  cell: number,
  digit: number,
): MoveStrategy {
  if (cell < 0 || cell > 80 || digit < 1 || digit > 9 || board[cell] !== 0) {
    return "deep";
  }
  const s: State = {
    values: new Array(81).fill(0),
    cands: new Array(81).fill(ALL),
  };
  board.forEach((d, i) => {
    if (d !== 0) place(s, i, d);
  });

  const bit = 1 << (digit - 1);
  if ((s.cands[cell] & bit) === 0) return "deep";

  const row = Math.floor(cell / 9);
  const col = cell % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  const cellUnits = [ROWS[row], COLS[col], BOXES[box]];

  const isFullHouse = () =>
    cellUnits.some((unit) => {
      let open = 0;
      for (const c of unit) if (s.values[c] === 0) open++;
      return open === 1;
    });

  const isHiddenSingle = () =>
    cellUnits.some((unit) => {
      let count = 0;
      for (const c of unit) {
        if (s.values[c] === 0 && (s.cands[c] & bit) !== 0) count++;
      }
      return count === 1;
    });

  const isNakedSingle = () => s.cands[cell] === bit;

  if (isFullHouse()) return "fullHouse";
  if (isHiddenSingle()) return "hiddenSingle";
  if (isNakedSingle()) return "nakedSingle";

  let hardestIdx = -1;
  for (;;) {
    let progressed = false;
    for (let i = 0; i < ELIMINATION_STEPS.length; i++) {
      if (ELIMINATION_STEPS[i].run(s)) {
        if (i > hardestIdx) hardestIdx = i;
        progressed = true;
        if (isHiddenSingle() || isNakedSingle()) {
          return ELIMINATION_STEPS[hardestIdx].strategy;
        }
        break;
      }
    }
    if (!progressed) return "deep";
  }
}

export type Placement = { cell: number; digit: number; technique: Technique };

/**
 * What a solver that knows only `techniques` can fill next on `board`.
 * Applies the allowed elimination techniques, easiest first, until at least
 * one naked or hidden single appears, and returns every single available at
 * that point. Each placement's technique is the hardest one the deduction
 * needed. `excluded` lists digits already known to be wrong in a cell.
 * `candidates` are the remaining candidate masks after those eliminations.
 */
export function findPlacements(
  board: Grid,
  techniques: readonly Technique[],
  excluded: readonly { cell: number; digit: number }[] = [],
): { placements: Placement[]; candidates: number[] } {
  const s: State = {
    values: new Array(81).fill(0),
    cands: new Array(81).fill(ALL),
  };
  board.forEach((d, i) => {
    if (d !== 0) place(s, i, d);
  });
  for (const { cell, digit } of excluded) {
    if (s.values[cell] === 0) s.cands[cell] &= ~(1 << (digit - 1));
  }
  const allowed = new Set(techniques);
  const eliminations = STEPS.filter(
    (step) =>
      allowed.has(step.technique) &&
      step.technique !== "nakedSingle" &&
      step.technique !== "hiddenSingle",
  );
  const rank = (t: Technique) =>
    STEPS.findIndex((step) => step.technique === t);
  let hardest = -1;

  for (;;) {
    if (s.values.some((v, i) => v === 0 && s.cands[i] === 0)) {
      return { placements: [], candidates: s.cands.slice() };
    }
    const found = new Map<number, Placement>();
    const add = (cell: number, digit: number, single: Technique) => {
      if (found.has(cell)) return;
      const technique =
        rank(single) >= hardest ? single : STEPS[hardest].technique;
      found.set(cell, { cell, digit, technique });
    };
    if (allowed.has("hiddenSingle")) {
      for (const unit of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const bit = 1 << (d - 1);
          const cells = unit.filter(
            (c) => s.values[c] === 0 && s.cands[c] & bit,
          );
          if (cells.length === 1) add(cells[0], d, "hiddenSingle");
        }
      }
    }
    if (allowed.has("nakedSingle")) {
      for (let i = 0; i < 81; i++) {
        if (s.values[i] === 0 && popcount(s.cands[i]) === 1) {
          add(i, 32 - Math.clz32(s.cands[i]), "nakedSingle");
        }
      }
    }
    if (found.size > 0) {
      return { placements: [...found.values()], candidates: s.cands.slice() };
    }
    const step = eliminations.find((e) => e.run(s));
    if (!step) return { placements: [], candidates: s.cands.slice() };
    hardest = Math.max(hardest, rank(step.technique));
  }
}
