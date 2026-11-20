export const BOT_AVATAR_KEYS = [
  "pip",
  "tilly",
  "marlow",
  "juniper",
  "vega",
  "ada",
] as const;

export type BotAvatarKey = (typeof BOT_AVATAR_KEYS)[number];

export const GUEST_ANIMALS = [
  "otter",
  "falcon",
  "lynx",
  "panda",
  "heron",
  "fox",
  "badger",
  "koala",
  "raven",
  "gecko",
] as const;

export type GuestAnimal = (typeof GUEST_ANIMALS)[number];

export type ToyEmblem = "grid" | "star" | "diamond" | "clover" | "bolt" | "moon";

const EMBLEMS: readonly ToyEmblem[] = [
  "grid",
  "star",
  "diamond",
  "clover",
  "bolt",
  "moon",
];

export type AvatarPalette = {
  id: string;
  bg: string;
  band: string;
  ink: string;
  cheek: string;
};

export const HUMAN_PALETTES: readonly AvatarPalette[] = [
  { id: "sky", bg: "#BAE6FD", band: "#38BDF8", ink: "#0C4A6E", cheek: "#F472B6" },
  { id: "coral", bg: "#FED7AA", band: "#FB923C", ink: "#7C2D12", cheek: "#FB7185" },
  { id: "mint", bg: "#BBF7D0", band: "#34D399", ink: "#064E3B", cheek: "#FB7185" },
  { id: "butter", bg: "#FEF08A", band: "#FACC15", ink: "#422006", cheek: "#F97316" },
  { id: "lavender", bg: "#DDD6FE", band: "#A78BFA", ink: "#3B0764", cheek: "#F472B6" },
  { id: "berry", bg: "#FBCFE8", band: "#F472B6", ink: "#831843", cheek: "#FB923C" },
  { id: "teal", bg: "#99F6E4", band: "#2DD4BF", ink: "#134E4A", cheek: "#FB7185" },
  { id: "peach", bg: "#FECACA", band: "#F87171", ink: "#7F1D1D", cheek: "#FBBF24" },
] as const;

const BOT_NAME_SET = new Set<string>(BOT_AVATAR_KEYS);
const ANIMAL_SET = new Set<string>(GUEST_ANIMALS);

/** Stable unsigned 32-bit FNV-1a hash for deterministic avatar assignment. */
export function hashName(input: string): number {
  const normalized = input.trim().toLowerCase();
  let hash = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Matches a known Ninepop AI bot name to its custom critter avatar key. */
export function resolveBotKey(name: string): BotAvatarKey | null {
  const key = name.trim().toLowerCase();
  return BOT_NAME_SET.has(key) ? (key as BotAvatarKey) : null;
}

/** Finds a known guest animal word inside a display name (e.g. "Swift Otter"). */
export function detectGuestAnimal(name: string): GuestAnimal | null {
  const tokens = name
    .trim()
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (ANIMAL_SET.has(tokens[i])) return tokens[i] as GuestAnimal;
  }
  return null;
}

/** Extracts 1–2 crisp uppercase initials from a player display name. */
export function extractInitials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export type HumanAvatarSpec = {
  palette: AvatarPalette;
  animal: GuestAnimal | null;
  emblem: ToyEmblem;
  initials: string;
};

/** Computes a deterministic pocket-toy badge spec for any human player name. */
export function getHumanAvatarSpec(name: string): HumanAvatarSpec {
  const h = hashName(name);
  return {
    palette: HUMAN_PALETTES[h % HUMAN_PALETTES.length],
    animal: detectGuestAnimal(name),
    emblem: EMBLEMS[(h >>> 4) % EMBLEMS.length],
    initials: extractInitials(name),
  };
}
