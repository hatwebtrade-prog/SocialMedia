import type { ImageProvider } from "@/lib/image/providers";

export interface EditorialDirectionData {
  campagna?: string | null;
  periodo?: string | null;
  temi?: string | null;
  tonoVisivo?: string | null;
  daMostrare?: string | null;
  daEvitare?: string | null;
}

const PLAN_CAP_HIGGS = 200;
const PLAN_CAP_RICH = 500;

/** Formats the editorial direction and plan texts for a provider. Higgsfield gets positives only (no negations). */
export function buildEditorialImageContext(
  d: EditorialDirectionData,
  planTexts: string,
  provider: ImageProvider,
): string {
  const positives: string[] = [];
  if (d.campagna?.trim()) positives.push(`campagna ${d.campagna.trim()}`);
  if (d.periodo?.trim()) positives.push(`periodo ${d.periodo.trim()}`);
  if (d.temi?.trim()) positives.push(`temi ${d.temi.trim()}`);
  if (d.tonoVisivo?.trim()) positives.push(`tono visivo ${d.tonoVisivo.trim()}`);
  if (d.daMostrare?.trim()) positives.push(`mostra ${d.daMostrare.trim()}`);

  const planExcerpt = (cap: number): string => planTexts?.trim().slice(0, cap) ?? "";

  if (provider === "HIGGSFIELD") {
    const excerpt = planExcerpt(PLAN_CAP_HIGGS);
    const elements = [...positives, ...(excerpt ? [excerpt] : [])];
    return elements.join(", ");
  }

  // GPT / GEMINI default
  const excerpt = planExcerpt(PLAN_CAP_RICH);
  if (!positives.length && !d.daEvitare?.trim() && !excerpt) return "";
  const base = positives.length ? `Direzione editoriale Agocap: ${positives.join("; ")}.` : "";
  const avoid = d.daEvitare?.trim() ? ` Evita: ${d.daEvitare.trim()}.` : "";
  const piano = excerpt ? ` Piano editoriale: ${excerpt}.` : "";
  return `${base}${avoid}${piano}`.trim();
}
