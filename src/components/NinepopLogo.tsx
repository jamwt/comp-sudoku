import { cn } from "@/lib/utils";

export function NinepopMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn("h-8 w-8 shrink-0", className)}
    >
      <rect x="4" y="6" width="56" height="56" rx="14" fill="#1C1825" />
      <rect
        x="4"
        y="3"
        width="56"
        height="55"
        rx="14"
        fill="#FFCC1F"
        stroke="#1C1825"
        strokeWidth="3.5"
      />
      <rect
        x="10.5"
        y="9.5"
        width="43"
        height="42"
        rx="9"
        fill="#FDFBF5"
        stroke="#1C1825"
        strokeWidth="2.5"
      />
      <rect x="15" y="14" width="9.5" height="9.5" rx="2.5" fill="#2563EB" />
      <rect x="27.25" y="14" width="9.5" height="9.5" rx="2.5" fill="#E6DFCF" />
      <rect x="39.5" y="14" width="9.5" height="9.5" rx="2.5" fill="#F97316" />

      <rect x="15" y="25.75" width="9.5" height="9.5" rx="2.5" fill="#E6DFCF" />
      <rect
        x="26.5"
        y="25"
        width="11"
        height="11"
        rx="3"
        fill="#FFCC1F"
        stroke="#1C1825"
        strokeWidth="2"
      />
      <circle cx="32" cy="30.5" r="2.1" fill="#1C1825" />
      <rect x="39.5" y="25.75" width="9.5" height="9.5" rx="2.5" fill="#2563EB" />

      <rect x="15" y="37.5" width="9.5" height="9.5" rx="2.5" fill="#F97316" />
      <rect x="27.25" y="37.5" width="9.5" height="9.5" rx="2.5" fill="#2563EB" />
      <rect x="39.5" y="37.5" width="9.5" height="9.5" rx="2.5" fill="#E6DFCF" />
    </svg>
  );
}

export function NinepopWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <NinepopMark className="h-9 w-9 transition-transform duration-150 group-hover:-rotate-3 group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-2xl font-bold tracking-tight text-foreground">
          nine<span className="text-[#2563EB] dark:text-[#60A5FA]">pop</span>
        </span>
      </span>
    </span>
  );
}
