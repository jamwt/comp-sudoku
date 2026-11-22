import type { RATING } from "../gameConfig";

/**
 * Pure Elo math. It knows nothing about Convex: the ratings module loads both
 * players' ratings, calls `rateMatch`, and persists what it returns.
 */

type RatingRules = typeof RATING;

export type RatedPlayer = { rating: number; ratedGames: number };

export type RatingChange = {
  before: number;
  after: number;
  delta: number;
  k: number;
  /** 1 for a win, 0 for a loss, `drawScore` for a draw. */
  score: number;
};

/** Probability that a player rated `rating` beats one rated `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/** K for a player who has already finished `ratedGames` rated games. */
export function kFactor(ratedGames: number, rules: RatingRules): number {
  if (ratedGames < rules.calibrationGames) return rules.kCalibration;
  if (ratedGames < rules.provisionalGames) return rules.kProvisional;
  return rules.kEstablished;
}

/**
 * Rate one finished match between `a` and `b`. `winner` is 0 when `a` won,
 * 1 when `b` won, and null for a draw. Ratings are rounded to integers.
 */
export function rateMatch(
  a: RatedPlayer,
  b: RatedPlayer,
  winner: 0 | 1 | null,
  rules: RatingRules,
): [RatingChange, RatingChange] {
  const scoreA = winner === null ? rules.drawScore : winner === 0 ? 1 : 0;
  const change = (me: RatedPlayer, them: RatedPlayer, score: number) => {
    const k = kFactor(me.ratedGames, rules);
    const after = Math.round(
      me.rating + k * (score - expectedScore(me.rating, them.rating)),
    );
    return { before: me.rating, after, delta: after - me.rating, k, score };
  };
  return [change(a, b, scoreA), change(b, a, 1 - scoreA)];
}
