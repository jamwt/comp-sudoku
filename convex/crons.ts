import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { RULES } from "./gameConfig";

const crons = cronJobs();

crons.interval(
  "top up puzzle pool",
  { minutes: RULES.puzzlePool.topUpIntervalMinutes },
  internal.puzzles.topUp,
  {},
);

export default crons;
