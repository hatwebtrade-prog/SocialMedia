export interface ShopProduct {
  handle: string;
  titolo: string;
  url: string;
  categoria: string;
  metafields: Record<string, string>;
  imageUrl: string | null;
  images: string[];
}

// NOTE: GraphQL query + API version verified live (Task 12).
const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

/** Maps the Shopify Admin GraphQL products response to ShopProduct[]. The ONLY Shopify-format-aware code. */
export function normalizeProducts(raw: unknown, store: string): ShopProduct[] {
  const edges = (raw as { data?: { products?: { edges?: unknown[] } } })?.data?.products?.edges;
  if (!Array.isArray(edges)) return [];
  const out: ShopProduct[] = [];
  for (const e of edges) {
    const node = (e as { node?: Record<string, unknown> & { featuredImage?: unknown } })?.node;
    if (!node || typeof node.handle !== "string") continue;
    const metafields: Record<string, string> = {};
    const mfEdges = (node.metafields as { edges?: unknown[] })?.edges;
    if (Array.isArray(mfEdges)) {
      for (const m of mfEdges) {
        const mn = (m as { node?: { key?: unknown; value?: unknown } })?.node;
        if (mn && typeof mn.key === "string" && typeof mn.value === "string") metafields[mn.key] = mn.value;
      }
    }
    const imgEdges = (node.images as { edges?: unknown[] } | undefined)?.edges;
    const images = Array.isArray(imgEdges)
      ? imgEdges
          .map((e) => (e as { node?: { url?: unknown } })?.node?.url)
          .filter((u): u is string => typeof u === "string")
          .slice(0, 3)
      : [];
    out.push({
      handle: node.handle,
      titolo: typeof node.title === "string" ? node.title : node.handle,
      url: `${store}/products/${node.handle}`,
      categoria: typeof node.productType === "string" ? node.productType : "",
      metafields,
      imageUrl: typeof (node.featuredImage as { url?: unknown } | undefined)?.url === "string" ? (node.featuredImage as { url: string }).url : null,
      images,
    });
  }
  return out;
}

export interface ShopifyCredentials { shop: string; token: string; }

/** Fetches products + metafields from the Shopify Admin GraphQL API (read-only).
 *  Accetta credenziali esplicite (da DB/UI); in loro assenza usa le env. */
export async function fetchProductsWithMetafields(creds?: ShopifyCredentials): Promise<ShopProduct[]> {
  const shop = creds?.shop || process.env.SHOPIFY_SHOP_DOMAIN;
  const token = creds?.token || process.env.SHOPIFY_ADMIN_TOKEN;
  if (!shop || !token) throw new Error("SHOPIFY_SHOP_DOMAIN o SHOPIFY_ADMIN_TOKEN mancante");
  const url = process.env.SHOPIFY_STORE_URL ?? `https://${shop}`;
  const out: ShopProduct[] = [];
  let after: string | null = null;
  // Paginate through the full catalog (Shopify caps `first` at 250 per page). Safety cap: 40 pages.
  for (let page = 0; page < 40; page++) {
    const query = `query($after: String) { products(first: 250, after: $after) { pageInfo { hasNextPage endCursor } edges { node { handle title productType featuredImage { url } images(first: 3) { edges { node { url } } } metafields(first: 30) { edges { node { key value } } } } } } }`;
    const res: Response = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query, variables: { after } }),
    });
    if (!res.ok) throw new Error(`Shopify HTTP ${res.status}`);
    const json = await res.json();
    out.push(...normalizeProducts(json, url));
    const pageInfo = (json as { data?: { products?: { pageInfo?: { hasNextPage?: boolean; endCursor?: string | null } } } })?.data?.products?.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    after = pageInfo.endCursor;
  }
  return out;
}
