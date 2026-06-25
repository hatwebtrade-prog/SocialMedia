export interface ImagePromptArgs {
  ideaCreativa: string;
  slideText: string | null;
  hasMockup?: boolean;
}

/** Builds a strongly photorealistic prompt for the image models. The creative idea drives the
 *  scene; the rest forces real, photographic results (camera, lighting, skin/hand realism) and,
 *  when a product mockup is provided, faithful preservation of the real packaging. */
export function buildImagePrompt({ ideaCreativa, slideText, hasMockup }: ImagePromptArgs): string {
  const base = slideText ? `${ideaCreativa}. ${slideText}` : ideaCreativa;
  const product = hasMockup
    ? "Mantieni il prodotto IDENTICO al packaging di riferimento fornito (stessa etichetta, forma, colori e testo, senza inventarne o alterarne i dettagli) e inseriscilo in modo naturale e credibile nella scena — ad esempio tenuto in mano o appoggiato — con prospettiva, scala, luce e ombre coerenti."
    : "";
  return [
    `${base}.`,
    "Fotografia iperrealistica di altissima qualità, indistinguibile da uno scatto reale: fotocamera full-frame, obiettivo 50mm f/1.8, profondità di campo naturale, messa a fuoco nitida sul soggetto, grana fotografica sottile.",
    "Illuminazione naturale morbida e professionale, bilanciamento del bianco corretto, colori fedeli; pelle realistica con texture e micro-dettagli (pori, peluria, capelli) e mani anatomicamente corrette.",
    "Stile editoriale autentico per il brand Agocap (integratori e benessere naturale): scena curata, pulita e credibile, adatta a un post social.",
    product,
    "Realismo fotografico assoluto: niente aspetto da render 3D, illustrazione, cartoon, CGI o plastica; niente deformazioni di mani o volti. Nessun testo, logo o watermark sovrimpresso.",
  ]
    .filter(Boolean)
    .join(" ");
}
