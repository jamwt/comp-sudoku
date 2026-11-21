import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { RULES, TIERS, type Tier } from "../../convex/gameConfig";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/Avatars";
import { matchPath, navigate } from "@/lib/router";
import { cn } from "@/lib/utils";
import { RankedPanel } from "@/pages/Ranked";
import { sound } from "@/lib/sound";

const TIER_META: Record<Tier, { label: string; hint: string }> = {
  easy: { label: "Easy", hint: "Singles only" },
  medium: { label: "Medium", hint: "Pairs & pointing" },
  hard: { label: "Hard", hint: "Advanced logic" },
};

const LEVEL_BADGE: Record<string, string> = {
  Beginner:
    "bg-[#CCFBF1] text-[#115E59] dark:bg-[#134E4A] dark:text-[#99F6E4]",
  Novice:
    "bg-[#FEF3C7] text-[#92400E] dark:bg-[#78350F] dark:text-[#FDE68A]",
  Intermediate:
    "bg-[#BAE6FD] text-[#075985] dark:bg-[#0C4A6E] dark:text-[#BAE6FD]",
  Advanced:
    "bg-[#DDD6FE] text-[#5B21B6] dark:bg-[#4C1D95] dark:text-[#DDD6FE]",
  Expert:
    "bg-[#FED7AA] text-[#9A3412] dark:bg-[#7C2D12] dark:text-[#FED7AA]",
  Master:
    "bg-[#E0E7FF] text-[#312E81] dark:bg-[#312E81] dark:text-[#FDE047]",
};

export function Home() {
  const create = useMutation(api.matches.create);
  const startPractice = useMutation(api.bots.startPractice);
  const bots = useQuery(api.bots.list);
  const [botId, setBotId] = useState<Id<"players"> | null>(null);
  const selectedBot = botId ?? bots?.[0]?._id ?? null;
  const [tier, setTier] = useState<Tier>(RULES.defaultTier);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<"friend" | "bot" | null>(null);

  async function onCreate(practice: boolean) {
    sound.playTap();
    setError(null);
    setCreating(practice ? "bot" : "friend");
    try {
      const id =
        practice && selectedBot
          ? await startPractice({ botId: selectedBot, tier })
          : await create({ tier });
      if (id === null) {
        setError("The puzzle pool is refilling. Try again in a few seconds.");
        setCreating(null);
        return;
      }
      navigate(matchPath(id));
    } catch (e) {
      setError(
        e instanceof ConvexError ? String(e.data) : "Could not create a match.",
      );
      setCreating(null);
    }
  }

  const activeBot = bots?.find((b) => b._id === selectedBot);

  return (
    <div className="mx-auto flex w-full max-w-[980px] flex-col gap-5 sm:gap-6">
      {/* Compact pocket-toy hero banner */}
      <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Race one board.{" "}
            <span className="text-[#2563EB] dark:text-[#60A5FA]">
              Pop every cell first.
            </span>
          </h1>
          <p className="mt-1 max-w-xl text-sm font-medium text-muted-foreground">
            Two players share one 9×9 grid. Correct digits claim territory;
            mistakes lock you out for {RULES.wrongEntryLockoutMs / 1000}s. First
            past half the board clinches the win.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-[#DBEAFE] px-2.5 py-1 text-[#1D4ED8] dark:bg-[#19355E] dark:text-[#7DD3FC]">
            <span className="h-2 w-2 rounded-full bg-[#2563EB] dark:bg-[#38BDF8]" />
            You
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-[#FFEDD5] px-2.5 py-1 text-[#C2410C] dark:bg-[#5B2514] dark:text-[#FDBA74]">
            <span className="h-2 w-2 rounded-full bg-[#F97316] dark:bg-[#FB923C]" />
            Rival
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-card px-2.5 py-1 font-mono text-[11px] text-foreground">
            {RULES.wrongEntryLockoutMs / 1000}s lockout
          </span>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border-2 border-ink bg-destructive/15 px-4 py-2.5 text-sm font-semibold text-destructive">
          {error}
        </div>
      )}

      {/* Main two-column handheld layout */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Left column: Player Profile + Ranked Queue & Play a Friend */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          <RankedPanel />

          {/* Play a Friend invite card */}
          <section className="toy-card flex flex-col gap-3.5 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                  Play a Friend
                </h2>
                <p className="text-xs font-medium text-muted-foreground">
                  Spin up a private link and race head-to-head. Unrated.
                </p>
              </div>
              <span className="rounded-lg border border-ink/40 bg-[#FFEDD5] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-[#C2410C] dark:bg-[#5B2514] dark:text-[#FDBA74]">
                Invite
              </span>
            </div>

            <TierPicker tier={tier} onChange={setTier} />

            <Button
              className="w-full"
              size="lg"
              variant="outline"
              onClick={() => void onCreate(false)}
              disabled={creating !== null}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              {creating === "friend"
                ? "Creating room…"
                : `Create ${TIER_META[tier].label} Invite Link`}
            </Button>
          </section>
        </div>

        {/* Right column: Practice vs AI Critter Deck */}
        <section
          className="toy-card flex flex-col gap-4 p-4 sm:p-5 lg:col-span-7"
          data-testid="practice"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-bold tracking-tight text-foreground">
                Practice vs AI
              </h2>
              <p className="text-xs font-medium text-muted-foreground">
                Unrated · critters solve with human techniques and slip up too.
              </p>
            </div>
            <span className="rounded-lg border border-ink/40 bg-secondary px-2.5 py-1 font-mono text-[11px] font-bold capitalize text-foreground">
              {tier} grid
            </span>
          </div>

          {bots === undefined ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-xl border-2 border-border bg-muted/60"
                />
              ))}
            </div>
          ) : bots.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No AI critters are ready yet.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {bots.map((b) => {
                const selected = b._id === selectedBot;
                return (
                  <button
                    key={b._id}
                    type="button"
                    onClick={() => {
                      sound.playTap();
                      setBotId(b._id);
                    }}
                    data-testid={`bot-${b.name}`}
                    className={cn(
                      "group relative flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center transition-[transform,box-shadow,background-color] duration-75 ease-out",
                      selected
                        ? "border-ink bg-accent shadow-toy-sm -translate-y-0.5 ring-2 ring-primary ring-offset-1 ring-offset-card"
                        : "border-ink/60 bg-screen shadow-toy-xs hover:-translate-y-0.5 hover:border-ink hover:bg-accent/50 active:translate-y-0.5 active:shadow-none",
                    )}
                  >
                    {selected && (
                      <span
                        aria-hidden="true"
                        className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-ink bg-primary text-[10px] font-bold text-primary-foreground"
                      >
                        ✓
                      </span>
                    )}
                    <PlayerAvatar
                      name={b.name}
                      isBot={true}
                      size="lg"
                      className="transition-transform duration-150 group-hover:scale-105"
                    />
                    <div className="space-y-1">
                      <span className="block font-display text-base font-bold leading-none text-foreground">
                        {b.name}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-none",
                            LEVEL_BADGE[b.level] ??
                              "bg-muted text-muted-foreground",
                          )}
                        >
                          {b.level}
                        </span>
                        <span className="font-mono text-[11px] font-bold tabular-nums text-muted-foreground">
                          {b.rating}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-2.5 pt-1">
            <TierPicker tier={tier} onChange={setTier} compact />
            <Button
              className="w-full py-3 text-base font-bold"
              size="lg"
              variant="cobalt"
              onClick={() => void onCreate(true)}
              disabled={creating !== null || selectedBot === null}
            >
              {creating === "bot"
                ? "Starting match…"
                : `Practice vs ${activeBot?.name ?? "AI"}`}
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

function TierPicker({
  tier,
  onChange,
  compact = false,
}: {
  tier: Tier;
  onChange: (t: Tier) => void;
  compact?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Puzzle difficulty"
      className="grid grid-cols-3 gap-1.5"
    >
      {TIERS.map((t) => {
        const active = t === tier;
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              sound.playTap();
              onChange(t);
            }}
            className={cn(
              "rounded-xl border-2 px-2 py-2 text-center transition-[transform,box-shadow,background-color] duration-75",
              active
                ? "border-ink bg-primary text-primary-foreground shadow-toy-xs"
                : "border-ink/45 bg-screen text-foreground hover:border-ink hover:bg-accent/60",
            )}
          >
            <span className="block font-display text-xs font-bold leading-tight sm:text-sm">
              {TIER_META[t].label}
            </span>
            {!compact && (
              <span
                className={cn(
                  "mt-0.5 block text-[10px] font-medium leading-tight",
                  active
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {TIER_META[t].hint}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
