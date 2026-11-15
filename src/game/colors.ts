import type { Slot } from "../../convex/lib/engine";

/** The viewer always plays blue; the opponent is orange. Spectators see slot 0 blue. */
export function slotTone(slot: Slot, you: Slot | null): "you" | "opponent" {
  return slot === (you ?? 0) ? "you" : "opponent";
}

export const TONE = {
  you: {
    cell: "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-100",
    chip: "bg-sky-500",
    text: "text-sky-600 dark:text-sky-300",
  },
  opponent: {
    cell: "bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-100",
    chip: "bg-orange-500",
    text: "text-orange-600 dark:text-orange-300",
  },
} as const;
