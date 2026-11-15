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
