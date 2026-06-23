import { buildArticleJsonLd } from "./jsonld";
import type { BlogArticle } from "./schema";
import type { BlogIdea, BlogProductInfo, BlogSeo } from "./prompt";

export interface BlogGenInput {
  ideaId: string;
}

export interface BlogClaudeResult {
  payload: BlogArticle;
  promptUsato: string;
  modello: string;
  inputTokens: number;
  outputTokens: number;
  rawOutput: unknown;
}

export interface BlogDeps {
  loadContext: (ideaId: string) => Promise<{ idea: BlogIdea; kbContext: string; prodotti: BlogProductInfo[] }>;
  loadSeoData: (idea: BlogIdea) => Promise<BlogSeo>;
  callClaude: (args: { idea: BlogIdea; kbContext: string; prodotti: BlogProductInfo[]; seo: BlogSeo }) => Promise<BlogClaudeResult>;
  generateImage: (args: { titoloSeo: string }) => Promise<{ bytes: Buffer; prompt: string }>;
  persist: (args: { input: BlogGenInput; payload: object; claude: BlogClaudeResult; image: { bytes: Buffer; prompt: string } }) => Promise<{ contentId: string }>;
}

export interface BlogGenResult {
  status: "DONE" | "ERROR";
  contentId?: string;
  error?: string;
}

export async function generateBlogArticle(input: BlogGenInput, deps: BlogDeps): Promise<BlogGenResult> {
  try {
    const { idea, kbContext, prodotti } = await deps.loadContext(input.ideaId);
    const seo = await deps.loadSeoData(idea);
    const claude = await deps.callClaude({ idea, kbContext, prodotti, seo });
    const jsonLd = buildArticleJsonLd(claude.payload);
    const payload = { ...claude.payload, jsonLd };
    const image = await deps.generateImage({ titoloSeo: claude.payload.titoloSeo });
    const { contentId } = await deps.persist({ input, payload, claude, image });
    return { status: "DONE", contentId };
  } catch (err) {
    return { status: "ERROR", error: err instanceof Error ? err.message : String(err) };
  }
}
