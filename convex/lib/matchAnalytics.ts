import type { Slot } from "./engine";
import type { MoveStrategy } from "./sudoku/grader";

export type MatchMove = {
  at: number;
  slot: Slot;
  cell: number;
  strategy: MoveStrategy;
};

export type LeadPoint = {
  tMs: number;
  lead: number;
  youScore: number;
  oppScore: number;
};

export type LeadSummary = {
  points: LeadPoint[];
  durationMs: number;
  maxAbsLead: number;
  maxYouLead: number;
  maxOppLead: number;
  leadChanges: number;
  /** Positive deficit the winner overcame (>= 2), or 0 if no comeback. */
  comebackFrom: number;
  wireToWire: boolean;
};

export function buildLeadTimeline(
  moves: readonly MatchMove[],
  startsAt: number | null,
  endedAt: number | null,
  you: Slot | null,
  winner: number | null,
): LeadSummary {
  const perspective: Slot = you ?? 0;
  const origin =
    startsAt ?? (moves.length > 0 ? moves[0].at : (endedAt ?? 0));

  let youScore = 0;
  let oppScore = 0;
  let maxYouLead = 0;
  let maxOppLead = 0;
  let leadChanges = 0;
  let prevLeader: -1 | 0 | 1 = 0;

  const points: LeadPoint[] = [{ tMs: 0, lead: 0, youScore: 0, oppScore: 0 }];

  for (const m of moves) {
    if (m.slot === perspective) youScore++;
    else oppScore++;
    const lead = youScore - oppScore;
    if (lead > maxYouLead) maxYouLead = lead;
    if (-lead > maxOppLead) maxOppLead = -lead;

    const leader: -1 | 0 | 1 = lead > 0 ? 1 : lead < 0 ? -1 : 0;
    if (leader !== 0 && prevLeader !== 0 && leader !== prevLeader) {
      leadChanges++;
    }
    if (leader !== 0) prevLeader = leader;

    const tMs = Math.max(0, m.at - origin);
    points.push({ tMs, lead, youScore, oppScore });
  }

  const lastMoveMs = points[points.length - 1].tMs;
  const rawDuration = endedAt !== null ? Math.max(lastMoveMs, endedAt - origin) : lastMoveMs;
  const durationMs = Math.max(1_000, rawDuration);
  if (durationMs > lastMoveMs && moves.length > 0) {
    const last = points[points.length - 1];
    points.push({ ...last, tMs: durationMs });
  }

  let comebackFrom = 0;
  let wireToWire = false;
  if (winner !== null && moves.length > 0) {
    const winnerIsYou = winner === perspective;
    const winnerDeficit = winnerIsYou ? maxOppLead : maxYouLead;
    const winnerMoves = winnerIsYou ? youScore : oppScore;
    if (winnerDeficit >= 2) comebackFrom = winnerDeficit;
    else if (winnerDeficit === 0 && winnerMoves >= 3) wireToWire = true;
  }

  return {
    points,
    durationMs,
    maxAbsLead: Math.max(2, maxYouLead, maxOppLead),
    maxYouLead,
    maxOppLead,
    leadChanges,
    comebackFrom,
    wireToWire,
  };
}

export type StrategyBucketRow = {
  id: string;
  label: string;
  hint: string;
  youCount: number;
  oppCount: number;
  total: number;
};

const BUCKET_DEFS: readonly {
  id: string;
  label: string;
  hint: string;
  strategies: readonly MoveStrategy[];
}[] = [
  {
    id: "fullHouse",
    label: "Full House",
    hint: "Last cell in unit",
    strategies: ["fullHouse"],
  },
  {
    id: "hiddenSingle",
    label: "Hidden Single",
    hint: "Crosshatching",
    strategies: ["hiddenSingle"],
  },
  {
    id: "nakedSingle",
    label: "Naked Single",
    hint: "Last candidate",
    strategies: ["nakedSingle"],
  },
  {
    id: "intersections",
    label: "Intersections",
    hint: "Pointing & box-line",
    strategies: ["pointing", "boxLineReduction"],
  },
  {
    id: "subsets",
    label: "Pairs & Triples",
    hint: "Naked/hidden subsets",
    strategies: ["nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple"],
  },
  {
    id: "xWing",
    label: "X-Wing",
    hint: "Grid pattern",
    strategies: ["xWing"],
  },
  {
    id: "deep",
    label: "Deep / Guess",
    hint: "Chains or intuition",
    strategies: ["deep"],
  },
];

export function buildStrategyBreakdown(
  moves: readonly MatchMove[],
  you: Slot | null,
): StrategyBucketRow[] {
  const perspective: Slot = you ?? 0;
  const rows: StrategyBucketRow[] = [];

  for (const def of BUCKET_DEFS) {
    let youCount = 0;
    let oppCount = 0;
    for (const m of moves) {
      if (!def.strategies.includes(m.strategy)) continue;
      if (m.slot === perspective) youCount++;
      else oppCount++;
    }
    const total = youCount + oppCount;
    if (total > 0) {
      rows.push({
        id: def.id,
        label: def.label,
        hint: def.hint,
        youCount,
        oppCount,
        total,
      });
    }
  }

  return rows;
}
