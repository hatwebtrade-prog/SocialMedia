import type { ContentFormatValue, MetaPlatformValue } from "./enums";

export interface MetaPromptIdea {
  titolo: string;
  descrizione: string;
  category: string;
}

export interface MetaPromptArgs {
  kbContext: string;
  idea: MetaPromptIdea;
  formato: ContentFormatValue;
  piattaforme: MetaPlatformValue[];
  numeroSlide?: number;
}

export function buildMetaPrompt(args: MetaPromptArgs): string {
  const { kbContext, idea, formato, piattaforme, numeroSlide = 5 } = args;
  const piattaformeTxt = piattaforme.join(" e ");

  const campiPost = `- caption: testo del post (italiano), coerente col tono di voce
- ideaCreativa: descrizione del concept visivo (cosa mostrare nell'immagine)
- hashtags: array di hashtag pertinenti
- cta: call to action`;

  let campi: string;
  let forma: string;
  switch (formato) {
    case "CAROSELLO":
      campi = `${campiPost}
- slides: array di esattamente ${numeroSlide} slide, ognuna { "testo": "..." } (testo della slide)`;
      forma = `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"...","slides":[{"testo":"..."}]}`;
      break;
    case "REEL":
      campi = `${campiPost}
- hook: frase d'aggancio iniziale (primi 3 secondi)
- scriptParlato: testo parlato del reel
- testoSchermo: array di brevi testi da sovrimprimere a schermo`;
      forma = `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"...","hook":"...","scriptParlato":"...","testoSchermo":["..."]}`;
      break;
    case "STORY":
      campi = `- ideaCreativa: concept visivo della story (cosa mostrare)
- testo: testo overlay breve e diretto
- cta: call to action (es. scopri / link in bio)`;
      forma = `{"ideaCreativa":"...","testo":"...","cta":"..."}`;
      break;
    default:
      campi = campiPost;
      forma = `{"caption":"...","ideaCreativa":"...","hashtags":["..."],"cta":"..."}`;
  }

  return `Sei un social media specialist per Agocap (integratori, benessere, beauty, salute naturale).

Crea un contenuto ${formato} per ${piattaformeTxt}, partendo da questa idea approvata:
Titolo: ${idea.titolo}
Descrizione: ${idea.descrizione}
Categoria: ${idea.category}

# Knowledge base Agocap (tono di voce, prodotti)
${kbContext}

# Campi richiesti
${campi}

Rispondi esclusivamente con un oggetto JSON valido della forma ${forma}, senza testo prima o dopo, senza markdown.`;
}
