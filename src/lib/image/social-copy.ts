import { z } from "zod";

export const socialCopySchema = z.object({
  titolo: z.string().min(1),
  bullets: z.array(z.string().min(1)).transform((b) => b.slice(0, 3)),
});
export type SocialCopy = z.infer<typeof socialCopySchema>;

/** Prompt for Claude to synthesize very short in-image copy (title + up to 3 bullets), in Italian. */
export function buildSocialCopyPrompt(args: { titoloIdea: string; testo: string; productName?: string | null }): string {
  return `Sei un copywriter per social. Genera testi BREVISSIMI in ITALIANO da inserire in un'immagine social.
Idea: ${args.titoloIdea}
Contenuto: ${args.testo}
${args.productName ? `Prodotto: ${args.productName}` : ""}
Regole: 1 "titolo" di massimo 5 parole; "bullets" = massimo 3 voci, ognuna 2-4 parole, concrete e leggibili.
Nessun claim medico, nessun competitor. Rispondi SOLO con JSON: {"titolo":"...","bullets":["...","...","..."]}`;
}
