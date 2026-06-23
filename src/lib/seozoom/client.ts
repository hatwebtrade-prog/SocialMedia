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
