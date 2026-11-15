import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DigitPadProps = {
  board: string;
  activeDigit: number | null;
  digitFirst: boolean;
  notesMode: boolean;
  disabled: boolean;
  onDigit: (digit: number) => void;
  onToggleNotes: () => void;
  onToggleDigitFirst: () => void;
  onClearNotes: () => void;
};

export function DigitPad(p: DigitPadProps) {
  const placed = (d: number) =>
    [...p.board].filter((c) => c === String(d)).length;
  return (
    <div className="flex w-full max-w-[560px] flex-col gap-2">
      <div className="grid grid-cols-9 gap-1.5">
        {Array.from({ length: 9 }, (_, i) => {
          const d = i + 1;
          const left = 9 - placed(d);
          return (
            <button
              key={d}
              type="button"
              data-digit={d}
              disabled={p.disabled || left === 0}
              onMouseDown={(e) => {
                e.preventDefault();
                p.onDigit(d);
              }}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-md border text-xl font-semibold transition-colors hover:bg-accent disabled:opacity-30",
                p.activeDigit === d &&
                  p.digitFirst &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
                p.notesMode && "text-muted-foreground",
              )}
            >
              {d}
              <span className="text-[0.6rem] font-normal opacity-70">
                {left}
              </span>
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <Button
          variant={p.notesMode ? "default" : "outline"}
          size="sm"
          onClick={p.onToggleNotes}
          data-testid="notes-toggle"
        >
          Notes {p.notesMode ? "on" : "off"}{" "}
          <kbd className="ml-1 opacity-60">N</kbd>
        </Button>
        <Button
          variant={p.digitFirst ? "default" : "outline"}
          size="sm"
          onClick={p.onToggleDigitFirst}
          data-testid="digit-first-toggle"
        >
          Digit-first <kbd className="ml-1 opacity-60">F</kbd>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={p.onClearNotes}
          disabled={p.disabled}
        >
          Clear notes <kbd className="ml-1 opacity-60">⌫</kbd>
        </Button>
      </div>
    </div>
  );
}
