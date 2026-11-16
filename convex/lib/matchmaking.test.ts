import { describe, expect, test } from "vitest";
import { MATCHMAKING } from "../gameConfig";
import { pairQueue, ratingWindow } from "./matchmaking";

const NOW = 1_000_000;
const entry = (id: string, rating: number, waitedMs: number) => ({
  id,
  rating,
  joinedAt: NOW - waitedMs,
});

describe("ratingWindow", () => {
  test("starts at ±100 and widens linearly to ±400 at 30s", () => {
    expect(ratingWindow(0, MATCHMAKING)).toBe(100);
    expect(ratingWindow(15_000, MATCHMAKING)).toBe(250);
    expect(ratingWindow(30_000, MATCHMAKING)).toBe(400);
  });

  test("is clamped at both ends", () => {
    expect(ratingWindow(-5_000, MATCHMAKING)).toBe(100);
    expect(ratingWindow(120_000, MATCHMAKING)).toBe(400);
  });
});

describe("pairQueue", () => {
  test("pairs two fresh players within ±100", () => {
    const r = pairQueue(
      [entry("a", 1200, 0), entry("b", 1290, 0)],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([["a", "b"]]);
    expect(r.botCandidates).toEqual([]);
  });

  test("does not pair fresh players further apart than ±100", () => {
    const r = pairQueue(
      [entry("a", 1200, 0), entry("b", 1350, 0)],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([]);
  });

  test("a long wait widens the window enough to pair", () => {
    const r = pairQueue(
      [entry("a", 1200, 20_000), entry("b", 1500, 0)],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([["a", "b"]]);
  });

  test("never pairs beyond ±400", () => {
    const r = pairQueue(
      [entry("a", 1200, 90_000), entry("b", 1601, 90_000)],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([]);
  });

  test("the longest-waiting player picks first and takes the closest rating", () => {
    const r = pairQueue(
      [
        entry("near", 1230, 0),
        entry("first", 1200, 10_000),
        entry("far", 1280, 0),
      ],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([["first", "near"]]);
  });

  test("pairs several players disjointly", () => {
    const r = pairQueue(
      [
        entry("a", 1000, 5_000),
        entry("b", 1500, 4_000),
        entry("c", 1020, 3_000),
        entry("d", 1480, 2_000),
      ],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  test("players unpaired after 20s become bot candidates, longest wait first", () => {
    const r = pairQueue(
      [
        entry("new", 2000, 5_000),
        entry("old", 1000, 25_000),
        entry("edge", 1500, 20_000),
      ],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toEqual([]);
    expect(r.botCandidates.map((e) => e.id)).toEqual(["old", "edge"]);
  });

  test("a paired player is never a bot candidate", () => {
    const r = pairQueue(
      [entry("a", 1200, 25_000), entry("b", 1250, 25_000)],
      NOW,
      MATCHMAKING,
    );
    expect(r.pairs).toHaveLength(1);
    expect(r.botCandidates).toEqual([]);
  });
});
