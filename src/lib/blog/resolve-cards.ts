import { prisma } from "@/lib/prisma";
import { fetchProductsWithMetafields } from "@/lib/shopify/products";
import { buildProductCards, type ProductRec, type ProductCards } from "./product-cards";

/**
 * Resolves the blog product cards with a hybrid source:
 * - main = the idea's linked product if set, otherwise the FIRST AI-chosen product (by handle);
 * - related = same-category active products (when the idea has a linked product), otherwise the
 *   OTHER AI-chosen products (by handle).
 * Images/urls come from the live Shopify catalog by handle. Never throws — returns empty cards on failure.
 */
export async function resolveBlogProductCards(ideaId: string, aiHandles: string[]): Promise<ProductCards> {
  try {
    const idea = await prisma.idea.findUnique({ where: { id: ideaId }, include: { product: true } });
    const ideaProduct = (idea?.product ?? null) as ProductRec | null;

    const handles = (aiHandles ?? []).filter((h): h is string => typeof h === "string" && h.length > 0);

    let main: ProductRec | null = ideaProduct;
    if (!main && handles.length) {
      main = (await prisma.product.findFirst({ where: { handle: handles[0] } })) as ProductRec | null;
    }

    let sameCategory: ProductRec[] = [];
    if (ideaProduct && main?.categoria) {
      sameCategory = (await prisma.product.findMany({
        where: { categoria: main.categoria, attivo: true, NOT: { id: main.id } },
      })) as ProductRec[];
    } else if (handles.length > 1) {
      sameCategory = (await prisma.product.findMany({ where: { handle: { in: handles.slice(1) } } })) as ProductRec[];
    }

    let shopifyByHandle: Record<string, { imageUrl: string | null; url: string }> = {};
    try {
      const prodotti = await fetchProductsWithMetafields();
      shopifyByHandle = Object.fromEntries(prodotti.map((p) => [p.handle, { imageUrl: p.imageUrl, url: p.url }]));
    } catch (err) {
      console.error("Shopify immagini prodotto non disponibili per le card:", err instanceof Error ? err.message : err);
    }

    return buildProductCards({ main, sameCategory, shopifyByHandle });
  } catch {
    return { main: null, related: [] };
  }
}
