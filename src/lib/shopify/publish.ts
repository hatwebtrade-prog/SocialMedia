import { shopifyCreds } from "./creds";

/** Credenziali Shopify (DB con precedenza, altrimenti .env). */
async function cfg() {
  const { shop, token, version } = await shopifyCreds();
  return { shop, token, version };
}

export function buildArticleBodyHtml(corpoHtml: string, jsonLd?: string): string {
  if (!jsonLd) return corpoHtml;
  return `${corpoHtml}\n<script type="application/ld+json">${jsonLd}</script>`;
}

export interface ShopBlog { id: number; title: string; handle: string; }

export async function fetchBlogs(): Promise<ShopBlog[]> {
  const { shop, token, version } = await cfg();
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
  const { shop, token, version } = await cfg();
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
  const { shop, token, version } = await cfg();
  const query = `mutation { articleDelete(id: "gid://shopify/Article/${articleId}") { deletedArticleId userErrors { field message } } }`;
  const res = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`Shopify articleDelete HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json = await res.json();
  return classifyArticleDelete(json);
}

/** Classifies a Shopify `articleDelete` GraphQL response. Top-level GraphQL errors (e.g. the mutation
 *  not existing on the API version) are HARD failures (throw). Only an article-level `userErrors`
 *  message indicating the article is absent counts as idempotent success (`notFound: true`). */
export function classifyArticleDelete(json: unknown): { ok: boolean; notFound: boolean } {
  const j = json as { data?: { articleDelete?: { deletedArticleId?: unknown; userErrors?: { message?: string }[] } }; errors?: { message?: string }[] };
  if (Array.isArray(j?.errors) && j.errors.length > 0) {
    const msg = j.errors.map((e) => e.message).filter(Boolean).join("; ");
    throw new Error(`Shopify articleDelete: ${msg || "errore GraphQL"}`);
  }
  const payload = j?.data?.articleDelete;
  if (payload?.deletedArticleId) return { ok: true, notFound: false };
  const errs = payload?.userErrors ?? [];
  const msg = errs.map((e) => e.message).filter(Boolean).join("; ");
  if (/not found|does not exist|doesn't exist|invalid.*id|no such/i.test(msg)) return { ok: true, notFound: true };
  throw new Error(`Shopify articleDelete: ${msg || "esito sconosciuto"}`);
}
