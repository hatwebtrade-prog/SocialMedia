import type { ImageProvider } from "./providers";

export interface ImageBrief {
  soggetto?: string;
  ambientazione?: string;
  luce?: string;
  inquadratura?: string;
  mood?: string;
  formato?: "verticale" | "quadrato" | "orizzontale";
  stile?: string;
  tieneProdotto?: boolean;
  note?: string;
}

export interface PromptCtx {
  provider: ImageProvider;
  hasMockup?: boolean;
  productName?: string;
  fallback?: string;
}

const SCENE_FIELDS: (keyof ImageBrief)[] = ["soggetto", "ambientazione", "luce", "inquadratura", "mood"];

export function isBriefEmpty(b?: ImageBrief): boolean {
  if (!b) return true;
  const anyScene = SCENE_FIELDS.some((k) => typeof b[k] === "string" && (b[k] as string).trim());
  return !anyScene && !b.tieneProdotto && !(b.note && b.note.trim());
}

export function briefDimensions(formato?: ImageBrief["formato"]): { soul: string; openaiSize: "1024x1024" | "1024x1536" | "1536x1024" } {
  switch (formato) {
    case "verticale": return { soul: "1152x2048", openaiSize: "1024x1536" };
    case "orizzontale": return { soul: "2048x1152", openaiSize: "1536x1024" };
    default: return { soul: "1536x1536", openaiSize: "1024x1024" };
  }
}

export function buildImagePromptFromBrief(brief: ImageBrief, ctx: PromptCtx): string {
  const b = brief ?? {};
  const soggetto = (b.soggetto && b.soggetto.trim()) || (ctx.fallback && ctx.fallback.trim()) || "scena lifestyle del prodotto";

  if (ctx.provider === "HIGGSFIELD") {
    const holding = b.tieneProdotto ? "che tiene il prodotto" : "";
    const phrase = [soggetto, b.ambientazione, b.luce, b.inquadratura, b.mood, holding, b.note]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(", ");
    return phrase || "foto autentica e realistica";
  }

  const holding = b.tieneProdotto ? "Una persona tiene/usa il prodotto in modo naturale." : "";
  const scene = [
    `${soggetto}.`,
    b.ambientazione ? `Ambientazione: ${b.ambientazione}.` : "",
    b.luce ? `Luce: ${b.luce}.` : "",
    b.inquadratura ? `Inquadratura: ${b.inquadratura}.` : "",
    b.mood ? `Mood: ${b.mood}.` : "",
    holding,
    b.note ? `${b.note}.` : "",
  ].filter(Boolean).join(" ");
  const product = ctx.hasMockup
    ? " Mantieni il prodotto IDENTICO al packaging di riferimento (etichetta, forma, colori, testo invariati), inserito in modo naturale."
    : "";
  return `${scene} Una SINGOLA fotografia iperrealistica, indistinguibile da uno scatto reale: full-frame 50mm, luce naturale morbida, pelle e mani realistiche.${product} VIETATO nell'immagine: testo, scritte, loghi, watermark, collage, riquadri multipli, aspetto 3D/cartoon/CGI.`;
}
