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
