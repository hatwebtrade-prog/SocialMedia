import type { BrainstormInput } from "./prompt";
import { dedupeIdeas } from "./dedupe";
import type { IdeaDraft } from "@/lib/sources/types";
import type { KbProduct, KbItem } from "./context";

export interface ClaudeResult {
  parsed: { ideas: Array<IdeaDraft & { motivazione: string }> };
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface PersistArgs {
  status: "DONE" | "ERROR";
  input: BrainstormInput;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
  errore?: string;
  ideas: IdeaDraft[];
  sourceKey: string;
}

export interface BrainstormDeps {
  loadKb: () => Promise<{ products: KbProduct[]; knowledge: KbItem[] }>;
  loadExistingTitles: () => Promise<string[]>;
  callClaude: (args: { kb: { products: KbProduct[]; knowledge: KbItem[] }; input: BrainstormInput }) => Promise<ClaudeResult>;
  persist: (args: PersistArgs) => Promise<{ runId: string; ideas: IdeaDraft[] }>;
  sourceKey: string;
}

export interface BrainstormResult {
  status: "DONE" | "ERROR";
  created: number;
  runId?: string;
  error?: string;
}

export async function runBrainstorm(
  input: BrainstormInput,
  deps: BrainstormDeps,
): Promise<BrainstormResult> {
  // Best-effort recorder: persists an ERROR run but never throws and never
  // masks the original error if the error-run persist itself fails.
  const recordError = async (errore: string): Promise<BrainstormResult> => {
    try {
      await deps.persist({
        status: "ERROR",
        input,
        promptUsato: "",
        modello: "",
        inputTokens: 0,
        outputTokens: 0,
        rawOutput: {},
        errore,
        ideas: [],
        sourceKey: deps.sourceKey,
      });
    } catch {
      // Persisting the ERROR run failed too (e.g. DB down). Keep the original
      // error; there is nothing more we can durably record here.
    }
    return { status: "ERROR", created: 0, error: errore };
  };

  try {
    const kb = await deps.loadKb();
    const claudeResult = await deps.callClaude({ kb, input });
    if (!claudeResult?.parsed || !Array.isArray(claudeResult.parsed.ideas)) {
      throw new Error("Output AI non conforme: nessuna idea ricevuta");
    }
    const existing = await deps.loadExistingTitles();

    const drafts: IdeaDraft[] = claudeResult.parsed.ideas.map((i) => ({
      titolo: i.titolo,
      descrizione: i.descrizione,
      category: i.category,
      piattaformeConsigliate: i.piattaformeConsigliate,
      seoScore: i.seoScore,
      viralityScore: i.viralityScore,
      priority: i.priority,
      prodottoCollegato: i.prodottoCollegato,
      // `motivazione` is intentionally NOT persisted on Idea: it is a reasoning
      // artifact. The full Claude output (incl. motivazione) is retained in
      // GenerationRun.outputGrezzo for audit.
    }));
    const fresh = dedupeIdeas(drafts, existing);

    const { runId } = await deps.persist({
      status: "DONE",
      input,
      promptUsato: claudeResult.promptUsato,
      modello: claudeResult.modello,
      inputTokens: claudeResult.inputTokens,
      outputTokens: claudeResult.outputTokens,
      rawOutput: claudeResult.rawOutput,
      ideas: fresh,
      sourceKey: deps.sourceKey,
    });

    return { status: "DONE", created: fresh.length, runId };
  } catch (err) {
    return recordError(err instanceof Error ? err.message : String(err));
  }
}
