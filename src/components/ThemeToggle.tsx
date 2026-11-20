"use client";

import { DesktopIcon, MoonIcon, SunIcon } from "@radix-ui/react-icons";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { sound } from "@/lib/sound";

const OPTIONS = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: DesktopIcon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex h-9 items-center gap-0.5 rounded-xl border-2 border-ink bg-card p-0.5 shadow-toy-sm"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = (theme ?? "system") === value;
        return (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={active}
            title={label}
            onClick={() => {
              sound.playTap();
              setTheme(value);
            }}
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
              active
                ? "bg-primary text-primary-foreground shadow-[inset_0_0_0_1.5px_hsl(var(--ink))]"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
