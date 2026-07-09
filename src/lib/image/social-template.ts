export interface SocialTemplateArgs {
  variant: "MAIN" | "SECONDARY";
  influencer: boolean;
  productName?: string | null;
  hasMockup: boolean;
  accentHex?: string | null;
  copy?: { titolo: string; bullets: string[] } | null;
  brandVisual?: string | null;
  /** True when a reference image (the first slide) is provided to keep the carousel coherent. */
  coherenceRef?: boolean;
}

export function buildSocialTemplatePrompt(args: SocialTemplateArgs): string {
  const accent = args.accentHex?.trim()
    ? `Palette costruita attorno al colore del prodotto ${args.accentHex.trim()} (usalo come colore dominante di sfondo/accenti).`
    : "Palette pulita e naturale coerente col brand.";
  const person = args.influencer
    ? "Includi un influencer/persona reale, sorridente, che tiene il prodotto in mano in modo naturale (stile UGC premium)."
    : "NESSUNA persona, nessun volto.";
  const product = args.hasMockup
    ? "Usa il prodotto fornito come riferimento ESATTO del packaging: identico a etichetta, colori, logo e testo; non ridisegnarlo."
    : "Non mostrare né inventare alcun prodotto, packaging, bottiglia, barattolo, etichetta o logo inesistente: usa una composizione grafica/astratta con forme, icone e colori del brand. Nessun brand o prodotto falso.";
  // Coherence = same palette + same style family as the other slides, but a DIFFERENT composition
  // (avoids every slide looking identical / like a fixed template).
  const coherence = args.coherenceRef
    ? "Questa immagine fa parte dello STESSO carosello delle altre slide: mantieni la stessa palette e la stessa famiglia di stile fotografico/grafico e mood, MA usa una composizione, un'inquadratura e una disposizione DIVERSE — ogni slide deve spaziare e variare, NON ripetere lo stesso layout né copiare le altre."
    : "";
  const variety =
    args.variant === "MAIN"
      ? "Immagine d'apertura d'impatto, pulita e premium."
      : "Composizione originale e diversa dalle altre slide, pulita e premium.";
  const copyBlock = args.copy
    ? `Aggiungi SOLO questi testi (leggibili, italiano), senza stravolgere il concetto grafico: titolo "${args.copy.titolo}"; punti: ${args.copy.bullets.map((b) => `"${b}"`).join(", ")}.`
    : "Nessun testo, scritte o lettere nell'immagine.";
  const brand = args.brandVisual?.trim() ? `Stile visivo del brand: ${args.brandVisual.trim()}.` : "";
  return [
    "Crea un'immagine grafica premium per un post Instagram/Facebook del brand di integratori AGOCAP. Pronta da pubblicare.",
    coherence,
    args.productName ? `Prodotto: ${args.productName}.` : "",
    product,
    person,
    variety,
    accent,
    copyBlock,
    brand,
    "Genera UNA sola immagine, una sola scena: NON un collage, NON una griglia, NON slide multiple.",
    "Non inventare marchi o loghi falsi: nessun logo inventato (il logo reale sarà aggiunto a parte). Fotorealistico e pulito.",
  ]
    .filter((s) => s && s.trim())
    .join(" ");
}
