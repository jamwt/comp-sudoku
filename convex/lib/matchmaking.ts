import type { MATCHMAKING } from "../gameConfig";

/**
 * Pure pairing logic for the ranked queue. The queue module loads waiting
 * entries, calls `pairQueue`, and turns its pairs into matches.
 */

type WindowRules = Pick<
  typeof MATCHMAKING,
  "windowStart" | "windowMax" | "windowWidenMs"
>;
type PairRules = WindowRules & Pick<typeof MATCHMAKING, "botFallbackAfterMs">;

export type QueueEntry<Id extends string = string> = {
  id: Id;
  rating: number;
  joinedAt: number;
};

/** The ± rating window for someone who has waited `waitMs`: linear from start to max. */
export function ratingWindow(waitMs: number, rules: WindowRules): number {
  const t = Math.min(Math.max(waitMs, 0) / rules.windowWidenMs, 1);
  return Math.round(
    rules.windowStart + (rules.windowMax - rules.windowStart) * t,
  );
}

/**
 * Pair waiting players greedily, longest wait first. Two players can pair when
 * their rating gap fits the wider of their two windows, so a long wait widens
 * the search for both sides. Among candidates the closest rating wins, then
 * the longer wait. Players left unpaired after `botFallbackAfterMs` are
 * returned as bot candidates, longest wait first.
 */
export function pairQueue<Id extends string>(
  entries: QueueEntry<Id>[],
  now: number,
  rules: PairRules,
): { pairs: [Id, Id][]; botCandidates: QueueEntry<Id>[] } {
  const waiting = [...entries].sort((x, y) => x.joinedAt - y.joinedAt);
  const windowOf = (e: QueueEntry<Id>) => ratingWindow(now - e.joinedAt, rules);
  const paired = new Set<Id>();
  const pairs: [Id, Id][] = [];
  for (const entry of waiting) {
    if (paired.has(entry.id)) continue;
    let best: QueueEntry<Id> | null = null;
    for (const other of waiting) {
      if (other.id === entry.id || paired.has(other.id)) continue;
      const gap = Math.abs(other.rating - entry.rating);
      if (gap > Math.max(windowOf(entry), windowOf(other))) continue;
      if (best === null || gap < Math.abs(best.rating - entry.rating))
        best = other;
    }
    if (best) {
      paired.add(entry.id);
      paired.add(best.id);
      pairs.push([entry.id, best.id]);
    }
  }
  const botCandidates = waiting.filter(
    (e) => !paired.has(e.id) && now - e.joinedAt >= rules.botFallbackAfterMs,
  );
  return { pairs, botCandidates };
}
