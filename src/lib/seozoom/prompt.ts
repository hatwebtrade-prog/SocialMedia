import type { NormalizedKeyword } from "./select";

export interface ShapingPromptArgs {
  kbContext: string;
  prodottoNome?: string;
  candidates: NormalizedKeyword[];
}

export function buildShapingPrompt({ kbContext, prodottoNome, candidates }: ShapingPromptArgs): string {
  const lista = candidates
    .map((c) => `- "${c.keyword}" (volume ${c.volume}, difficoltà ${c.difficolta}, trend ${c.trend})`)
    .join("\n");

  return `Sei un esperto di content marketing SEO per Agocap (integratori, benessere, beauty, salute naturale).

Hai questa lista di keyword reali (con metriche da SEOZoom)${prodottoNome ? `, in relazione al prodotto ${prodottoNome}` : ""}:
${lista}

# Knowledge base Agocap (tono di voce, prodotti)
${kbContext}

# Compito
Per OGNI keyword qui sopra, proponi un'idea di contenuto ancorata alla knowledge base. Per ognuna fornisci:
- keyword: la keyword esatta da cui parti (ripetila identica)
- titolo: titolo accattivante in italiano
- descrizione: 1-2 frasi sul contenuto
- category: una tra INTEGRATORI, BEAUTY, BENESSERE, STAGIONALITA, EDUCATIONAL, VENDITA, FAQ, TREND
- piattaformeConsigliate: una o più tra INSTAGRAM, FACEBOOK, TIKTOK, BLOG
- motivazione: perché è rilevante per il target Agocap

Non assegnare punteggi: pensa solo al contenuto.
Rispondi esclusivamente con un oggetto JSON valido della forma {"ideas":[{"keyword":"...","titolo":"...","descrizione":"...","category":"...","piattaformeConsigliate":["..."],"motivazione":"..."}]}, senza testo prima o dopo, senza markdown.`;
}
