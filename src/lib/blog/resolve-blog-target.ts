import { fetchBlogs, type ShopBlog } from "@/lib/shopify/publish";

export interface BlogTarget {
  blogId: number;
  blogHandle: string;
}

/**
 * Decide su quale blog Shopify pubblicare in automatico un articolo programmato.
 * Priorità: env `SHOPIFY_BLOG_HANDLE` → altrimenti l'unico blog esistente.
 * Con più blog e nessun handle configurato, fallisce con un messaggio esplicito.
 */
export async function resolveBlogTarget(deps?: { list?: () => Promise<ShopBlog[]> }): Promise<BlogTarget> {
  const list = deps?.list ?? fetchBlogs;
  const blogs = await list();
  if (blogs.length === 0) throw new Error("Nessun blog Shopify trovato per la pubblicazione automatica");

  const wanted = process.env.SHOPIFY_BLOG_HANDLE?.trim();
  if (wanted) {
    const b = blogs.find((x) => x.handle === wanted);
    if (!b) throw new Error(`Blog Shopify '${wanted}' (SHOPIFY_BLOG_HANDLE) non trovato tra: ${blogs.map((x) => x.handle).join(", ")}`);
    return { blogId: b.id, blogHandle: b.handle };
  }

  if (blogs.length === 1) return { blogId: blogs[0].id, blogHandle: blogs[0].handle };

  throw new Error(`Più blog Shopify disponibili (${blogs.map((x) => x.handle).join(", ")}): imposta SHOPIFY_BLOG_HANDLE nel .env per la pubblicazione automatica`);
}
