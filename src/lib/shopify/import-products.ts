import { prisma } from "@/lib/prisma";
import { fetchProductsWithMetafields, type ShopProduct } from "./products";
import { downloadAndResizeProductImage } from "./product-image";
import { shopifyCreds } from "./creds";

export interface MappedProduct {
  handle: string;
  nome: string;
  categoria: string | null;
  url: string;
  descrizione: string | null;
  ingredienti: string | null;
}

export function mapShopProductToProduct(p: ShopProduct): MappedProduct {
  return {
    handle: p.handle,
    nome: p.titolo,
    categoria: p.categoria || null,
    url: p.url,
    descrizione: p.metafields["descrizione_seo"] ?? null,
    ingredienti: p.metafields["ingredienti_dettagliati"] ?? null,
  };
}

/** Fetches Shopify products and upserts them into the local Product table (by handle). */
export async function importShopifyProducts(): Promise<{ imported: number }> {
  const { shop, token } = await shopifyCreds();
  const products = await fetchProductsWithMetafields({ shop, token });
  let imported = 0;
  for (const p of products) {
    const data = mapShopProductToProduct(p);
    const imagePath = p.imageUrl ? await downloadAndResizeProductImage(p.imageUrl, p.handle) : null;
    await prisma.product.upsert({
      where: { handle: data.handle },
      update: { nome: data.nome, categoria: data.categoria, url: data.url, descrizione: data.descrizione, ingredienti: data.ingredienti, ...(imagePath ? { imagePath } : {}) },
      create: { ...data, ...(imagePath ? { imagePath } : {}) },
    });
    imported++;
  }
  return { imported };
}
