import { selectCandidates, type NormalizedKeyword } from "./select";
import type { ShapingOutput } from "./schema";

export interface DiscoverInput {
  seeds?: string[];
  productId?: string;
  categoria?: string;
  topN?: number;
}

export interface ShapingResult extends ShapingOutput {
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface SeozoomDeps {
  loadContext: (input: DiscoverInput) => Promise<{ seeds: string[]; kbContext: string; prodottoNome?: string }>;
  fetchKeywords: (seed: string) => Promise<NormalizedKeyword[]>;
  enrichDifficulty: (keywords: NormalizedKeyword[]) => Promise<NormalizedKeyword[]>;
  callClaude: (args: { kbContext: string; prodottoNome?: string; candidates: NormalizedKeyword[] }) => Promise<ShapingResult>;
  persist: (args: { input: DiscoverInput; candidates: NormalizedKeyword[]; claudeResult: ShapingResult }) => Promise<{ runId: string; created: number }>;
  recordError: (input: DiscoverInput, message: string) => Promise<void>;
}

export interface DiscoverResult {
  status: "DONE" | "ERROR";
  created: number;
  runId?: string;
  error?: string;
}

export async function discoverKeywords(input: DiscoverInput, deps: SeozoomDeps): Promise<DiscoverResult> {
  try {
    const { seeds, kbContext, prodottoNome } = await deps.loadContext(input);
    const fetched = (await Promise.all(seeds.map((s) => deps.fetchKeywords(s)))).flat();

    const POOL_SIZE = 40;
    const pool = selectCandidates(fetched, { topN: POOL_SIZE });
    if (pool.length === 0) throw new Error("Nessuna keyword trovata da SEOZoom per i seed indicati");

    const enriched = await deps.enrichDifficulty(pool);
    const candidates = selectCandidates(enriched, { topN: input.topN ?? 12 });

    const claudeResult = await deps.callClaude({ kbContext, prodottoNome, candidates });
    const { runId, created } = await deps.persist({ input, candidates, claudeResult });
    return { status: "DONE", created, runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await deps.recordError(input, message);
    } catch {
      // recording the error run failed too; keep the original error
    }
    return { status: "ERROR", created: 0, error: message };
  }
}
