import { memo } from "react";
import { PEERS } from "../../convex/lib/sudoku/grid";
import type { Slot } from "../../convex/lib/engine";
import { cn } from "@/lib/utils";
import { slotTone, TONE } from "./colors";

type BoardProps = {
  givens: string;
  board: string;
  owners: string;
  you: Slot | null;
  notes: number[] | null;
  cursor: number;
  activeDigit: number | null;
  pending: ReadonlySet<number>;
  flash: { cell: number; kind: "wrong" | "taken" } | null;
  disabled: boolean;
  onCellClick: (cell: number) => void;
};

export function Board(props: BoardProps) {
  const peers = new Set(PEERS[props.cursor]);
  return (
    <div
      className={cn(
        "grid aspect-square w-full max-w-[560px] select-none grid-cols-9 overflow-hidden rounded-lg border-2 border-foreground/80 bg-background",
        props.disabled && "opacity-80",
      )}
      data-testid="board"
    >
      {Array.from({ length: 81 }, (_, cell) => (
        <Cell
          key={cell}
          cell={cell}
          value={Number(props.board[cell])}
          given={props.givens[cell] !== "0"}
          owner={props.owners[cell]}
          you={props.you}
          marks={props.notes?.[cell] ?? 0}
          selected={cell === props.cursor}
          peer={peers.has(cell)}
          activeDigit={props.activeDigit}
          pending={props.pending.has(cell)}
          flash={props.flash?.cell === cell ? props.flash.kind : null}
          onClick={props.onCellClick}
        />
      ))}
    </div>
  );
}

type CellProps = {
  cell: number;
  value: number;
  given: boolean;
  owner: string;
  you: Slot | null;
  marks: number;
  selected: boolean;
  peer: boolean;
  activeDigit: number | null;
  pending: boolean;
  flash: "wrong" | "taken" | null;
  onClick: (cell: number) => void;
};

const Cell = memo(function Cell(p: CellProps) {
  const row = Math.floor(p.cell / 9);
  const col = p.cell % 9;
  const owned = p.owner === "0" || p.owner === "1";
  const tone = owned ? TONE[slotTone(Number(p.owner) as Slot, p.you)] : null;
  const matchesActive = p.activeDigit !== null && p.value === p.activeDigit;
  return (
    <button
      type="button"
      tabIndex={-1}
      data-cell={p.cell}
      data-value={p.value}
      data-owner={owned ? p.owner : ""}
      onMouseDown={(e) => {
        e.preventDefault();
        p.onClick(p.cell);
      }}
      className={cn(
        "relative flex items-center justify-center border-foreground/20 text-[clamp(1rem,4.5vw,1.9rem)] leading-none transition-colors",
        col < 8 &&
          (col % 3 === 2 ? "border-r-2 border-r-foreground/70" : "border-r"),
        row < 8 &&
          (row % 3 === 2 ? "border-b-2 border-b-foreground/70" : "border-b"),
        p.given && "font-semibold",
        tone?.cell,
        !tone && p.peer && "bg-muted/70",
        matchesActive &&
          (tone
            ? "font-bold ring-[3px] ring-inset ring-yellow-400"
            : "bg-yellow-200 text-yellow-950 dark:bg-yellow-700/70 dark:text-yellow-50"),
        p.pending && "animate-pulse",
        p.flash === "wrong" && "bg-red-500 text-white dark:bg-red-600",
        p.flash === "taken" && "bg-zinc-300 dark:bg-zinc-600",
        p.selected &&
          "z-10 outline outline-[3px] -outline-offset-[3px] outline-primary",
      )}
    >
      {p.value !== 0 ? (
        p.value
      ) : p.marks !== 0 ? (
        <span className="grid h-full w-full grid-cols-3 p-[6%] text-[clamp(0.45rem,1.5vw,0.7rem)] font-medium text-muted-foreground">
          {Array.from({ length: 9 }, (_, i) => (
            <span
              key={i}
              className={cn(
                "flex items-center justify-center rounded-sm",
                p.activeDigit === i + 1 &&
                  p.marks & (1 << i) &&
                  "bg-yellow-200 text-yellow-950 dark:bg-yellow-700/70",
              )}
            >
              {p.marks & (1 << i) ? i + 1 : ""}
            </span>
          ))}
        </span>
      ) : null}
    </button>
  );
});
