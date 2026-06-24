import type { EmailPayload } from "./schema";
import type { EmailIdea } from "./prompt";
import type { ShopProduct } from "@/lib/shopify/products";

export interface EmailGenInput { ideaId: string; formato: string; }

export interface EmailClaudeResult {
  payload: EmailPayload;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface EmailDeps {
  loadContext: (input: EmailGenInput) => Promise<{ idea: EmailIdea; kbContext: string; prodotti: ShopProduct[] }>;
  callClaude: (args: { idea: EmailIdea; kbContext: string; formato: string; prodotti: ShopProduct[] }) => Promise<EmailClaudeResult>;
  persist: (args: { input: EmailGenInput; result: EmailClaudeResult }) => Promise<{ contentId: string }>;
}

export interface EmailGenResult { status: "DONE" | "ERROR"; contentId?: string; error?: string; }

export async function generateEmail(input: EmailGenInput, deps: EmailDeps): Promise<EmailGenResult> {
  try {
    const { idea, kbContext, prodotti } = await deps.loadContext(input);
    const result = await deps.callClaude({ idea, kbContext, formato: input.formato, prodotti });
    const { contentId } = await deps.persist({ input, result });
    return { status: "DONE", contentId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
