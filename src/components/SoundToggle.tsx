import { useSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

export function SoundToggle() {
  const { enabled, toggle } = useSound();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={enabled ? "Mute sound effects" : "Enable sound effects"}
      aria-pressed={enabled}
      title={enabled ? "Sound on" : "Sound off"}
      data-testid="sound-toggle"
      className={cn(
        "toy-key inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
        enabled
          ? "bg-card text-foreground hover:bg-accent"
          : "bg-muted/80 text-muted-foreground opacity-75 hover:bg-accent hover:text-foreground",
      )}
    >
      {enabled ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" fillOpacity="0.18" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
        >
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      )}
    </button>
  );
}
