import { useId } from "react";
import type { MatchView } from "../../convex/matches";
import {
  buildLeadTimeline,
  buildStrategyBreakdown,
} from "../../convex/lib/matchAnalytics";
import { cn } from "@/lib/utils";

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MatchSummaryCharts({ match }: { match: MatchView }) {
  const uid = useId().replace(/:/g, "");

  if (match.moves.length === 0) return null;

  const perspective = match.you ?? 0;
  const selfLabel =
    match.you !== null ? "You" : (match.participants[0]?.name ?? "P1");
  const oppLabel =
    match.you !== null
      ? (match.participants[match.you === 0 ? 1 : 0]?.name ?? "Rival")
      : (match.participants[1]?.name ?? "P2");

  const timeline = buildLeadTimeline(
    match.moves,
    match.startsAt,
    match.endedAt,
    match.you,
    match.result?.winner ?? null,
  );
  const strategies = buildStrategyBreakdown(match.moves, match.you);
  const maxBucketTotal = Math.max(1, ...strategies.map((r) => r.total));

  // SVG geometry
  const W = 320;
  const H = 84;
  const padL = 28;
  const padR = 10;
  const padT = 10;
  const padB = 14;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const zeroY = padT + plotH / 2;

  const xOf = (tMs: number) =>
    padL + (Math.min(timeline.durationMs, Math.max(0, tMs)) / timeline.durationMs) * plotW;
  const yOf = (lead: number) =>
    zeroY - (lead / timeline.maxAbsLead) * (plotH / 2 - 2);

  // Build crisp step-after polyline so each cell claim jumps at its exact timestamp
  const pts = timeline.points;
  const lineParts: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const x = xOf(pts[i].tMs);
    const y = yOf(pts[i].lead);
    if (i === 0) {
      lineParts.push(`M ${x.toFixed(1)} ${y.toFixed(1)}`);
    } else {
      const prevY = yOf(pts[i - 1].lead);
      lineParts.push(`L ${x.toFixed(1)} ${prevY.toFixed(1)}`);
      lineParts.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
    }
  }
  const lineD = lineParts.join(" ");
  const lastPt = pts[pts.length - 1];
  const lastX = xOf(lastPt.tMs);
  const lastY = yOf(lastPt.lead);
  const areaD = `${lineD} L ${lastX.toFixed(1)} ${zeroY.toFixed(1)} L ${padL.toFixed(1)} ${zeroY.toFixed(1)} Z`;

  const badge =
    timeline.comebackFrom >= 2
      ? {
          text: `Comeback from -${timeline.comebackFrom}!`,
          tone: "bg-primary text-primary-foreground",
        }
      : timeline.leadChanges >= 2
        ? {
            text: `${timeline.leadChanges} lead changes`,
            tone: "bg-secondary text-foreground",
          }
        : timeline.leadChanges === 1
          ? {
              text: "1 lead change",
              tone: "bg-secondary text-foreground",
            }
          : timeline.wireToWire
            ? {
                text: "Wire-to-wire",
                tone: "bg-secondary text-foreground",
              }
            : null;

  const finalDotFill =
    match.result?.winner === null
      ? "#A1A1AA"
      : match.result?.winner === perspective
        ? "#2563EB"
        : "#F97316";

  return (
    <div className="space-y-3" data-testid="match-summary-charts">
      {/* Lead-over-time spark chart */}
      <div
        className="rounded-xl border-2 border-ink bg-screen p-3 shadow-toy-inset"
        data-testid="lead-spark-chart"
      >
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Lead Over Time
          </p>
          {badge && (
            <span
              className={cn(
                "rounded-md border border-ink/50 px-1.5 py-0.5 font-mono text-[10px] font-bold leading-none",
                badge.tone,
              )}
              data-testid="lead-highlight-badge"
            >
              {badge.text}
            </span>
          )}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-[84px] w-full overflow-visible"
          role="img"
          aria-label={`Lead over time chart: ${selfLabel} vs ${oppLabel}`}
        >
          <defs>
            <clipPath id={`pos-${uid}`}>
              <rect x={padL} y={padT - 2} width={plotW} height={plotH / 2 + 2} />
            </clipPath>
            <clipPath id={`neg-${uid}`}>
              <rect x={padL} y={zeroY} width={plotW} height={plotH / 2 + 2} />
            </clipPath>
          </defs>

          {/* Top & bottom subtle guide lines */}
          <line
            x1={padL}
            y1={padT + 2}
            x2={W - padR}
            y2={padT + 2}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
          <line
            x1={padL}
            y1={H - padB - 2}
            x2={W - padR}
            y2={H - padB - 2}
            stroke="currentColor"
            strokeOpacity="0.1"
            strokeWidth="1"
          />
          {/* Zero baseline */}
          <line
            x1={padL}
            y1={zeroY}
            x2={W - padR}
            y2={zeroY}
            stroke="currentColor"
            strokeOpacity="0.35"
            strokeWidth="1.25"
            strokeDasharray="3 3"
          />

          {/* Cobalt area when self leads, Tangerine area when opponent leads */}
          <path
            d={areaD}
            fill="#2563EB"
            fillOpacity="0.24"
            clipPath={`url(#pos-${uid})`}
          />
          <path
            d={areaD}
            fill="#F97316"
            fillOpacity="0.26"
            clipPath={`url(#neg-${uid})`}
          />

          {/* Color-coded lead trace above & below zero */}
          <path
            d={lineD}
            fill="none"
            className="stroke-[#2563EB] dark:stroke-[#60A5FA]"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath={`url(#pos-${uid})`}
          />
          <path
            d={lineD}
            fill="none"
            className="stroke-[#EA580C] dark:stroke-[#FB923C]"
            strokeWidth="2.25"
            strokeLinejoin="round"
            strokeLinecap="round"
            clipPath={`url(#neg-${uid})`}
          />

          {/* Final clinch point */}
          <circle
            cx={lastX}
            cy={lastY}
            r="4"
            fill={finalDotFill}
            className="stroke-card"
            strokeWidth="2"
          />

          {/* Y-axis ticks */}
          <text
            x={padL - 5}
            y={padT + 5}
            textAnchor="end"
            className="fill-[#1D4ED8] font-mono text-[9px] font-bold dark:fill-[#60A5FA]"
          >
            +{timeline.maxAbsLead}
          </text>
          <text
            x={padL - 5}
            y={zeroY + 3}
            textAnchor="end"
            className="fill-muted-foreground font-mono text-[9px] font-bold"
          >
            0
          </text>
          <text
            x={padL - 5}
            y={H - padB + 1}
            textAnchor="end"
            className="fill-[#C2410C] font-mono text-[9px] font-bold dark:fill-[#FB923C]"
          >
            -{timeline.maxAbsLead}
          </text>

          {/* X-axis timestamps */}
          <text
            x={padL}
            y={H - 1}
            textAnchor="start"
            className="fill-muted-foreground font-mono text-[9px] font-semibold"
          >
            0:00
          </text>
          <text
            x={padL + plotW / 2}
            y={H - 1}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[9px] font-semibold"
          >
            {formatClock(timeline.durationMs / 2)}
          </text>
          <text
            x={W - padR}
            y={H - 1}
            textAnchor="end"
            className="fill-muted-foreground font-mono text-[9px] font-semibold"
          >
            {formatClock(timeline.durationMs)}
          </text>
        </svg>

        <div className="mt-1 flex items-center justify-between text-[11px] font-semibold">
          <span className="flex items-center gap-1.5 text-[#1D4ED8] dark:text-[#60A5FA]">
            <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
            {selfLabel} ahead
          </span>
          <span className="flex items-center gap-1.5 text-[#C2410C] dark:text-[#FB923C]">
            {oppLabel} ahead
            <span className="h-2 w-2 rounded-full bg-[#F97316]" />
          </span>
        </div>
      </div>

      {/* Per-player deduction strategy breakdown */}
      {strategies.length > 0 && (
        <div
          className="rounded-xl border-2 border-ink bg-screen p-3 shadow-toy-inset"
          data-testid="strategy-breakdown"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Deduction Strategies
            </p>
            <div className="flex items-center gap-2.5 font-mono text-[10px] font-bold">
              <span className="flex items-center gap-1 text-[#1D4ED8] dark:text-[#60A5FA]">
                <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                {selfLabel}
              </span>
              <span className="flex items-center gap-1 text-[#C2410C] dark:text-[#FB923C]">
                <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                {oppLabel}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            {strategies.map((row) => {
              const widthPct = Math.max(12, (row.total / maxBucketTotal) * 100);
              const youShare = (row.youCount / row.total) * 100;
              const oppShare = 100 - youShare;
              return (
                <div key={row.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="font-display font-bold text-foreground">
                        {row.label}
                      </span>
                      <span className="ml-1.5 text-[10px] text-muted-foreground">
                        {row.hint}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums">
                      <span className="text-[#1D4ED8] dark:text-[#60A5FA]">
                        {row.youCount}
                      </span>
                      <span className="mx-1 text-muted-foreground/60">·</span>
                      <span className="text-[#C2410C] dark:text-[#FB923C]">
                        {row.oppCount}
                      </span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-ink/30 bg-muted/60">
                    <div
                      className="flex h-full overflow-hidden rounded-full"
                      style={{ width: `${widthPct}%` }}
                    >
                      {row.youCount > 0 && (
                        <div
                          className="h-full bg-[#2563EB]"
                          style={{ width: `${youShare}%` }}
                        />
                      )}
                      {row.oppCount > 0 && (
                        <div
                          className="h-full bg-[#F97316]"
                          style={{ width: `${oppShare}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
