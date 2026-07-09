export function normalizeTitle(titolo: string): string {
  return titolo
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function dedupeIdeas<T extends { titolo: string }>(
  candidates: T[],
  existingTitles: string[],
): T[] {
  const seen = new Set(existingTitles.map(normalizeTitle));
  const result: T[] = [];
  for (const c of candidates) {
    const key = normalizeTitle(c.titolo);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(c);
  }
  return result;
}
