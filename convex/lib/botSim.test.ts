/// <reference types="vite/client" />
import { describe, expect, test } from "vitest";
import { BOTS, RULES } from "../gameConfig";
import { simulate } from "./botSim";
import { generateGradedPuzzle, mulberry32 } from "./sudoku";

/**
 * Calibration. `npm run calibrate` runs a larger sample and prints the
 * tables; the default run keeps the sample small and checks the ladder.
 */
const FULL = import.meta.env.CALIBRATE === "1";
const PUZZLES = FULL ? 100 : 20;
const MATCHES = FULL ? 40 : 10;

function pool(seed: number, tier: "easy" | "medium", n: number) {
  const rng = mulberry32(seed);
  const out = [];
  while (out.length < n) {
    const p = generateGradedPuzzle(rng);
    if (p.tier === tier) out.push(p);
  }
  return out;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2
    ? s[(s.length - 1) / 2]
    : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

describe("bot calibration", () => {
  for (const tier of ["easy", "medium"] as const) {
    test(`solo solve pace is monotonic in rating (${tier})`, () => {
      const puzzles = pool(tier === "easy" ? 100 : 200, tier, PUZZLES);
      const rng = mulberry32(7);
      const rows = BOTS.map((bot) => {
        const runs = puzzles.map((p) => simulate(p, [bot.skill], RULES, rng));
        for (const r of runs) expect(r.cells[0]).toBe(r.emptyCount);
        const paces = runs.map((r) => r.cells[0] / (r.durationMs / 60_000));
        return {
          bot: `${bot.name} (${bot.rating})`,
          "median cells/min": Number(median(paces).toFixed(1)),
          "median solve s": Math.round(
            median(runs.map((r) => r.durationMs)) / 1000,
          ),
          "wrong/puzzle": Number(
            (runs.reduce((n, r) => n + r.wrong[0], 0) / runs.length).toFixed(2),
          ),
          "guesses/puzzle": Number(
            (runs.reduce((n, r) => n + r.guesses[0], 0) / runs.length).toFixed(
              2,
            ),
          ),
        };
      });
      console.log(`\nSolo pace, ${tier}, ${PUZZLES} puzzles`);
      console.table(rows);
      const paces = rows.map((r) => r["median cells/min"]);
      for (let i = 1; i < paces.length; i++)
        expect(paces[i]).toBeGreaterThan(paces[i - 1]);
    });
  }

  test("in head-to-head matches the higher-rated bot usually wins", () => {
    const puzzles = pool(300, "easy", MATCHES);
    const rng = mulberry32(8);
    const table: Record<string, Record<string, string>> = {};
    for (let a = 0; a < BOTS.length; a++) {
      const row: Record<string, string> = {};
      for (let b = 0; b < BOTS.length; b++) {
        if (a === b) {
          row[BOTS[b].name] = "-";
          continue;
        }
        let wins = 0;
        puzzles.forEach((p, i) => {
          const swap = i % 2 === 1;
          const skills = swap
            ? [BOTS[b].skill, BOTS[a].skill]
            : [BOTS[a].skill, BOTS[b].skill];
          const r = simulate(p, [...skills], RULES, rng);
          expect(r.result).not.toBeNull();
          if (r.result!.winner === (swap ? 1 : 0)) wins++;
          else if (r.result!.winner === null) wins += 0.5;
        });
        row[BOTS[b].name] = `${Math.round((wins / puzzles.length) * 100)}%`;
        if (a === b + 1)
          expect(wins / puzzles.length).toBeGreaterThanOrEqual(0.5);
      }
      table[BOTS[a].name] = row;
    }
    console.log(
      `\nRow's win rate against column, ${MATCHES} easy matches per pair`,
    );
    console.table(table);
  });
});
