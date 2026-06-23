export interface BrainstormInput {
  prodotto?: string;
  categoria?: string;
  angolo?: string;
  keywordSeed?: string;
  count: number;
}

export function buildBrainstormPrompt(args: {
  kbContext: string;
  input: BrainstormInput;
}): string {
  const { kbContext, input } = args;
  const richieste: string[] = [];
  if (input.prodotto) richieste.push(`Prodotto in focus: ${input.prodotto}`);
  if (input.categoria) richieste.push(`Categoria preferita: ${input.categoria}`);
  if (input.angolo) richieste.push(`Angolo creativo: ${input.angolo}`);
  if (input.keywordSeed) richieste.push(`Keyword seed: ${input.keywordSeed}`);

  return `Sei un esperto di content marketing per Agocap, brand di integratori, benessere, beauty e salute naturale.

Genera esattamente ${input.count} idee di contenuto, ancorate alla knowledge base aziendale qui sotto.

# Knowledge base Agocap
${kbContext}

# Richieste
${richieste.length ? richieste.join("\n") : "Nessuna preferenza specifica: spazia liberamente."}

# Angoli editoriali da considerare
Usa un mix di questi angoli quando pertinenti: educational, soft selling, vendita diretta,
FAQ degli utenti, stagionalità, combinazione prodotto × problema reale del target,
hook virali per reel/TikTok, rubriche editoriali, contenuti di trend.

# Per ogni idea fornisci
- titolo: breve e accattivante (italiano)
- descrizione: 1-2 frasi sul contenuto
- category: una tra INTEGRATORI, BEAUTY, BENESSERE, STAGIONALITA, EDUCATIONAL, VENDITA, FAQ, TREND
- piattaformeConsigliate: una o più tra INSTAGRAM, FACEBOOK, TIKTOK, BLOG
- seoScore, viralityScore, priority: interi da 1 a 5
- prodottoCollegato: il nome del prodotto Agocap collegato, oppure null
- motivazione: perché l'idea è rilevante per il target Agocap`;
}
