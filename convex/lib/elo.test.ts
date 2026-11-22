import { describe, expect, test } from "vitest";
import { RATING } from "../gameConfig";
import { expectedScore, kFactor, rateMatch } from "./elo";

const fresh = { rating: RATING.initial, ratedGames: 0 };

describe("elo", () => {
  test("equal ratings expect half a point; a 400-point edge expects about 0.91", () => {
    expect(expectedScore(1000, 1000)).toBe(0.5);
    expect(expectedScore(1400, 1000)).toBeCloseTo(10 / 11, 6);
    expect(expectedScore(1000, 1400)).toBeCloseTo(1 / 11, 6);
  });

  test("K steps down from calibration (120) to provisional (40) to established (20)", () => {
    expect(kFactor(0, RATING)).toBe(120);
    expect(kFactor(9, RATING)).toBe(120);
    expect(kFactor(10, RATING)).toBe(40);
    expect(kFactor(19, RATING)).toBe(40);
    expect(kFactor(20, RATING)).toBe(20);
    expect(kFactor(200, RATING)).toBe(20);
  });

  test("a win between new equal players moves each by calibration K/2", () => {
    const [a, b] = rateMatch(fresh, fresh, 0, RATING);
    expect(a).toEqual({
      before: 1000,
      after: 1060,
      delta: 60,
      k: 120,
      score: 1,
    });
    expect(b).toEqual({
      before: 1000,
      after: 940,
      delta: -60,
      k: 120,
      score: 0,
    });
  });

  test("the second player winning mirrors the first", () => {
    const [a, b] = rateMatch(fresh, fresh, 1, RATING);
    expect(a.delta).toBe(-60);
    expect(b.delta).toBe(60);
  });

  test("a draw is half a point: equal players stay put, the favorite loses rating", () => {
    const [a, b] = rateMatch(fresh, fresh, null, RATING);
    expect(a.delta).toBe(0);
    expect(b.delta).toBe(0);
    expect(a.score).toBe(0.5);
    const [fav, dog] = rateMatch(
      { rating: 1400, ratedGames: 30 },
      { rating: 1200, ratedGames: 30 },
      null,
      RATING,
    );
    expect(fav.delta).toBe(-5);
    expect(dog.delta).toBe(5);
  });

  test("each side uses its own K so established opponents do not absorb calibration swings", () => {
    const [veteran, calibrating] = rateMatch(
      { rating: 1000, ratedGames: 50 },
      { rating: 1000, ratedGames: 3 },
      0,
      RATING,
    );
    expect(veteran).toMatchObject({ k: 20, delta: 10 });
    expect(calibrating).toMatchObject({ k: 120, delta: -60 });

    const [veteran2, provisional] = rateMatch(
      { rating: 1000, ratedGames: 50 },
      { rating: 1000, ratedGames: 12 },
      1,
      RATING,
    );
    expect(veteran2).toMatchObject({ k: 20, delta: -10 });
    expect(provisional).toMatchObject({ k: 40, delta: 20 });
  });

  test("a struggling beginner drops rapidly during calibration", () => {
    let beginner = { rating: RATING.initial, ratedGames: 0 };
    // Losing 6 games against 1000-rated opponents drops them into ~650-700 range
    for (let i = 0; i < 6; i++) {
      const [change] = rateMatch(
        beginner,
        { rating: 1000, ratedGames: 30 },
        1,
        RATING,
      );
      beginner = { rating: change.after, ratedGames: beginner.ratedGames + 1 };
    }
    expect(beginner.rating).toBeLessThan(760);
  });

  test("an upset pays more than an expected win", () => {
    const strong = { rating: 1600, ratedGames: 40 };
    const weak = { rating: 1200, ratedGames: 40 };
    const [, upset] = rateMatch(strong, weak, 1, RATING);
    const [expected] = rateMatch(strong, weak, 0, RATING);
    expect(upset.delta).toBe(18);
    expect(expected.delta).toBe(2);
  });
});
