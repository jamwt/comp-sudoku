import { RULES } from "../../convex/gameConfig";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NinepopMark } from "@/components/NinepopLogo";
import { sound } from "@/lib/sound";

type HelpModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SHORTCUTS: Array<{ label: string; keys: string[]; note?: string }> = [
  { label: "Move cursor", keys: ["↑↓←→", "WASD", "HJKL"], note: "wraps edges" },
  { label: "Place digit", keys: ["1–9"], note: "or tap cell + pad" },
  { label: "Quick note", keys: ["⇧", "+", "1–9"], note: "single pencil mark" },
  { label: "Toggle Notes mode", keys: ["N"] },
  { label: "Toggle Digit-first", keys: ["F"] },
  { label: "Stamp armed digit", keys: ["↵", "Space"], note: "in Digit-first" },
  { label: "Clear cell notes", keys: ["⌫", "Del"] },
  { label: "Disarm Digit-first", keys: ["Esc"] },
  { label: "Open / close guide", keys: ["?"] },
];

export function HelpModal({ open, onOpenChange }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="help-modal"
        className="toy-card max-h-[88vh] w-[calc(100%-1.5rem)] max-w-2xl gap-0 overflow-y-auto rounded-2xl border-2 border-ink bg-card p-0 shadow-toy-lg sm:rounded-2xl [&>button]:right-3.5 [&>button]:top-3.5 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-xl [&>button]:border-2 [&>button]:border-ink [&>button]:bg-secondary [&>button]:opacity-100 [&>button]:shadow-toy-xs [&>button]:hover:bg-accent"
      >
        <div className="space-y-5 p-5 sm:p-6">
          <DialogHeader className="space-y-2 pr-10 text-left">
            <div className="flex items-center gap-2.5">
              <NinepopMark className="h-9 w-9" />
              <div>
                <DialogTitle className="font-display text-2xl font-bold tracking-tight text-foreground">
                  How to Play Ninepop
                </DialogTitle>
                <DialogDescription className="text-xs font-medium text-muted-foreground sm:text-sm">
                  Head-to-head pocket speed sudoku on one shared 9×9 board.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Section 1: Game rules */}
          <section className="space-y-2.5">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              The Race
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl border-2 border-ink/70 bg-screen p-3">
                <p className="font-display text-sm font-bold text-foreground">
                  Claim shared cells
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Both players race the same grid. Correct digits paint cells{" "}
                  <span className="font-bold text-[#1D4ED8] dark:text-[#7DD3FC]">
                    Cobalt Blue
                  </span>{" "}
                  for you and{" "}
                  <span className="font-bold text-[#C2410C] dark:text-[#FDBA74]">
                    Tangerine
                  </span>{" "}
                  for your rival. First valid commit wins the cell.
                </p>
              </div>

              <div className="rounded-xl border-2 border-ink/70 bg-screen p-3">
                <p className="font-display text-sm font-bold text-foreground">
                  Clinch past half to win
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Cross the center marker on the tug-of-war bar (more than half
                  of the open cells) to clinch immediately. A full-board tie is a
                  draw.
                </p>
              </div>

              <div className="rounded-xl border-2 border-ink/70 bg-screen p-3">
                <p className="font-display text-sm font-bold text-foreground">
                  {RULES.wrongEntryLockoutMs / 1000}s mistake lockout
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  A wrong digit locks your input for{" "}
                  {RULES.wrongEntryLockoutMs / 1000} seconds — no score
                  deduction, just precious time lost so guessing doesn&apos;t
                  pay.
                </p>
              </div>

              <div className="rounded-xl border-2 border-ink/70 bg-screen p-3">
                <p className="font-display text-sm font-bold text-foreground">
                  Countdown &amp; forfeit timers
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Boards unlock after a {RULES.countdownMs / 1000}s countdown.
                  Staying idle for {RULES.idleForfeitMs / 1000}s or going
                  offline for {RULES.disconnectForfeitMs / 1000}s forfeits.
                </p>
              </div>
            </div>
          </section>

          {/* Section 2: Power input modes */}
          <section className="space-y-2.5">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Speed Modes
            </h3>
            <div className="space-y-2">
              <div className="rounded-xl border-2 border-ink bg-[#EFF6FF] p-3 dark:bg-[#142744]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-[#1D4ED8] dark:text-[#7DD3FC]">
                    Notes (Pencil Marks)
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="kbd-cap">N</kbd>
                    <span className="text-[11px] text-muted-foreground">or</span>
                    <kbd className="kbd-cap">⇧+1–9</kbd>
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                  Jot candidate digits inside empty cells without risking a
                  lockout. Notes are private to you and never sent to your
                  opponent. Whenever either player places a correct digit, any
                  conflicting notes in that row, column, or 3×3 box clear
                  automatically. Press <kbd className="kbd-cap">⌫</kbd> to wipe
                  a cell&apos;s notes.
                </p>
              </div>

              <div className="rounded-xl border-2 border-ink bg-primary/20 p-3 dark:bg-primary/15">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-sm font-bold text-foreground">
                    Digit-First Mode (Speed Stamping)
                  </span>
                  <kbd className="kbd-cap">F</kbd>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                  Flips the normal cell-then-digit flow: press{" "}
                  <kbd className="kbd-cap">1–9</kbd> (or tap the digit pad) to{" "}
                  <strong>arm</strong> a number, then tap cells — or press{" "}
                  <kbd className="kbd-cap">↵</kbd> /{" "}
                  <kbd className="kbd-cap">Space</kbd> at the cursor — to stamp
                  it repeatedly across the board. Press{" "}
                  <kbd className="kbd-cap">Esc</kbd> or the same digit to
                  disarm.
                </p>
              </div>

              <p className="rounded-xl border border-border bg-secondary/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                <strong className="text-foreground">Tip:</strong> Selecting any
                filled cell — or arming a number in Digit-first — highlights
                every matching digit and pencil note in{" "}
                <span className="rounded bg-[#FEF08A] px-1 font-bold text-[#422006] dark:bg-[#EAB308]/35 dark:text-[#FEF08A]">
                  butter-yellow
                </span>{" "}
                for instant scanning.
              </p>
            </div>
          </section>

          {/* Section 3: Full keyboard shortcuts table */}
          <section className="space-y-2">
            <h3 className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Keyboard Shortcuts
            </h3>
            <div className="grid grid-cols-1 gap-x-4 divide-y divide-border/70 rounded-xl border-2 border-ink bg-screen px-3 sm:grid-cols-2 sm:divide-y-0 sm:py-1.5">
              {SHORTCUTS.map((row) => (
                <div
                  key={row.label}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs sm:border-b sm:border-border/50 sm:py-1.5 sm:last:border-b-0"
                >
                  <span className="font-medium text-foreground">
                    {row.label}
                    {row.note && (
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        · {row.note}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {row.keys.map((k, idx) =>
                      k === "+" ? (
                        <span
                          key={idx}
                          className="text-[10px] font-semibold text-muted-foreground"
                        >
                          +
                        </span>
                      ) : (
                        <kbd key={idx} className="kbd-cap">
                          {k}
                        </kbd>
                      ),
                    )}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-xs font-medium text-muted-foreground">
              Press <kbd className="kbd-cap">?</kbd> or{" "}
              <kbd className="kbd-cap">Esc</kbd> anytime
            </span>
            <Button
              size="sm"
              onClick={() => {
                sound.playTap();
                onOpenChange(false);
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
