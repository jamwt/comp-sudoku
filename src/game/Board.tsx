import { memo, useMemo } from "react";
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
  popped: ReadonlySet<number>;
  flash: { cell: number; kind: "wrong" | "taken" } | null;
  disabled: boolean;
  onCellClick: (cell: number) => void;
};

export const Board = memo(function Board(props: BoardProps) {
  const peers = useMemo(() => new Set(PEERS[props.cursor]), [props.cursor]);
  return (
    <div className="rounded-2xl border-2 border-ink bg-card p-1.5 shadow-toy sm:p-2">
      <div
        className={cn(
          "grid aspect-square w-full select-none grid-cols-9 grid-rows-9 overflow-hidden rounded-xl border-[2.5px] border-ink bg-screen transition-opacity duration-150",
          props.disabled && "opacity-85",
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
            popped={props.popped.has(cell)}
            flash={props.flash?.cell === cell ? props.flash.kind : null}
            onClick={props.onCellClick}
          />
        ))}
      </div>
    </div>
  );
});

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
  popped: boolean;
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
        "relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden border-border/80 font-sans text-[clamp(1.05rem,4.6vw,1.9rem)] leading-none tabular-nums transition-colors duration-100 focus:outline-none",
        col < 8 &&
          (col % 3 === 2
            ? "border-r-[2.5px] border-r-ink"
            : "border-r"),
        row < 8 &&
          (row % 3 === 2
            ? "border-b-[2.5px] border-b-ink"
            : "border-b"),
        p.given && "font-extrabold text-foreground",
        !p.given && owned && "font-bold",
        tone?.cell,
        !tone && p.peer && "bg-muted/80 dark:bg-[#2A2E44]",
        matchesActive &&
          (tone
            ? "font-extrabold ring-[3px] ring-inset ring-[#FACC15] dark:ring-[#FDE047]"
            : "bg-[#FEF08A] text-[#422006] dark:bg-[#EAB308]/35 dark:text-[#FEF08A] dark:ring-2 dark:ring-inset dark:ring-[#FACC15]/80"),
        p.pending && "animate-pulse opacity-80",
        p.flash === "wrong" &&
          "z-20 animate-cell-wobble bg-[#EF4444] text-white dark:bg-[#DC2626] dark:text-white",
        p.flash === "taken" &&
          "bg-zinc-300 text-zinc-800 dark:bg-zinc-600 dark:text-zinc-100",
        p.selected &&
          "z-10 ring-[3.5px] ring-inset ring-[#1C1825] dark:ring-[#FFCF24]",
      )}
    >
      {p.value !== 0 ? (
        <span
          className={cn(
            "inline-block leading-none",
            p.popped && "animate-cell-pop",
          )}
        >
          {p.value}
        </span>
      ) : p.marks !== 0 ? (
        <span className="grid h-full w-full grid-cols-3 p-[5%] font-mono text-[clamp(0.45rem,1.45vw,0.68rem)] font-semibold leading-none text-muted-foreground">
          {Array.from({ length: 9 }, (_, i) => {
            const hasMark = Boolean(p.marks & (1 << i));
            return (
              <span
                key={i}
                className={cn(
                  "flex items-center justify-center rounded-[3px]",
                  p.activeDigit === i + 1 &&
                    hasMark &&
                    "bg-[#FEF08A] font-bold text-[#422006] dark:bg-[#854D0E] dark:text-[#FEF9C3]",
                )}
              >
                {hasMark ? i + 1 : ""}
              </span>
            );
          })}
        </span>
      ) : null}
    </button>
  );
});
