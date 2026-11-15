import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { RULES, TIERS, type Tier } from "../../convex/gameConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchPath, navigate } from "@/lib/router";
import { cn } from "@/lib/utils";

const TIER_LABELS: Record<Tier, string> = {
  easy: "Easy · singles only",
  medium: "Medium · pairs and pointing",
  hard: "Hard · beyond pointing",
};

export function Home() {
  const me = useQuery(api.players.me);
  const rename = useMutation(api.players.rename);
  const create = useMutation(api.matches.create);
  const startPractice = useMutation(api.bots.startPractice);
  const bots = useQuery(api.bots.list);
  const [botId, setBotId] = useState<Id<"players"> | null>(null);
  const selectedBot = botId ?? bots?.[0]?._id ?? null;
  const [tier, setTier] = useState<Tier>(RULES.defaultTier);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function onCreate(practice: boolean) {
    setError(null);
    setCreating(true);
    try {
      const id =
        practice && selectedBot
          ? await startPractice({ botId: selectedBot, tier })
          : await create({ tier });
      if (id === null) {
        setError("The puzzle pool is refilling. Try again in a few seconds.");
        setCreating(false);
        return;
      }
      navigate(matchPath(id));
    } catch (e) {
      setError(
        e instanceof ConvexError ? String(e.data) : "Could not create a match.",
      );
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8 pt-6">
      <section className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          Race a friend through one sudoku.
        </h1>
        <p className="text-muted-foreground">
          You share a board. A correct digit claims the cell; a wrong one locks
          you out for {RULES.wrongEntryLockoutMs / 1000}s. Hold more than half
          of the empty cells to win.
        </p>
      </section>

      <section className="space-y-2">
        <label className="text-sm font-medium" htmlFor="name">
          Your name
        </label>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (draftName !== null)
              void rename({ name: draftName }).then(() => setDraftName(null));
          }}
        >
          <Input
            id="name"
            value={draftName ?? me?.name ?? ""}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={24}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={draftName === null}
          >
            Save
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <span className="text-sm font-medium">Difficulty</span>
        <div className="grid gap-2">
          {TIERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                t === tier
                  ? "border-primary bg-accent font-medium"
                  : "hover:bg-accent/60",
              )}
            >
              {TIER_LABELS[t]}
            </button>
          ))}
        </div>
        <Button
          className="w-full"
          size="lg"
          onClick={() => void onCreate(false)}
          disabled={creating}
        >
          {creating ? "Creating…" : "Create match"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </section>

      <section className="space-y-3" data-testid="practice">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Practice vs AI</h2>
          <p className="text-sm text-muted-foreground">
            Unrated. Bots deduce like people do and make mistakes too. Uses the
            difficulty above.
          </p>
        </div>
        {bots === undefined ? null : bots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bots are set up.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {bots.map((b) => (
              <button
                key={b._id}
                type="button"
                onClick={() => setBotId(b._id)}
                data-testid={`bot-${b.name}`}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  b._id === selectedBot
                    ? "border-primary bg-accent"
                    : "hover:bg-accent/60",
                )}
              >
                <span className="block font-medium">{b.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {b.level} · {b.rating}
                </span>
              </button>
            ))}
          </div>
        )}
        <Button
          className="w-full"
          size="lg"
          variant="secondary"
          onClick={() => void onCreate(true)}
          disabled={creating || selectedBot === null}
        >
          Practice vs {bots?.find((b) => b._id === selectedBot)?.name ?? "AI"}
        </Button>
      </section>
    </div>
  );
}
