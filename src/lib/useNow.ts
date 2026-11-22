import { useEffect, useState } from "react";

/** Re-render every `intervalMs` while `active`, returning Date.now(). */
export function useNow(active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return active ? now : Date.now();
}

/**
 * Event-driven match clock: ticks at 100ms only during the pre-match countdown
 * or an active wrong-digit lockout bar, sleeps during normal play until the
 * idle-forfeit warning window opens, and ticks every 500ms during that warning.
 */
export function useMatchClock({
  active,
  startsAt,
  lockUntil,
  idleWarningAt,
}: {
  active: boolean;
  startsAt: number;
  lockUntil: number;
  idleWarningAt: number | null;
}): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const current = Date.now();
      setNow(current);

      const fastUntil = Math.max(startsAt, lockUntil);
      if (current < fastUntil) {
        const delay = Math.min(100, Math.max(16, fastUntil - current));
        timer = setTimeout(schedule, delay);
        return;
      }

      if (idleWarningAt !== null) {
        if (current < idleWarningAt) {
          timer = setTimeout(schedule, idleWarningAt - current + 25);
          return;
        }
        timer = setTimeout(schedule, 500);
      }
    };

    schedule();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [active, startsAt, lockUntil, idleWarningAt]);

  return now;
}
