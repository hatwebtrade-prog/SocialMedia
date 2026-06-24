import type { ShopProduct } from "@/lib/shopify/products";

export interface EmailIdea {
  titolo: string;
  descrizione: string;
  category: string;
}

export interface EmailPromptArgs {
  kbContext: string;
  idea: EmailIdea;
  formato: string;
  prodotti: ShopProduct[];
}

export function buildEmailPrompt({ kbContext, idea, formato, prodotti }: EmailPromptArgs): string {
  const tono =
    formato === "PROMO_EMAIL"
      ? "email promozionale orientata alla vendita (offerta chiara, urgenza misurata, CTA forte)"
      : formato === "EDUCAZIONALE"
        ? "email educativa che porta valore sul tema (consigli pratici e affidabili, soft CTA)"
        : "newsletter informativa periodica (tono di brand, sezioni chiare)";

  const catalogo =
    formato === "PROMO_EMAIL" && prodotti.length
      ? `\n# Catalogo prodotti Agocap (scegli i pertinenti, CTA con link reali)\n` +
        prodotti
          .map((p) => {
            const mf = Object.entries(p.metafields).map(([k, v]) => `${k}: ${v}`).join("; ");
            return `- ${p.titolo} (handle ${p.handle}, url ${p.url})${mf ? ` — ${mf}` : ""}`;
          })
          .join("\n")
      : "";

  const prodottiCampo =
    formato === "PROMO_EMAIL"
      ? `- prodotti: prodotti pertinenti scelti dal catalogo {handle,titolo,url} (vuoto se nessuno; non inventarli)`
      : `- prodotti: array vuoto []`;

  return `Sei un email marketing specialist per Agocap (integratori, benessere, beauty, salute naturale).

Crea una ${tono}, partendo da questa idea approvata:
Titolo: ${idea.titolo}
Descrizione: ${idea.descrizione}
Categoria: ${idea.category}

# Knowledge base Agocap (tono di voce, prodotti)
${kbContext}
${catalogo}

# Campi richiesti
- oggetto: subject line accattivante (italiano)
- preheader: anteprima breve
- corpoHtml: corpo email in HTML semplice (paragrafi/liste; niente <html>/<head>)
- cta: call to action
${prodottiCampo}

Rispondi esclusivamente con un oggetto JSON valido della forma {"oggetto":"...","preheader":"...","corpoHtml":"...","cta":"...","prodotti":[{"handle":"...","titolo":"...","url":"..."}]}, senza testo prima o dopo, senza markdown.`;
}
