import type { ShopProduct } from "@/lib/shopify/products";

export interface BlogIdea {
  keyword: string | null;
  volumeRicerca: number | null;
  difficolta: number | null;
  titolo: string;
  descrizione: string;
  category: string;
}

export interface BlogSeo {
  keywordPrincipale: string;
  keywordSecondarie: string[];
}

// Product info passed to the prompt is exactly the Shopify read shape — alias it
// so the two stay in sync (no structural drift).
export type BlogProductInfo = ShopProduct;

export interface BlogPromptArgs {
  kbContext: string;
  idea: BlogIdea;
  prodotti: BlogProductInfo[];
  seo: BlogSeo;
}

export function buildBlogPrompt({ kbContext, idea, prodotti, seo }: BlogPromptArgs): string {
  const catalogo = prodotti.length
    ? prodotti
        .map((p) => {
          const mf = Object.entries(p.metafields)
            .map(([k, v]) => `${k}: ${v}`)
            .join("; ");
          return `- ${p.titolo} (handle ${p.handle}, url ${p.url}, categoria ${p.categoria})${mf ? ` — ${mf}` : ""}`;
        })
        .join("\n")
    : "(nessun prodotto disponibile: non inventare prodotti né link)";

  const secondarie = seo.keywordSecondarie.length
    ? `Usa anche queste keyword secondarie reali: ${seo.keywordSecondarie.join(", ")}.`
    : "Proponi tu 3-6 keyword secondarie pertinenti.";

  return `Sei un copywriter SEO esperto per Agocap (integratori, benessere, beauty, salute naturale).

# Knowledge base (tono di voce, brand)
${kbContext}

# Idea di partenza
Titolo: ${idea.titolo}
Descrizione: ${idea.descrizione}
Categoria: ${idea.category}
Keyword principale: ${seo.keywordPrincipale}${idea.volumeRicerca ? ` (volume ${idea.volumeRicerca}, difficoltà ${idea.difficolta})` : ""}
${secondarie}

# Catalogo prodotti Agocap (con metafield) — scegli SOLO i prodotti pertinenti all'argomento e usali per CTA con link reali
${catalogo}

# Compito
Scrivi un articolo per il blog ottimizzato SEO e GEO (Generative Engine Optimization). Requisiti:
- corpoHtml: HTML semantico (h2/h3, paragrafi citabili e fattuali, un blocco "punti chiave"); niente <html>/<head>, solo il contenuto dell'articolo.
- titoloSeo accattivante; metaDescription ≤ 160 caratteri.
- puntiChiave: 3-5 takeaway sintetici.
- faq: 3-5 domande/risposte reali e utili.
- prodotti: solo quelli pertinenti scelti dal catalogo (handle, titolo, url esatti dal catalogo); cta coerente. Se il catalogo è vuoto, prodotti = [] e nessun link inventato.
- Ancora tutto alla knowledge base (tono, claim prudenti e conformi).

Rispondi esclusivamente con un oggetto JSON valido di forma:
{"keywordPrincipale":"...","keywordSecondarie":["..."],"intentoRicerca":"...","titoloSeo":"...","metaDescription":"...","puntiChiave":["..."],"corpoHtml":"...","faq":[{"domanda":"...","risposta":"..."}],"cta":"...","prodotti":[{"handle":"...","titolo":"...","url":"..."}]}
senza testo prima o dopo, senza markdown.`;
}
