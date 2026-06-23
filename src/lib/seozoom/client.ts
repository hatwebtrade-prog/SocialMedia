import type { NormalizedKeyword } from "./select";

// Verified base URL from https://apidoc.seozoom.it/keywords
const SEOZOOM_BASE =
  process.env.SEOZOOM_BASE_URL ?? "https://apiv2.seozoom.com/api/v2/keywords/";

// Verified response shape from SEOZoom API v2 related endpoint (live-tested):
//   Top-level wrapper: { ResultRows, UnitsUsed, UnitsRemaining, response: [...] }
//   Per-keyword fields:
//     keyword        → "keyword"
//     volume         → "search_volume"
//     difficulty/KD  → NOT returned by `related`; only "serp_affinity" (0-100) is present
//     trend          → no single trend field; monthly breakdown only (jan, feb, …)
//                      so trend defaults to "stabile" unless a caller injects it
//   NOTE: KD field aliases are kept for test fixtures and future endpoint changes.
interface RawRow {
  keyword?: unknown;
  search_volume?: unknown;
  serp_affinity?: unknown;
  // legacy / normalizer-test aliases kept for forward-compatibility
  volume?: unknown;
  KD?: unknown;
  kd?: unknown;
  difficulty?: unknown;
  difficolta?: unknown;
  trend?: unknown;
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : fallback;
}

/** Maps SEOZoom raw rows to NormalizedKeyword. The ONLY SEOZoom-format-aware code. */
export function normalizeSeozoom(raw: unknown): NormalizedKeyword[] {
  if (!Array.isArray(raw)) return [];
  const out: NormalizedKeyword[] = [];
  for (const r of raw as RawRow[]) {
    if (!r || typeof r.keyword !== "string" || !r.keyword.trim()) continue;
    out.push({
      keyword: r.keyword.trim(),
      // API returns "search_volume"; fall back to "volume" for test fixtures / future changes
      volume: num(r.search_volume ?? r.volume, 0),
      // `related` endpoint returns no keyword difficulty (KD/difficolta) — only serp_affinity
      // (relevance), which must NOT be used as difficulty (wrong semantic).
      // Defaults to 50 (neutral) until enriched via the SEOZoom `metrics` action in a future
      // step; volume is the real ranking signal for now.
      difficolta: num(r.kd ?? r.difficulty ?? r.difficolta ?? r.KD, 50),
      // API has no single trend field (monthly breakdown only); use caller-supplied or default
      trend: typeof r.trend === "string" && r.trend.trim() ? r.trend : "stabile",
    });
  }
  return out;
}

interface MetricRow {
  keyword?: unknown;
  KD?: unknown;
  kd?: unknown;
  difficulty?: unknown;
  difficolta?: unknown;
}

/**
 * Maps SEOZoom `metrics` rows to a Map of lowercased-keyword → KD (0-100).
 * The ONLY code aware of the metrics response shape. Skips rows without a
 * keyword string or without a finite numeric KD.
 */
export function normalizeMetrics(raw: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(raw)) return map;
  for (const r of raw as MetricRow[]) {
    if (!r || typeof r.keyword !== "string" || !r.keyword.trim()) continue;
    const kdRaw = r.KD ?? r.kd ?? r.difficulty ?? r.difficolta;
    const kd = typeof kdRaw === "string" ? Number(kdRaw) : kdRaw;
    if (typeof kd !== "number" || !Number.isFinite(kd)) continue;
    map.set(r.keyword.trim().toLowerCase(), kd);
  }
  return map;
}

/**
 * Fetches real keyword difficulty (KD) for a list of keywords via the SEOZoom
 * `metrics` action. Returns a Map of lowercased-keyword → KD.
 *
 * CONFIRMED (live, 2026-06-23): the `metrics` endpoint does NOT support
 * comma-separated batches — a multi-keyword query returns {"status":400,"message":"No data found!"}.
 * Each keyword must be fetched individually. Failures per keyword are caught
 * individually so one bad keyword doesn't lose the rest.
 *
 * Rate limit: 20 req/min (documented). POOL_SIZE in discover.ts is capped at 15
 * to stay safely under that limit across the two pipeline phases.
 *
 * Response shape (verified): { ResultRows, UnitsUsed, UnitsRemaining, response: [{ keyword, KD, ... }] }
 * Difficulty field is literally "KD" (integer 0–100).
 */
export async function fetchDifficulty(keywords: string[]): Promise<Map<string, number>> {
  if (keywords.length === 0) return new Map();
  const key = process.env.SEOZOOM_API_KEY;
  if (!key) throw new Error("SEOZOOM_API_KEY mancante");
  const base = SEOZOOM_BASE.replace(/\/$/, "");
  const map = new Map<string, number>();
  await Promise.all(
    keywords.map(async (kw) => {
      try {
        const url =
          `${base}/?action=metrics&keyword=${encodeURIComponent(kw)}&db=it&api_key=${encodeURIComponent(key)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error(`SEOZoom metrics HTTP ${res.status}`);
        const json = await res.json();
        const rows = Array.isArray(json) ? json : (json?.response ?? json?.data ?? json?.keywords ?? []);
        const partial = normalizeMetrics(rows);
        for (const [k, v] of partial) map.set(k, v);
      } catch (err) {
        // One keyword failure does not lose the rest; caller (enrichDifficulty) degrades on partial results.
        console.warn(`SEOZoom metrics failed for "${kw}":`, err instanceof Error ? err.message : err);
      }
    }),
  );
  return map;
}

/**
 * Fetches related keywords for a seed term from SEOZoom and returns normalized rows.
 *
 * Auth: query-param api_key (verified from apidoc.seozoom.it)
 * Endpoint: action=related on the v2 keywords base URL
 * Rate limit: max 20 requests/min; up to 10 000 rows per response
 */
export async function fetchKeywords(seed: string): Promise<NormalizedKeyword[]> {
  const key = process.env.SEOZOOM_API_KEY;
  if (!key) throw new Error("SEOZOOM_API_KEY mancante");
  const base = SEOZOOM_BASE.replace(/\/$/, "");
  const url =
    `${base}/?action=related&keyword=${encodeURIComponent(seed)}&db=it&limit=100` +
    `&api_key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`SEOZoom HTTP ${res.status}`);
  const json = await res.json();
  // Response shape: { ResultRows, UnitsUsed, UnitsRemaining, response: [...] }
  const rows = Array.isArray(json) ? json : (json?.response ?? json?.data ?? json?.keywords ?? []);
  return normalizeSeozoom(rows);
}
