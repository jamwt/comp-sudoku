import { cn } from "@/lib/utils";

type DigitPadProps = {
  board: string;
  activeDigit: number | null;
  digitFirst: boolean;
  notesMode: boolean;
  disabled: boolean;
  pressedKey: string | null;
  onDigit: (digit: number) => void;
  onToggleNotes: () => void;
  onToggleDigitFirst: () => void;
  onClearNotes: () => void;
};

export function DigitPad(p: DigitPadProps) {
  const placed = (d: number) =>
    [...p.board].filter((c) => c === String(d)).length;

  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
        {Array.from({ length: 9 }, (_, i) => {
          const d = i + 1;
          const left = 9 - placed(d);
          const armed = p.activeDigit === d && p.digitFirst;
          const depressed = p.pressedKey === String(d);
          const exhausted = left === 0;

          return (
            <button
              key={d}
              type="button"
              data-digit={d}
              disabled={p.disabled || exhausted}
              onMouseDown={(e) => {
                e.preventDefault();
                p.onDigit(d);
              }}
              className={cn(
                "relative flex aspect-[4/5] flex-col items-center justify-center rounded-xl border-2 border-ink font-display transition-[transform,box-shadow,background-color] duration-75 ease-out sm:aspect-square",
                exhausted
                  ? "cursor-default border-border bg-muted/50 text-muted-foreground/40 shadow-none"
                  : armed
                    ? "bg-primary text-primary-foreground shadow-toy-xs translate-y-[1.5px]"
                    : p.notesMode
                      ? "bg-secondary text-foreground shadow-toy-sm hover:bg-accent active:translate-y-[2.5px] active:shadow-none"
                      : "bg-card text-foreground shadow-toy-sm hover:bg-accent active:translate-y-[2.5px] active:shadow-none",
                !exhausted && depressed && "translate-y-[2.5px] shadow-none",
                p.disabled && !exhausted && "opacity-55",
              )}
            >
              {p.notesMode && !exhausted && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#2563EB] dark:bg-[#38BDF8]"
                />
              )}
              <span className="text-lg font-bold leading-none tabular-nums sm:text-2xl">
                {d}
              </span>
              <span
                className={cn(
                  "mt-0.5 font-mono text-[10px] font-semibold leading-none tabular-nums sm:text-[11px]",
                  armed
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {exhausted ? "✓" : left}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={p.onToggleNotes}
          data-testid="notes-toggle"
          className={cn(
            "toy-key flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 font-display text-xs font-semibold sm:text-sm",
            p.notesMode
              ? "bg-[#2563EB] text-white dark:bg-[#38BDF8] dark:text-[#0B1220]"
              : "bg-card text-foreground hover:bg-accent",
            p.pressedKey === "notes" && "toy-key-pressed",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 shrink-0 rounded-full border border-ink/60",
              p.notesMode ? "bg-[#FFCC1F]" : "bg-muted-foreground/30",
            )}
          />
          <span>Notes</span>
          <kbd className="kbd-cap hidden sm:inline-flex">N</kbd>
        </button>

        <button
          type="button"
          onClick={p.onToggleDigitFirst}
          data-testid="digit-first-toggle"
          className={cn(
            "toy-key flex h-10 items-center justify-center gap-1.5 rounded-xl px-2 font-display text-xs font-semibold sm:text-sm",
            p.digitFirst
              ? "bg-primary text-primary-foreground"
              : "bg-card text-foreground hover:bg-accent",
            p.pressedKey === "digitFirst" && "toy-key-pressed",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "h-2 w-2 shrink-0 rounded-full border border-ink/60",
              p.digitFirst ? "bg-emerald-400" : "bg-muted-foreground/30",
            )}
          />
          <span className="truncate">Digit-first</span>
          <kbd className="kbd-cap hidden sm:inline-flex">F</kbd>
        </button>

        <button
          type="button"
          onClick={p.onClearNotes}
          disabled={p.disabled}
          className={cn(
            "toy-key flex h-10 items-center justify-center gap-1.5 rounded-xl bg-card px-2 font-display text-xs font-semibold text-foreground hover:bg-accent disabled:pointer-events-none disabled:opacity-45 sm:text-sm",
            p.pressedKey === "clear" && "toy-key-pressed",
          )}
        >
          <span>Clear</span>
          <kbd className="kbd-cap hidden sm:inline-flex">⌫</kbd>
        </button>
      </div>
    </div>
  );
}
