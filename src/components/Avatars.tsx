import {
  getHumanAvatarSpec,
  resolveBotKey,
  type BotAvatarKey,
  type GuestAnimal,
} from "@/lib/avatars";
import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-11 w-11",
  lg: "h-14 w-14",
};

/** Renders either a custom Ninepop bot critter SVG or a deterministic human toy badge. */
export function PlayerAvatar({
  name,
  isBot,
  size = "md",
  className,
}: {
  name: string;
  isBot?: boolean;
  size?: AvatarSize;
  className?: string;
}) {
  const botKey = resolveBotKey(name);
  if (botKey && (isBot ?? true)) {
    return (
      <BotCritterAvatar
        botKey={botKey}
        className={cn(SIZE_CLASS[size], "shrink-0", className)}
      />
    );
  }
  return (
    <HumanBadgeAvatar
      name={name}
      className={cn(SIZE_CLASS[size], "shrink-0", className)}
    />
  );
}

export function BotCritterAvatar({
  botKey,
  className,
}: {
  botKey: BotAvatarKey;
  className?: string;
}) {
  switch (botKey) {
    case "pip":
      return <PipSvg className={className} />;
    case "tilly":
      return <TillySvg className={className} />;
    case "marlow":
      return <MarlowSvg className={className} />;
    case "juniper":
      return <JuniperSvg className={className} />;
    case "vega":
      return <VegaSvg className={className} />;
    case "ada":
      return <AdaSvg className={className} />;
  }
}

/** Pip (800 · Beginner): Cozy mint sprout-chick hatchling. */
function PipSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#CCFBF1"
        stroke="#1C1825"
        strokeWidth="3"
      />
      <path d="M12 10H30" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {/* Sprout */}
      <path d="M32 22V14" stroke="#15803D" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M32 16C26 15 23 11 25 8C29 8 32 11 32 16Z"
        fill="#4ADE80"
        stroke="#1C1825"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path
        d="M32 15C38 14 41 10 39 7C35 7 32 10 32 15Z"
        fill="#22C55E"
        stroke="#1C1825"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Round chick body */}
      <circle cx="32" cy="39" r="18" fill="#FEF08A" stroke="#1C1825" strokeWidth="3" />
      {/* Little wings */}
      <path
        d="M14 41C11 38 12 33 15 34"
        fill="#FDE047"
        stroke="#1C1825"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M50 41C53 38 52 33 49 34"
        fill="#FDE047"
        stroke="#1C1825"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Eyes */}
      <circle cx="25" cy="36" r="3.4" fill="#1C1825" />
      <circle cx="39" cy="36" r="3.4" fill="#1C1825" />
      <circle cx="24" cy="34.8" r="1.2" fill="#FFFFFF" />
      <circle cx="38" cy="34.8" r="1.2" fill="#FFFFFF" />
      {/* Cheeks */}
      <ellipse cx="19.5" cy="41.5" rx="3" ry="1.9" fill="#FB7185" opacity="0.65" />
      <ellipse cx="44.5" cy="41.5" rx="3" ry="1.9" fill="#FB7185" opacity="0.65" />
      {/* Beak */}
      <path
        d="M29 41.5L32 45.5L35 41.5H29Z"
        fill="#FB923C"
        stroke="#1C1825"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Tilly (1050 · Novice): Studious butter-yellow bunny with oversized glasses. */
function TillySvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#FEF3C7"
        stroke="#1C1825"
        strokeWidth="3"
      />
      <path d="M12 10H28" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      {/* Bunny ears */}
      <rect
        x="17"
        y="8"
        width="10"
        height="22"
        rx="5"
        transform="rotate(-8 17 8)"
        fill="#FFFBF2"
        stroke="#1C1825"
        strokeWidth="2.8"
      />
      <rect
        x="20"
        y="12"
        width="4.5"
        height="13"
        rx="2.25"
        transform="rotate(-8 20 12)"
        fill="#FDBA74"
      />
      <rect
        x="37"
        y="8"
        width="10"
        height="22"
        rx="5"
        transform="rotate(8 47 8)"
        fill="#FFFBF2"
        stroke="#1C1825"
        strokeWidth="2.8"
      />
      <rect
        x="39.5"
        y="12"
        width="4.5"
        height="13"
        rx="2.25"
        transform="rotate(8 44 12)"
        fill="#FDBA74"
      />
      {/* Head */}
      <ellipse cx="32" cy="40" rx="18" ry="16" fill="#FFFBF2" stroke="#1C1825" strokeWidth="3" />
      {/* Glasses */}
      <circle cx="24" cy="39" r="6.8" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2.6" />
      <circle cx="40" cy="39" r="6.8" fill="#E0F2FE" stroke="#0284C7" strokeWidth="2.6" />
      <path d="M30.8 39H33.2" stroke="#0284C7" strokeWidth="2.6" />
      {/* Eyes */}
      <circle cx="24.5" cy="39" r="2.7" fill="#1C1825" />
      <circle cx="39.5" cy="39" r="2.7" fill="#1C1825" />
      <circle cx="23.6" cy="38" r="1" fill="#FFFFFF" />
      <circle cx="38.6" cy="38" r="1" fill="#FFFFFF" />
      {/* Nose & Smile */}
      <path d="M30.5 45.5L32 47L33.5 45.5" stroke="#1C1825" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M28.5 49C30.2 50.8 33.8 50.8 35.5 49" stroke="#1C1825" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Marlow (1300 · Intermediate): Sporty sky-and-coral fox with a headband. */
function MarlowSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#BAE6FD"
        stroke="#1C1825"
        strokeWidth="3"
      />
      <path d="M12 10H29" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      {/* Pointed Fox Ears */}
      <path d="M14 30L16 11L29 22Z" fill="#F97316" stroke="#1C1825" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M50 30L48 11L35 22Z" fill="#F97316" stroke="#1C1825" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M17.5 24L18.5 16L24.5 21.5Z" fill="#FEF3C7" />
      <path d="M46.5 24L45.5 16L39.5 21.5Z" fill="#FEF3C7" />
      {/* Fox Head */}
      <path
        d="M14 35C14 25 22 21 32 21C42 21 50 25 50 35C50 47 41 55 32 55C23 55 14 47 14 35Z"
        fill="#F97316"
        stroke="#1C1825"
        strokeWidth="3"
      />
      {/* Cream cheeks */}
      <path
        d="M15.5 39C20 37 25 40 32 45C39 40 44 37 48.5 39C47 49 40 54.5 32 54.5C24 54.5 17 49 15.5 39Z"
        fill="#FFFBEB"
      />
      {/* Sporty Headband */}
      <path d="M15.5 29.5C21 26.5 43 26.5 48.5 29.5" stroke="#1E3A8A" strokeWidth="5" strokeLinecap="round" />
      <path d="M26 27.6H38" stroke="#FACC15" strokeWidth="2.5" strokeLinecap="round" />
      {/* Confident eyes (one wink!) */}
      <circle cx="24" cy="37.5" r="3" fill="#1C1825" />
      <circle cx="23.2" cy="36.5" r="1" fill="#FFFFFF" />
      <path d="M36.5 37.5C38.2 35.5 41.2 35.5 43 37.5" stroke="#1C1825" strokeWidth="2.8" strokeLinecap="round" />
      {/* Nose & smirk */}
      <polygon points="32,45 29,41.5 35,41.5" fill="#1C1825" />
      <path d="M29 48.5C31.5 50 34.5 49.5 36.5 47.5" stroke="#1C1825" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Juniper (1550 · Advanced): Sharp lavender-plum owl with amber specs. */
function JuniperSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#DDD6FE"
        stroke="#1C1825"
        strokeWidth="3"
      />
      <path d="M12 10H28" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      {/* Ear tufts */}
      <path d="M16 25L12 13L25 19Z" fill="#5B21B6" stroke="#1C1825" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M48 25L52 13L39 19Z" fill="#5B21B6" stroke="#1C1825" strokeWidth="2.8" strokeLinejoin="round" />
      {/* Owl body */}
      <rect x="14" y="18" width="36" height="38" rx="17" fill="#6D28D9" stroke="#1C1825" strokeWidth="3" />
      {/* Face mask */}
      <circle cx="24.5" cy="34" r="8" fill="#F5F3FF" stroke="#1C1825" strokeWidth="2.4" />
      <circle cx="39.5" cy="34" r="8" fill="#F5F3FF" stroke="#1C1825" strokeWidth="2.4" />
      {/* Sharp half-lidded eyes */}
      <circle cx="25" cy="35" r="3.4" fill="#F59E0B" stroke="#1C1825" strokeWidth="2" />
      <circle cx="39" cy="35" r="3.4" fill="#F59E0B" stroke="#1C1825" strokeWidth="2" />
      <circle cx="25" cy="35" r="1.4" fill="#1C1825" />
      <circle cx="39" cy="35" r="1.4" fill="#1C1825" />
      {/* Brow focus lines */}
      <path d="M18 29.5L29 32" stroke="#1C1825" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M46 29.5L35 32" stroke="#1C1825" strokeWidth="2.6" strokeLinecap="round" />
      {/* Beak */}
      <path d="M29 40L32 45.5L35 40H29Z" fill="#FBBF24" stroke="#1C1825" strokeWidth="2.2" strokeLinejoin="round" />
      {/* Chest diamond pin */}
      <path d="M32 49L35 52L32 55L29 52Z" fill="#38BDF8" stroke="#1C1825" strokeWidth="1.8" />
    </svg>
  );
}

/** Vega (1800 · Expert): Sleek cosmic cyber-cat with star visor. */
function VegaSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#FED7AA"
        stroke="#1C1825"
        strokeWidth="3"
      />
      <path d="M12 10H28" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
      {/* Antenna / Cat ears */}
      <path d="M15 29L18 11L29 21Z" fill="#1E293B" stroke="#1C1825" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M49 29L46 11L35 21Z" fill="#1E293B" stroke="#1C1825" strokeWidth="2.8" strokeLinejoin="round" />
      <path d="M19 22L20.5 16L25 20.5Z" fill="#FB923C" />
      <path d="M45 22L43.5 16L39 20.5Z" fill="#FB923C" />
      {/* Head */}
      <rect x="13" y="20" width="38" height="35" rx="15" fill="#1E293B" stroke="#1C1825" strokeWidth="3" />
      {/* Sleek glowing cyan visor */}
      <rect
        x="17"
        y="29"
        width="30"
        height="12"
        rx="6"
        fill="#0EA5E9"
        stroke="#1C1825"
        strokeWidth="2.5"
      />
      {/* Visor shine + eyes */}
      <path d="M21 32.5H27" stroke="#E0F2FE" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M37 32.5H43" stroke="#E0F2FE" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="24" cy="36.5" r="1.8" fill="#FEF08A" />
      <circle cx="40" cy="36.5" r="1.8" fill="#FEF08A" />
      {/* Whiskers & sleek mouth */}
      <path d="M16 44.5H21M43 44.5H48" stroke="#FB923C" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M28 46.5L32 48.5L36 46.5" stroke="#F8FAFC" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
      {/* Star collar */}
      <circle cx="32" cy="54" r="3.5" fill="#FFCC1F" stroke="#1C1825" strokeWidth="2" />
    </svg>
  );
}

/** Ada (2000 · Master): Regal indigo-gold crowned grandmaster bot. */
function AdaSvg({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill="#312E81"
        stroke="#1C1825"
        strokeWidth="3"
      />
      {/* Subtle cosmic sparkles */}
      <circle cx="12" cy="14" r="1.8" fill="#FDE047" />
      <circle cx="52" cy="16" r="1.5" fill="#FDE047" />
      <circle cx="50" cy="49" r="1.5" fill="#93C5FD" />
      {/* Crown */}
      <path
        d="M21 22L23 11L29 17L32 9L35 17L41 11L43 22H21Z"
        fill="#FFCC1F"
        stroke="#1C1825"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Automaton head */}
      <rect x="14" y="21" width="36" height="33" rx="12" fill="#F8FAFC" stroke="#1C1825" strokeWidth="3" />
      {/* Dark faceplate */}
      <rect x="18.5" y="26.5" width="27" height="16" rx="7" fill="#1E1B4B" stroke="#1C1825" strokeWidth="2.2" />
      {/* Luminous golden optic eyes */}
      <polygon points="25.5,31.5 29,34.5 25.5,37.5 22,34.5" fill="#FFCC1F" />
      <polygon points="38.5,31.5 42,34.5 38.5,37.5 35,34.5" fill="#FFCC1F" />
      {/* Crisp grandmaster crest */}
      <path d="M27 48H37" stroke="#4F46E5" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="32" cy="48" r="2.2" fill="#FFCC1F" stroke="#1C1825" strokeWidth="1.6" />
    </svg>
  );
}

function HumanBadgeAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const spec = getHumanAvatarSpec(name);
  const { palette, animal, initials, emblem } = spec;

  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={className}>
      <rect
        x="3"
        y="3"
        width="58"
        height="58"
        rx="16"
        fill={palette.bg}
        stroke="#1C1825"
        strokeWidth="3"
      />
      <path
        d="M12 10H28"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.7"
      />
      {animal ? (
        <GuestAnimalFace
          animal={animal}
          band={palette.band}
          ink={palette.ink}
          cheek={palette.cheek}
        />
      ) : (
        <>
          <EmblemAccent emblem={emblem} color={palette.band} />
          <text
            x="32"
            y="39"
            textAnchor="middle"
            fill={palette.ink}
            fontFamily="Fredoka, Nunito, ui-rounded, sans-serif"
            fontSize="24"
            fontWeight="700"
          >
            {initials}
          </text>
        </>
      )}
    </svg>
  );
}

function EmblemAccent({
  emblem,
  color,
}: {
  emblem: "grid" | "star" | "diamond" | "clover" | "bolt" | "moon";
  color: string;
}) {
  switch (emblem) {
    case "star":
      return (
        <circle cx="48" cy="15" r="5" fill={color} stroke="#1C1825" strokeWidth="2" />
      );
    case "diamond":
      return (
        <rect
          x="45"
          y="11"
          width="8"
          height="8"
          rx="1.5"
          transform="rotate(45 49 15)"
          fill={color}
          stroke="#1C1825"
          strokeWidth="2"
        />
      );
    case "clover":
      return (
        <g fill={color}>
          <circle cx="46" cy="14" r="3" />
          <circle cx="51" cy="14" r="3" />
          <circle cx="48.5" cy="18" r="3" />
        </g>
      );
    case "bolt":
      return (
        <path
          d="M49 9L44 16H48.5L47 22L53 14.5H48.5L49 9Z"
          fill={color}
          stroke="#1C1825"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      );
    case "moon":
      return (
        <path
          d="M50 10C46.5 11 45 15 47.5 18C49 19.8 51.8 19.5 53 18.2C49.5 18 48.5 13 50 10Z"
          fill={color}
          stroke="#1C1825"
          strokeWidth="1.6"
        />
      );
    case "grid":
    default:
      return (
        <g fill={color}>
          <rect x="43" y="11" width="4" height="4" rx="1" />
          <rect x="49" y="11" width="4" height="4" rx="1" />
          <rect x="43" y="17" width="4" height="4" rx="1" />
          <rect x="49" y="17" width="4" height="4" rx="1" />
        </g>
      );
  }
}

/** Cute minimalist geometric pocket-toy face for the 10 guest animal names. */
function GuestAnimalFace({
  animal,
  band,
  ink,
  cheek,
}: {
  animal: GuestAnimal;
  band: string;
  ink: string;
  cheek: string;
}) {
  const isBird = animal === "falcon" || animal === "heron" || animal === "raven";
  const hasRoundEars =
    animal === "otter" ||
    animal === "panda" ||
    animal === "koala" ||
    animal === "badger";
  const hasPointyEars = animal === "lynx" || animal === "fox";

  return (
    <g>
      {hasRoundEars && (
        <>
          <circle
            cx="19"
            cy="22"
            r={animal === "koala" ? 8 : 6.5}
            fill={animal === "panda" ? "#1C1825" : band}
            stroke="#1C1825"
            strokeWidth="2.6"
          />
          <circle
            cx="45"
            cy="22"
            r={animal === "koala" ? 8 : 6.5}
            fill={animal === "panda" ? "#1C1825" : band}
            stroke="#1C1825"
            strokeWidth="2.6"
          />
        </>
      )}
      {hasPointyEars && (
        <>
          <path
            d="M16 30L18 14L29 22Z"
            fill={band}
            stroke="#1C1825"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
          <path
            d="M48 30L46 14L35 22Z"
            fill={band}
            stroke="#1C1825"
            strokeWidth="2.6"
            strokeLinejoin="round"
          />
        </>
      )}
      {isBird && (
        <path
          d="M27 19L32 11L37 19Z"
          fill={band}
          stroke="#1C1825"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      )}
      {/* Face base */}
      <circle
        cx="32"
        cy="36"
        r="16.5"
        fill={animal === "panda" ? "#FFFFFF" : "#FFFDF8"}
        stroke="#1C1825"
        strokeWidth="2.8"
      />
      {animal === "panda" && (
        <>
          <ellipse cx="25" cy="35" rx="4.8" ry="4" fill="#1C1825" />
          <ellipse cx="39" cy="35" rx="4.8" ry="4" fill="#1C1825" />
        </>
      )}
      {animal === "badger" && (
        <>
          <path d="M22 22L24 38" stroke="#1C1825" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M42 22L40 38" stroke="#1C1825" strokeWidth="4.5" strokeLinecap="round" />
        </>
      )}
      {/* Eyes */}
      <circle
        cx="25.5"
        cy="34.5"
        r={animal === "gecko" ? 3.8 : 2.8}
        fill={animal === "panda" ? "#FFFFFF" : "#1C1825"}
      />
      <circle
        cx="38.5"
        cy="34.5"
        r={animal === "gecko" ? 3.8 : 2.8}
        fill={animal === "panda" ? "#FFFFFF" : "#1C1825"}
      />
      {animal === "gecko" ? (
        <>
          <circle cx="25.5" cy="34.5" r="1.6" fill="#FFFFFF" />
          <circle cx="38.5" cy="34.5" r="1.6" fill="#FFFFFF" />
        </>
      ) : (
        <>
          <circle cx="24.8" cy="33.5" r="1" fill={animal === "panda" ? "#1C1825" : "#FFFFFF"} />
          <circle cx="37.8" cy="33.5" r="1" fill={animal === "panda" ? "#1C1825" : "#FFFFFF"} />
        </>
      )}
      {/* Rosy cheeks */}
      <ellipse cx="20" cy="40" rx="2.6" ry="1.6" fill={cheek} opacity="0.6" />
      <ellipse cx="44" cy="40" rx="2.6" ry="1.6" fill={cheek} opacity="0.6" />
      {/* Beak or nose/smile */}
      {isBird ? (
        <path
          d="M28.5 39L32 45L35.5 39H28.5Z"
          fill={band}
          stroke="#1C1825"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <ellipse cx="32" cy="39.5" rx={animal === "koala" ? 3.5 : 2.4} ry="2" fill={ink} />
          <path
            d="M28.5 43.5C30 45.4 34 45.4 35.5 43.5"
            stroke="#1C1825"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}
