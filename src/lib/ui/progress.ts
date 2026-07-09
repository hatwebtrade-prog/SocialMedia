/** Estimated progress for a long async op of unknown true duration. pct capped at 92 until done. */
export function estimatedProgress(elapsedMs: number, estimatedMs: number): { pct: number; remainingSec: number } {
  const raw = (elapsedMs / estimatedMs) * 100;
  const pct = Math.min(92, Math.max(2, raw));
  const remainingSec = Math.max(0, Math.ceil((estimatedMs - elapsedMs) / 1000));
  return { pct, remainingSec };
}
