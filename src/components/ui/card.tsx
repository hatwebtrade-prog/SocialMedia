import type { HTMLAttributes } from "react";

export function Card({ interactive = false, className = "", ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  const base = "rounded-2xl border border-sand-200 bg-surface shadow-soft";
  const hover = interactive ? "transition hover:-translate-y-0.5 hover:shadow-lift" : "";
  return <div className={`${base} ${hover} ${className}`} {...props} />;
}
