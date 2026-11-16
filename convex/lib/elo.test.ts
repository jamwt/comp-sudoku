import { describe, expect, test } from "vitest";
import { RATING } from "../gameConfig";
import { expectedScore, kFactor, rateMatch } from "./elo";

const fresh = { rating: 1200, ratedGames: 0 };

describe("elo", () => {
  test("equal ratings expect half a point; a 400-point edge expects about 0.91", () => {
    expect(expectedScore(1200, 1200)).toBe(0.5);
    expect(expectedScore(1600, 1200)).toBeCloseTo(10 / 11, 6);
    expect(expectedScore(1200, 1600)).toBeCloseTo(1 / 11, 6);
  });

  test("K is 40 for the first 20 rated games and 20 after", () => {
    expect(kFactor(0, RATING)).toBe(40);
    expect(kFactor(19, RATING)).toBe(40);
    expect(kFactor(20, RATING)).toBe(20);
    expect(kFactor(200, RATING)).toBe(20);
  });

  test("a win between new equal players moves each by K/2", () => {
    const [a, b] = rateMatch(fresh, fresh, 0, RATING);
    expect(a).toEqual({
      before: 1200,
      after: 1220,
      delta: 20,
      k: 40,
      score: 1,
    });
    expect(b).toEqual({
      before: 1200,
      after: 1180,
      delta: -20,
      k: 40,
      score: 0,
    });
  });

  test("the second player winning mirrors the first", () => {
    const [a, b] = rateMatch(fresh, fresh, 1, RATING);
    expect(a.delta).toBe(-20);
    expect(b.delta).toBe(20);
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

  test("each side uses its own K", () => {
    const [veteran, rookie] = rateMatch(
      { rating: 1200, ratedGames: 50 },
      { rating: 1200, ratedGames: 3 },
      1,
      RATING,
    );
    expect(veteran).toMatchObject({ k: 20, delta: -10 });
    expect(rookie).toMatchObject({ k: 40, delta: 20 });
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
