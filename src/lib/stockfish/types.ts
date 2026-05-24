/**
 * Public types for the Stockfish bot subsystem. Kept in their own file so
 * client components can import them without pulling in any Node-only
 * engine code.
 */

export type BotLevel =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "master"
  | "monster";

export type BotColorChoice = "white" | "black" | "random";

export interface BotLevelDescriptor {
  id: BotLevel;
  label: string;
  blurb: string;
  approxElo: string;
}

export const BOT_LEVELS: BotLevelDescriptor[] = [
  {
    id: "beginner",
    label: "Beginner",
    blurb: "Plays loose, makes mistakes.",
    approxElo: "≈800",
  },
  {
    id: "intermediate",
    label: "Intermediate",
    blurb: "Solid club player.",
    approxElo: "≈1500",
  },
  {
    id: "advanced",
    label: "Advanced",
    blurb: "Strong tactician.",
    approxElo: "≈2000",
  },
  {
    id: "master",
    label: "Master",
    blurb: "Full Stockfish, short think.",
    approxElo: "3000+",
  },
  {
    id: "monster",
    label: "Monster",
    blurb: "Maximum strength.",
    approxElo: "3500+",
  },
];

export function isBotLevel(value: unknown): value is BotLevel {
  return (
    value === "beginner" ||
    value === "intermediate" ||
    value === "advanced" ||
    value === "master" ||
    value === "monster"
  );
}
