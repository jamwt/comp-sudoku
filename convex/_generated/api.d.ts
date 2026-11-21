/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as botRuns from "../botRuns.js";
import type * as bots from "../bots.js";
import type * as crons from "../crons.js";
import type * as gameConfig from "../gameConfig.js";
import type * as init from "../init.js";
import type * as lib_botBrain from "../lib/botBrain.js";
import type * as lib_botSim from "../lib/botSim.js";
import type * as lib_elo from "../lib/elo.js";
import type * as lib_engine from "../lib/engine.js";
import type * as lib_matchmaking from "../lib/matchmaking.js";
import type * as lib_notes from "../lib/notes.js";
import type * as lib_sudoku_generator from "../lib/sudoku/generator.js";
import type * as lib_sudoku_grader from "../lib/sudoku/grader.js";
import type * as lib_sudoku_grid from "../lib/sudoku/grid.js";
import type * as lib_sudoku_index from "../lib/sudoku/index.js";
import type * as lib_sudoku_rng from "../lib/sudoku/rng.js";
import type * as lib_sudoku_solver from "../lib/sudoku/solver.js";
import type * as matches from "../matches.js";
import type * as notes from "../notes.js";
import type * as players from "../players.js";
import type * as presence from "../presence.js";
import type * as puzzles from "../puzzles.js";
import type * as queue from "../queue.js";
import type * as rateLimits from "../rateLimits.js";
import type * as ratings from "../ratings.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  botRuns: typeof botRuns;
  bots: typeof bots;
  crons: typeof crons;
  gameConfig: typeof gameConfig;
  init: typeof init;
  "lib/botBrain": typeof lib_botBrain;
  "lib/botSim": typeof lib_botSim;
  "lib/elo": typeof lib_elo;
  "lib/engine": typeof lib_engine;
  "lib/matchmaking": typeof lib_matchmaking;
  "lib/notes": typeof lib_notes;
  "lib/sudoku/generator": typeof lib_sudoku_generator;
  "lib/sudoku/grader": typeof lib_sudoku_grader;
  "lib/sudoku/grid": typeof lib_sudoku_grid;
  "lib/sudoku/index": typeof lib_sudoku_index;
  "lib/sudoku/rng": typeof lib_sudoku_rng;
  "lib/sudoku/solver": typeof lib_sudoku_solver;
  matches: typeof matches;
  notes: typeof notes;
  players: typeof players;
  presence: typeof presence;
  puzzles: typeof puzzles;
  queue: typeof queue;
  rateLimits: typeof rateLimits;
  ratings: typeof ratings;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  auth: import("@convex-dev/auth/_generated/component.js").ComponentApi<"auth">;
  authPassword: import("@convex-dev/auth/components/password/_generated/component.js").ComponentApi<"authPassword">;
  authUsername: import("@convex-dev/auth/components/username/_generated/component.js").ComponentApi<"authUsername">;
  presence: import("@convex-dev/presence/_generated/component.js").ComponentApi<"presence">;
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
  puzzleWorkpool: import("@convex-dev/workpool/_generated/component.js").ComponentApi<"puzzleWorkpool">;
  staticHosting: import("@convex-dev/static-hosting/_generated/component.js").ComponentApi<"staticHosting">;
  ratingAggregate: import("@convex-dev/aggregate/_generated/component.js").ComponentApi<"ratingAggregate">;
};
