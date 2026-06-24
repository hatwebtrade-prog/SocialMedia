/** Parses the Google Suggest (client=firefox) response: [query, [suggestion, ...], ...]. */
export function normalizeSuggest(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length < 2 || !Array.isArray(raw[1])) return [];
  return (raw[1] as unknown[]).filter((x): x is string => typeof x === "string");
}

/** Best-effort related queries from Google Suggest (autocomplete). Degrades to [] on any error. */
export async function fetchGoogleRelated(seed: string): Promise<string[]> {
  if (!seed || !seed.trim()) return [];
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=it&q=${encodeURIComponent(seed)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = await res.json();
    return normalizeSuggest(json);
  } catch {
    return [];
  }
}
