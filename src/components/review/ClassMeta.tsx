// Single source of truth for how each classification surfaces in the
// UI — colour CSS variable, lucide icon, label, and "tag" string
// (e.g. "!!", "?"). Imported by every review component.

import {
  Sparkles,
  Star,
  Award,
  ThumbsUp,
  Check,
  BookOpen,
  HelpCircle,
  AlertTriangle,
  XCircle,
  CircleSlash,
  type LucideIcon,
} from "lucide-react";
import type { Classification } from "@/lib/review/types";

export interface ClassMeta {
  label: string;
  tag: string;          // e.g. "!!", "?!", "★"
  cssVar: string;       // e.g. "var(--cls-brilliant)"
  icon: LucideIcon;
}

export const CLASS_META: Record<Classification, ClassMeta> = {
  brilliant: {
    label: "Brilliant",
    tag: "!!",
    cssVar: "var(--cls-brilliant)",
    icon: Sparkles,
  },
  great: {
    label: "Great",
    tag: "!",
    cssVar: "var(--cls-great)",
    icon: Star,
  },
  best: {
    label: "Best",
    tag: "★",
    cssVar: "var(--cls-best)",
    icon: Award,
  },
  excellent: {
    label: "Excellent",
    tag: "",
    cssVar: "var(--cls-excellent)",
    icon: ThumbsUp,
  },
  good: {
    label: "Good",
    tag: "",
    cssVar: "var(--cls-good)",
    icon: Check,
  },
  book: {
    label: "Book",
    tag: "",
    cssVar: "var(--cls-book)",
    icon: BookOpen,
  },
  inaccuracy: {
    label: "Inaccuracy",
    tag: "?!",
    cssVar: "var(--cls-inaccuracy)",
    icon: HelpCircle,
  },
  mistake: {
    label: "Mistake",
    tag: "?",
    cssVar: "var(--cls-mistake)",
    icon: AlertTriangle,
  },
  blunder: {
    label: "Blunder",
    tag: "??",
    cssVar: "var(--cls-blunder)",
    icon: XCircle,
  },
  miss: {
    label: "Miss",
    tag: "×",
    cssVar: "var(--cls-miss)",
    icon: CircleSlash,
  },
};

/** Render order for the grid (chess.com-ish: best → worst). */
export const CLASS_ORDER: Classification[] = [
  "brilliant",
  "great",
  "best",
  "excellent",
  "good",
  "book",
  "inaccuracy",
  "mistake",
  "blunder",
  "miss",
];
