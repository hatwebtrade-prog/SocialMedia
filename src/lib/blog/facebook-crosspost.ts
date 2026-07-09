/** Didascalia del post Facebook che condivide un articolo del blog. */
export function buildFacebookCaption(input: { title: string; excerpt?: string; url: string }): string {
  const parts: string[] = [input.title.trim()];
  const ex = input.excerpt?.trim();
  if (ex) parts.push(ex);
  parts.push(`👉 Leggi l'articolo completo: ${input.url}`);
  return parts.join("\n\n");
}

export interface FbArticle {
  title: string;
  excerpt?: string;
  url: string;
  image?: Buffer;
}

export interface FbCrossPostDeps {
  loadArticle: (contentId: string) => Promise<FbArticle | null>;
  publish: (args: { caption: string; image?: Buffer }) => Promise<{ postId: string }>;
}

export type FbCrossPostResult = { status: "DONE" | "SKIP" | "ERROR"; postId?: string; error?: string };

/** Ripubblica un articolo del blog come post sulla Pagina Facebook (foto + testo + link).
 *  A prova di errore: se fallisce non deve compromettere la pubblicazione su Shopify. */
export async function crossPostBlogToFacebook(contentId: string, deps: FbCrossPostDeps): Promise<FbCrossPostResult> {
  const art = await deps.loadArticle(contentId);
  if (!art || !art.url) return { status: "SKIP", error: "Articolo non ancora pubblicato su Shopify" };
  try {
    const caption = buildFacebookCaption(art);
    const r = await deps.publish({ caption, image: art.image });
    return { status: "DONE", postId: r.postId };
  } catch (e) {
    return { status: "ERROR", error: e instanceof Error ? e.message : String(e) };
  }
}
