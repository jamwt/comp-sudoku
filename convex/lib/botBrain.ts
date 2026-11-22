import { BOT_RULES, type BotSkill, type BotThinkKind } from "../gameConfig";
import {
  BOXES,
  COLS,
  PEERS,
  ROWS,
  findPlacements,
  parseGrid,
  popcount,
  type Grid,
  type Placement,
  type Rng,
  type Technique,
} from "./sudoku";

/**
 * The bot brain. Pure and deterministic given an rng: it sees only what a
 * human sees (givens plus claimed cells) and what the server has told it
 * (digits it already got wrong), and never the solution.
 */

export type Excluded = { cell: number; digit: number };
export type LastMove = { cell: number; digit: number };

export type BotView = {
  /** 81 chars: givens plus claimed digits, "0" where empty. */
  board: string;
  /** Digits this bot entered and the server rejected. */
  excluded: readonly Excluded[];
  /** Most recent cell this bot claimed, used for human follow-up momentum. */
  lastMove?: LastMove | null;
};

export type PlanIntent = "deduce" | "blunder" | "guess";

export type BotPlan = {
  cell: number;
  digit: number;
  thinkMs: number;
  intent: PlanIntent;
  /** The hardest technique behind the move, or "fullHouse" / "guess". */
  technique: Technique | "fullHouse" | "guess";
};

/** A standard normal draw (Box-Muller). */
function normal(rng: Rng): number {
  const u = 1 - rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

function logNormal(rng: Rng, medianMs: number, sigma: number): number {
  const ms = medianMs * Math.exp(sigma * normal(rng));
  return Math.round(
    Math.min(
      Math.max(ms, BOT_RULES.minThinkMs),
      medianMs * BOT_RULES.maxThinkFactor,
    ),
  );
}

function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function weightedPick<T>(
  items: readonly T[],
  weightOf: (item: T) => number,
  rng: Rng,
): T {
  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0.01, weightOf(item));
    total += w;
    return w;
  });
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** True when any row, column, or box containing `cell` has only `cell` left empty. */
function isFullHouse(grid: Grid, cell: number): boolean {
  if (grid[cell] !== 0) return false;
  const row = Math.floor(cell / 9);
  const col = cell % 9;
  const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
  return [ROWS[row], COLS[col], BOXES[box]].some((unit) => {
    let open = 0;
    for (const c of unit) {
      if (grid[c] === 0) open++;
    }
    return open === 1;
  });
}

function moveThinkKind(grid: Grid, move: Placement): BotThinkKind {
  if (
    (move.technique === "hiddenSingle" || move.technique === "nakedSingle") &&
    isFullHouse(grid, move.cell)
  ) {
    return "fullHouse";
  }
  return move.technique as Exclude<Technique, "unsolved">;
}

function isDirectSingle(kind: BotThinkKind): boolean {
  return (
    kind === "fullHouse" || kind === "hiddenSingle" || kind === "nakedSingle"
  );
}

type FollowUpKind = "peer" | "sameDigit" | "none";

function followUpKind(
  move: Placement,
  kind: BotThinkKind,
  lastMove: LastMove | null | undefined,
): FollowUpKind {
  if (!lastMove || !isDirectSingle(kind)) return "none";
  if (PEERS[lastMove.cell].includes(move.cell)) return "peer";
  if (move.digit === lastMove.digit) return "sameDigit";
  return "none";
}

function placementWeight(kind: BotThinkKind, followUp: FollowUpKind): number {
  const base =
    kind === "fullHouse"
      ? BOT_RULES.salienceWeight.fullHouse
      : kind === "hiddenSingle"
        ? BOT_RULES.salienceWeight.hiddenSingle
        : kind === "nakedSingle"
          ? BOT_RULES.salienceWeight.nakedSingle
          : BOT_RULES.salienceWeight.hard;
  if (followUp === "peer") return base * BOT_RULES.followUpBoost.peer;
  if (followUp === "sameDigit") return base * BOT_RULES.followUpBoost.sameDigit;
  return base;
}

/** This match's form: a multiplier on think time, median 1. */
export function sampleForm(rng: Rng): number {
  return Math.exp(BOT_RULES.formSigma * normal(rng));
}

/** Think time for a move whose perceptual kind was `technique`. */
export function thinkTime(
  technique: BotThinkKind,
  skill: BotSkill,
  rng: Rng,
  followUp: FollowUpKind = "none",
): number {
  const t = BOT_RULES.thinkByTechnique[technique];
  const momentum =
    followUp === "peer"
      ? BOT_RULES.followUpThinkFactor.peer
      : followUp === "sameDigit"
        ? BOT_RULES.followUpThinkFactor.sameDigit
        : 1;
  return logNormal(rng, t.medianMs * skill.thinkScale * momentum, t.sigma);
}

/** A digit that looks plausible in `cell` (no peer holds it) but isn't `correct`. */
function wrongDigit(grid: number[], cell: number, correct: number, rng: Rng) {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== correct);
  const plausible = all.filter((d) => !PEERS[cell].some((p) => grid[p] === d));
  return pick(plausible.length > 0 ? plausible : all, rng);
}

/**
 * The next deducible move for a bot with `skill`, or null when its
 * techniques find nothing on this board. Obvious moves (full houses and
 * peer/same-digit follow-ups after the bot's last placement) are strongly
 * favored and resolved faster, while hard eliminations take realistic pauses.
 */
export function planMove(
  view: BotView,
  skill: BotSkill,
  rng: Rng,
): BotPlan | null {
  const grid = parseGrid(view.board);
  const { placements } = findPlacements(grid, skill.techniques, view.excluded);
  if (placements.length === 0) return null;

  const scored = placements.map((move) => {
    const kind = moveThinkKind(grid, move);
    const followUp = followUpKind(move, kind, view.lastMove);
    return {
      move,
      kind,
      followUp,
      weight: placementWeight(kind, followUp),
    };
  });

  const chosen = weightedPick(scored, (s) => s.weight, rng);
  const thinkMs = thinkTime(chosen.kind, skill, rng, chosen.followUp);
  if (rng() < skill.errorRate) {
    const digit = wrongDigit(grid, chosen.move.cell, chosen.move.digit, rng);
    return {
      cell: chosen.move.cell,
      digit,
      thinkMs,
      intent: "blunder",
      technique: chosen.kind,
    };
  }
  return {
    cell: chosen.move.cell,
    digit: chosen.move.digit,
    thinkMs,
    intent: "deduce",
    technique: chosen.kind,
  };
}

/**
 * A guess for a bot that is stuck: a random candidate in one of the cells
 * with the fewest candidates left, after the bot's own eliminations and the
 * digits it already got wrong. Null when the board is full.
 */
export function planGuess(
  view: BotView,
  skill: BotSkill,
  rng: Rng,
): BotPlan | null {
  const grid = parseGrid(view.board);
  const { candidates } = findPlacements(grid, skill.techniques, view.excluded);
  let fewest = 10;
  let cells: number[] = [];
  grid.forEach((v, cell) => {
    if (v !== 0 || candidates[cell] === 0) return;
    const n = popcount(candidates[cell]);
    if (n < fewest) {
      fewest = n;
      cells = [cell];
    } else if (n === fewest) cells.push(cell);
  });
  if (cells.length === 0) return null;
  const cell = pick(cells, rng);
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(
    (d) => candidates[cell] & (1 << (d - 1)),
  );
  return {
    cell,
    digit: pick(digits, rng),
    thinkMs: logNormal(rng, skill.guessAfterMs, BOT_RULES.guessSigma),
    intent: "guess",
    technique: "guess",
  };
}

/**
 * What the bot does next and when. A deduced move lands after its think
 * time; with nothing to deduce the bot waits `guessAfterMs` and then
 * guesses, unless the board changes first (the caller replans then).
 * Thinking continues through a lockout, but no entry lands before it ends.
 */
export function nextPlan(
  view: BotView,
  skill: BotSkill,
  now: number,
  lockedUntil: number,
  rng: Rng,
): { plan: BotPlan; dueAt: number; stuck: boolean } | null {
  const deduced = planMove(view, skill, rng);
  const plan = deduced ?? planGuess(view, skill, rng);
  if (!plan) return null;
  return {
    plan,
    dueAt: Math.max(now + plan.thinkMs, lockedUntil),
    stuck: deduced === null,
  };
}
