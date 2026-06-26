import type { ImageProvider } from "@/lib/image/providers";

export interface BrandVisualData {
  palette?: string[];
  stileFotografico?: string | null;
  mood?: string | null;
  elementiRicorrenti?: string | null;
  daEvitare?: string | null;
}

/** Formats the brand visual profile for a provider. Higgsfield gets positives only (no negations). */
export function buildBrandVisualContext(p: BrandVisualData, provider: ImageProvider): string {
  const positives: string[] = [];
  if (p.palette && p.palette.length) positives.push(`palette ${p.palette.join(", ")}`);
  if (p.stileFotografico) positives.push(`stile ${p.stileFotografico}`);
  if (p.mood) positives.push(`mood ${p.mood}`);
  if (p.elementiRicorrenti) positives.push(`elementi ${p.elementiRicorrenti}`);

  if (provider === "HIGGSFIELD") {
    return positives.join(", ");
  }
  if (positives.length === 0 && !p.daEvitare) return "";
  const base = positives.length ? `Coerenza brand Agocap: ${positives.join("; ")}.` : "";
  const avoid = p.daEvitare ? ` Evita: ${p.daEvitare}.` : "";
  return `${base}${avoid}`.trim();
}
