export interface ImagePromptArgs {
  ideaCreativa: string;
  slideText?: string | null;
  hasMockup?: boolean;
}

/** Turns a slide's editorial copy into a short, non-rendered theme phrase (strips "Slide N:" etc.). */
function temaSlide(slideText?: string | null): string {
  if (!slideText) return "";
  const cleaned = slideText
    .replace(/slide\s*\d+\s*[:.\-–]?\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ").slice(0, 14).join(" ");
}

/** Builds a concise, strongly photorealistic prompt for a SINGLE photo. The creative idea is the
 *  scene; the slide copy is passed only as an unrendered theme. Forbids text/collage/slide layouts
 *  (which low-instruction models like Higgsfield Soul otherwise produce) and keeps the real product. */
export function buildImagePrompt({ ideaCreativa, slideText, hasMockup }: ImagePromptArgs): string {
  const tema = temaSlide(slideText);
  const scene = tema ? `${ideaCreativa}. Tema da illustrare con la scena: ${tema}.` : `${ideaCreativa}.`;
  const product = hasMockup
    ? "Includi il prodotto reale mantenendolo IDENTICO al packaging di riferimento (stessa etichetta, forma, colori e testo, senza alterarlo) e inseriscilo in modo naturale e credibile nella scena, ad esempio tenuto in mano, con luce, scala e ombre coerenti."
    : "";
  return [
    scene,
    "Una SINGOLA fotografia iperrealistica, indistinguibile da uno scatto reale: fotocamera full-frame, obiettivo 50mm, luce naturale morbida, messa a fuoco nitida, pelle e mani realistiche con dettagli naturali.",
    product,
    "VIETATO nell'immagine: qualsiasi testo, lettera, scritta, didascalia, logo o watermark; collage, griglie, riquadri multipli o slide affiancate; aspetto 3D, render, cartoon, CGI o plastica.",
  ]
    .filter(Boolean)
    .join(" ");
}
