import type { Slot } from "../../convex/lib/engine";

/** The viewer always plays cobalt blue; the opponent is tangerine coral. Spectators see slot 0 blue. */
export function slotTone(slot: Slot, you: Slot | null): "you" | "opponent" {
  return slot === (you ?? 0) ? "you" : "opponent";
}

export const TONE = {
  you: {
    cell: "bg-[#DBEAFE] text-[#1D4ED8] dark:bg-[#19355E] dark:text-[#7DD3FC]",
    chip: "bg-[#2563EB] dark:bg-[#38BDF8]",
    bar: "bg-[#2563EB] dark:bg-[#38BDF8]",
    text: "text-[#1D4ED8] dark:text-[#7DD3FC]",
    softBg: "bg-[#EFF6FF] dark:bg-[#142744]",
    border: "border-[#2563EB] dark:border-[#38BDF8]",
  },
  opponent: {
    cell: "bg-[#FFEDD5] text-[#C2410C] dark:bg-[#7C2D12]/80 dark:text-[#FED7AA]",
    chip: "bg-[#F97316] dark:bg-[#FB923C]",
    bar: "bg-[#F97316] dark:bg-[#FB923C]",
    text: "text-[#C2410C] dark:text-[#FDBA74]",
    softBg: "bg-[#FFF7ED] dark:bg-[#3E1A0E]",
    border: "border-[#F97316] dark:border-[#FB923C]",
  },
} as const;
