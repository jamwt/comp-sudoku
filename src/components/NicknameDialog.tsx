import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { NICKNAME } from "../../convex/gameConfig";
import {
  normalizeNickname,
  validateNickname,
} from "../../convex/lib/nickname";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sound } from "@/lib/sound";

type NicknameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentNickname: string | null;
  currentName: string;
};

export function NicknameDialog({
  open,
  onOpenChange,
  currentNickname,
  currentName,
}: NicknameDialogProps) {
  const setNickname = useAction(api.players.setNickname);
  const [draft, setDraft] = useState(currentNickname ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(currentNickname ?? "");
      setError(null);
    }
  }, [open, currentNickname]);

  const validation = draft.length > 0 ? validateNickname(draft) : null;
  const unchanged =
    validation?.ok === true && validation.nickname === currentNickname;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const check = validateNickname(draft);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    if (check.nickname === currentNickname) {
      onOpenChange(false);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await setNickname({ nickname: check.nickname });
      sound.playPop();
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof ConvexError
          ? String(err.data)
          : "Could not save that nickname. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="nickname-dialog"
        className="toy-card w-[calc(100%-1.5rem)] max-w-md gap-0 rounded-2xl border-2 border-ink bg-card p-5 shadow-toy-lg sm:rounded-2xl sm:p-6 [&>button]:right-3.5 [&>button]:top-3.5 [&>button]:flex [&>button]:h-8 [&>button]:w-8 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-xl [&>button]:border-2 [&>button]:border-ink [&>button]:bg-secondary [&>button]:opacity-100 [&>button]:shadow-toy-xs [&>button]:hover:bg-accent"
      >
        <DialogHeader className="space-y-1.5 pr-10 text-left">
          <DialogTitle className="font-display text-xl font-bold tracking-tight text-foreground">
            {currentNickname ? "Change nickname" : "Choose your nickname"}
          </DialogTitle>
          <DialogDescription className="text-xs font-medium text-muted-foreground sm:text-sm">
            {currentNickname
              ? `Currently playing as ${currentNickname}. Picking a new handle releases your old one.`
              : `Currently playing as ${currentName}. Claim a unique handle for matches and the leaderboard.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void onSubmit(e)} className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <label
              htmlFor="nickname-input"
              className="block font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              Nickname
            </label>
            <Input
              id="nickname-input"
              data-testid="nickname-input"
              value={draft}
              onChange={(e) => {
                setDraft(normalizeNickname(e.target.value));
                if (error) setError(null);
              }}
              placeholder="e.g. sudokupop"
              maxLength={NICKNAME.maxLength}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoFocus
              disabled={submitting}
              className="h-10 font-mono text-sm"
            />
            <p className="text-[11px] font-medium text-muted-foreground">
              {NICKNAME.minLength}–{NICKNAME.maxLength} characters · starts with
              a letter · lowercase <code className="font-mono">a–z</code> and{" "}
              <code className="font-mono">0–9</code> only.
            </p>
          </div>

          {(error || (validation && !validation.ok)) && (
            <p
              role="alert"
              data-testid="nickname-error"
              className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
            >
              {error ?? (validation && !validation.ok ? validation.error : null)}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              data-testid="nickname-save"
              disabled={
                submitting || !validation?.ok || unchanged
              }
            >
              {submitting ? "Checking…" : "Save nickname"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
