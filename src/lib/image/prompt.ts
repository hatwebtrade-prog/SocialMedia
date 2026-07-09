/** Composizione da banner editoriale AGOCAP per le immagini del blog: formato orizzontale,
 *  soggetto/prodotto hero su un lato, spazio negativo pulito sull'altro (per il titolo),
 *  sfondo brand, ingredienti come props, look pubblicitario premium — persone ammesse. */
export const BLOG_BANNER_COMPOSITION =
  "Formato e composizione da BANNER EDITORIALE ORIZZONTALE in stile pubblicitario premium per un brand di integratori. " +
  "Posiziona il soggetto principale (il PRODOTTO se presente, altrimenti una persona o un elemento lifestyle a tema) con forza su UN LATO dell'inquadratura, preferibilmente a DESTRA, come hero ben visibile ed eventualmente elevato su un piano o podio elegante. " +
  "Lascia il LATO OPPOSTO (a SINISTRA) PULITO e ordinato, come ampio spazio negativo dove potrà andare un titolo: nessun elemento importante in quell'area. " +
  "Sfondo elegante a tinta piena o gradiente morbido, in un colore coerente col tema del prodotto/articolo; illuminazione da studio commerciale, resa premium, patinata e nitida. " +
  "Disponi con gusto attorno alla base alcuni ingredienti naturali e props botanici legati al tema. " +
  "Le PERSONE sono ammesse e gradite: una modella o un modello possono comparire, integrati in modo naturale e realistico (mani e pelle credibili). " +
  "Resta una SINGOLA scena coesa (non un collage) e NON inserire testo, titoli, scritte o loghi renderizzati nell'immagine.";

export interface ImagePromptArgs {
  ideaCreativa: string;
  slideText?: string | null;
  hasMockup?: boolean;
  brandVisual?: string | null;
}

/** Strips a leading "Slide N:" marker from slide copy, keeping the content. */
export function cleanSlide(slideText?: string | null): string {
  if (!slideText) return "";
  return slideText
    .replace(/slide\s*\d+\s*[:.\-–]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds the GPT image prompt from the user's creative idea used (almost) verbatim — the idea
 *  IS the prompt — plus a short high-quality photographic note. Text/titles are intentionally
 *  ALLOWED (users often want a cover/title in the image). When a mockup is selected, product-fidelity
 *  guidance keeps the packaging identical. No hard constraints: the user controls the scene. */
export function buildImagePrompt({ ideaCreativa, slideText, hasMockup, brandVisual }: ImagePromptArgs): string {
  const tema = cleanSlide(slideText);
  // For a single carousel slide, depict ONLY that slide's content. The content-level ideaCreativa
  // describes the whole carousel ("prima slide… slide centrali… ultima slide…") and, if used, makes
  // gpt-image render all the slides as a collage inside one image.
  const subject = tema
    ? `Rappresenta in questa singola immagine SOLTANTO questo concetto: ${tema}`
    : ideaCreativa.trim();
  const single =
    "Genera UNA sola immagine fotografica singola, una sola scena: NON un collage, NON una griglia, " +
    "NON più riquadri, pannelli o slide multiple dentro la stessa immagine.";
  const product = hasMockup
    ? "Mantieni il prodotto IDENTICO al packaging di riferimento (stessa etichetta, forma, colori e testo) e inseriscilo in modo naturale e credibile nella scena."
    : "Non mostrare né inventare prodotti, packaging, bottiglie, barattoli, etichette o loghi di marca inesistenti: nessun brand falso.";
  const brand = brandVisual?.trim()
    ? `Stile visivo del brand da seguire per coerenza: ${brandVisual.trim()}`
    : "";
  return [
    subject,
    single,
    "Foto professionale di alta qualità, fotorealistica, illuminazione naturale curata, dettagli nitidi.",
    product,
    brand,
  ]
    .filter((s) => s && s.trim())
    .join(" ");
}
