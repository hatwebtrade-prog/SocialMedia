import type { ReactNode } from "react";

export type PillTone = "neutral" | "sage" | "amber" | "green" | "sky" | "red" | "stone";

const TONE: Record<PillTone, string> = {
  neutral: "bg-sand-100 text-ink-soft",
  sage: "bg-sage-100 text-sage-700",
  amber: "bg-amber-100 text-amber-800",
  green: "bg-green-100 text-green-800",
  sky: "bg-sky-100 text-sky-800",
  red: "bg-red-100 text-red-800",
  stone: "bg-stone-200 text-stone-700",
};

export function Pill({ tone = "neutral", className = "", children }: { tone?: PillTone; className?: string; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE[tone]} ${className}`}>{children}</span>;
}
