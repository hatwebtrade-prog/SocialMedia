import { buildArticleBodyHtml } from "@/lib/shopify/publish";

export interface BlogPublishInput { contentId: string; blogId: number; blogHandle: string; published: boolean; }

export interface BlogPublishDeps {
  loadContent: (contentId: string) => Promise<{ titoloSeo: string; corpoHtml: string; jsonLd?: string; imageBase64?: string } | null>;
  publish: (args: { blogId: number; blogHandle: string; title: string; bodyHtml: string; imageBase64?: string; published: boolean }) => Promise<{ id: number; handle: string; url: string }>;
  persistSuccess: (contentId: string, data: { shopifyArticleId: string; shopifyArticleUrl: string }) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface BlogPublishResult { status: "DONE" | "ERROR"; shopifyArticleUrl?: string; error?: string; }

export async function publishBlogContent(input: BlogPublishInput, deps: BlogPublishDeps): Promise<BlogPublishResult> {
  const content = await deps.loadContent(input.contentId);
  if (!content) return { status: "ERROR", error: "Contenuto non trovato" };
  try {
    const bodyHtml = buildArticleBodyHtml(content.corpoHtml, content.jsonLd);
    const article = await deps.publish({ blogId: input.blogId, blogHandle: input.blogHandle, title: content.titoloSeo, bodyHtml, imageBase64: content.imageBase64, published: input.published });
    await deps.persistSuccess(input.contentId, { shopifyArticleId: String(article.id), shopifyArticleUrl: article.url });
    return { status: "DONE", shopifyArticleUrl: article.url };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await deps.persistError(input.contentId, msg);
    return { status: "ERROR", error: msg };
  }
}
