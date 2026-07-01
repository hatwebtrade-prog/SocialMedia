const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

function cfg() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_TOKEN;
  if (!shop || !token) throw new Error("SHOPIFY_SHOP_DOMAIN o SHOPIFY_ADMIN_TOKEN mancante");
  return { shop, token, version: API_VERSION };
}

export function buildArticleBodyHtml(corpoHtml: string, jsonLd?: string): string {
  if (!jsonLd) return corpoHtml;
  return `${corpoHtml}\n<script type="application/ld+json">${jsonLd}</script>`;
}

export interface ShopBlog { id: number; title: string; handle: string; }

export async function fetchBlogs(): Promise<ShopBlog[]> {
  const { shop, token, version } = cfg();
  const res = await fetch(`https://${shop}/admin/api/${version}/blogs.json`, {
    headers: { "X-Shopify-Access-Token": token, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Shopify blogs HTTP ${res.status}`);
  const json = await res.json();
  return (json?.blogs ?? []).map((b: { id: number; title: string; handle: string }) => ({ id: b.id, title: b.title, handle: b.handle }));
}

export interface PublishArticleArgs {
  blogId: number;
  title: string;
  bodyHtml: string;
  tags?: string;
  imageBase64?: string;
  published: boolean;
}

export async function publishArticle(args: PublishArticleArgs): Promise<{ id: number; handle: string }> {
  const { shop, token, version } = cfg();
  const article: Record<string, unknown> = { title: args.title, body_html: args.bodyHtml, published: args.published };
  if (args.tags) article.tags = args.tags;
  if (args.imageBase64) article.image = { attachment: args.imageBase64 };
  const res = await fetch(`https://${shop}/admin/api/${version}/blogs/${args.blogId}/articles.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ article }),
  });
  if (!res.ok) throw new Error(`Shopify article HTTP ${res.status}: ${await res.text().catch(() => "")}`);
  const json = await res.json();
  return { id: json.article.id, handle: json.article.handle };
}

/** Deletes a published article on Shopify via the Admin GraphQL `articleDelete` mutation.
 *  Returns `{ ok, notFound }`; an already-absent article resolves to `{ ok: true, notFound: true }`. */
export async function deleteArticle(articleId: string): Promise<{ ok: boolean; notFound: boolean }> {
  const { shop, token, version } = cfg();
  const query = `mutation { articleDelete(id: "gid://shopify/Article/${articleId}") { deletedArticleId userErrors { field message } } }`;
  const res = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shopify articleDelete HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json = await res.json();
  const payload = json?.data?.articleDelete;
  if (payload?.deletedArticleId) return { ok: true, notFound: false };
  const errs: { message?: string }[] = payload?.userErrors ?? json?.errors ?? [];
  const msg = errs.map((e) => e.message).filter(Boolean).join("; ");
  if (/not found|does not exist|doesn't exist|invalid.*id|no such/i.test(msg)) return { ok: true, notFound: true };
  throw new Error(`Shopify articleDelete: ${msg || "esito sconosciuto"}`);
}
