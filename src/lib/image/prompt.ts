export interface ImagePromptArgs {
  ideaCreativa: string;
  slideText?: string | null;
  hasMockup?: boolean;
}

/** Strips a leading "Slide N:" marker from slide copy, keeping the content. */
function cleanSlide(slideText?: string | null): string {
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
export function buildImagePrompt({ ideaCreativa, slideText, hasMockup }: ImagePromptArgs): string {
  const tema = cleanSlide(slideText);
  const product = hasMockup
    ? "Mantieni il prodotto IDENTICO al packaging di riferimento (stessa etichetta, forma, colori e testo) e inseriscilo in modo naturale e credibile nella scena."
    : "";
  return [
    ideaCreativa.trim(),
    tema,
    "Foto professionale di alta qualità, fotorealistica, illuminazione naturale curata, dettagli nitidi.",
    product,
  ]
    .filter((s) => s && s.trim())
    .join(" ");
}
