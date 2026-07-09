export interface SeoMetrics {
  volume: number;
  difficolta: number; // 0-100 scale (SEOZoom keyword difficulty)
}

/** Deterministic 1-5 score: volume buckets, penalised by difficulty. */
export function metricsToSeoScore({ volume, difficolta }: SeoMetrics): number {
  let base: number;
  if (volume >= 5000) base = 5;
  else if (volume >= 1000) base = 4;
  else if (volume >= 300) base = 3;
  else if (volume >= 50) base = 2;
  else base = 1;

  if (difficolta >= 70) base -= 2;
  else if (difficolta >= 40) base -= 1;

  return Math.max(1, Math.min(5, base));
}
