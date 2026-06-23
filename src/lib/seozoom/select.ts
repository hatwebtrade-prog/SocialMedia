export interface NormalizedKeyword {
  keyword: string;
  volume: number;
  difficolta: number;
  trend: string;
}

function isRising(trend: string): boolean {
  return /cresc|salit|rising|up|\+/i.test(trend);
}

function opportunity(k: NormalizedKeyword): number {
  const trendBonus = isRising(k.trend) ? 1.2 : 1;
  return (k.volume / (1 + k.difficolta)) * trendBonus;
}

export function selectCandidates(
  keywords: NormalizedKeyword[],
  { topN = 12 }: { topN?: number } = {},
): NormalizedKeyword[] {
  return keywords
    .filter((k) => k.volume > 0)
    .sort((a, b) => opportunity(b) - opportunity(a))
    .slice(0, topN);
}
