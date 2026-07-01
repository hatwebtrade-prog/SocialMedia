export interface RetireInput { contentId: string }

export interface RetireDeps {
  loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>;
  deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>;
  persistRetired: (contentId: string) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface RetireResult { status: "DONE" | "ERROR"; error?: string }

export async function retireBlogContent(input: RetireInput, deps: RetireDeps): Promise<RetireResult> {
  const ref = await deps.loadArticleRef(input.contentId);
  if (!ref) return { status: "ERROR", error: "Contenuto non trovato" };

  if (ref.shopifyArticleId) {
    try {
      await deps.deleteShopifyArticle(ref.shopifyArticleId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await deps.persistError(input.contentId, msg);
      return { status: "ERROR", error: msg };
    }
  }

  await deps.persistRetired(input.contentId);
  return { status: "DONE" };
}
