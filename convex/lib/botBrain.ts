import { BOT_RULES, type BotSkill } from "../gameConfig";
import {
  PEERS,
  findPlacements,
  parseGrid,
  popcount,
  type Rng,
  type Technique,
} from "./sudoku";

/**
 * The bot brain. Pure and deterministic given an rng: it sees only what a
 * human sees (givens plus claimed cells) and what the server has told it
 * (digits it already got wrong), and never the solution.
 */

export type Excluded = { cell: number; digit: number };

export type BotView = {
  /** 81 chars: givens plus claimed digits, "0" where empty. */
  board: string;
  /** Digits this bot entered and the server rejected. */
  excluded: readonly Excluded[];
};

export type PlanIntent = "deduce" | "blunder" | "guess";

export type BotPlan = {
  cell: number;
  digit: number;
  thinkMs: number;
  intent: PlanIntent;
  /** The hardest technique behind the move, or "guess". */
  technique: Technique | "guess";
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

/** This match's form: a multiplier on think time, median 1. */
export function sampleForm(rng: Rng): number {
  return Math.exp(BOT_RULES.formSigma * normal(rng));
}

/** Think time for a move whose hardest technique was `technique`. */
export function thinkTime(
  technique: Exclude<Technique, "unsolved">,
  skill: BotSkill,
  rng: Rng,
): number {
  const t = BOT_RULES.thinkByTechnique[technique];
  return logNormal(rng, t.medianMs * skill.thinkScale, t.sigma);
}

/** A digit that looks plausible in `cell` (no peer holds it) but isn't `correct`. */
function wrongDigit(grid: number[], cell: number, correct: number, rng: Rng) {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => d !== correct);
  const plausible = all.filter((d) => !PEERS[cell].some((p) => grid[p] === d));
  return pick(plausible.length > 0 ? plausible : all, rng);
}

/**
 * The next deducible move for a bot with `skill`, or null when its
 * techniques find nothing on this board. With probability `errorRate` the
 * move is entered with a wrong digit.
 */
export function planMove(
  view: BotView,
  skill: BotSkill,
  rng: Rng,
): BotPlan | null {
  const grid = parseGrid(view.board);
  const { placements } = findPlacements(grid, skill.techniques, view.excluded);
  if (placements.length === 0) return null;
  const move = pick(placements, rng);
  const technique = move.technique as Exclude<Technique, "unsolved">;
  const thinkMs = thinkTime(technique, skill, rng);
  if (rng() < skill.errorRate) {
    const digit = wrongDigit(grid, move.cell, move.digit, rng);
    return { cell: move.cell, digit, thinkMs, intent: "blunder", technique };
  }
  return {
    cell: move.cell,
    digit: move.digit,
    thinkMs,
    intent: "deduce",
    technique,
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
