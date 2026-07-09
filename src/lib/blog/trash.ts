export interface TrashInput { contentId: string }

export interface TrashDeps {
  loadArticleRef: (contentId: string) => Promise<{ shopifyArticleId: string | null } | null>;
  deleteShopifyArticle: (articleId: string) => Promise<{ ok: boolean; notFound: boolean }>;
  persistTrashed: (contentId: string) => Promise<void>;
  persistError: (contentId: string, error: string) => Promise<void>;
}

export interface TrashResult { status: "DONE" | "ERROR"; error?: string }

export async function trashBlogContent(input: TrashInput, deps: TrashDeps): Promise<TrashResult> {
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

  await deps.persistTrashed(input.contentId);
  return { status: "DONE" };
}
