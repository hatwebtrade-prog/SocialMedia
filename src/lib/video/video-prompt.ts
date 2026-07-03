export interface VideoPromptInput {
  hook?: string | null;
  scriptParlato?: string | null;
  testoSchermo?: string[] | null;
  ideaCreativa?: string | null;
}

/** Builds an image→video MOTION prompt from a reel's script; the still image drives the content. */
export function buildVideoPrompt(input: VideoPromptInput): string {
  const parts = [
    input.hook?.trim(),
    input.scriptParlato?.trim(),
    (input.testoSchermo ?? []).map((t) => t.trim()).filter(Boolean).join(". "),
  ].filter((s): s is string => !!s && s.length > 0);
  const base = parts.length ? parts.join(". ") : (input.ideaCreativa ?? "").trim();
  const motion =
    "Movimento di camera fluido, naturale e premium; leggero parallasse e vita nella scena. " +
    "Il prodotto resta fedele e riconoscibile. Nessun testo o logo aggiuntivo generato nel video.";
  return `${base ? `${base}. ` : ""}${motion}`.trim();
}
