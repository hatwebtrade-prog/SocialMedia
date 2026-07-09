import { z } from "zod";
import { stripFences } from "@/lib/meta/runtime";

const profileSchema = z.object({
  palette: z.array(z.string()).default([]),
  stileFotografico: z.string().default(""),
  mood: z.string().default(""),
  elementiRicorrenti: z.string().default(""),
  daEvitare: z.string().default(""),
});

export type ParsedVisualProfile = z.infer<typeof profileSchema>;

export function parseVisualProfile(raw: string): ParsedVisualProfile {
  return profileSchema.parse(JSON.parse(stripFences(raw)));
}

export function buildVisualProfilePrompt(materiale: string): string {
  return [
    "Sei un direttore artistico. Dal materiale del brand Agocap (integratori/benessere naturale) qui sotto,",
    "estrai un'IDENTITÀ VISIVA per generare immagini coerenti.",
    "Rispondi SOLO con JSON valido: {\"palette\":[\"...\"],\"stileFotografico\":\"...\",\"mood\":\"...\",\"elementiRicorrenti\":\"...\",\"daEvitare\":\"...\"}.",
    "palette = 3-5 colori descrittivi; stileFotografico = stile/luce/camera; mood = atmosfera; elementiRicorrenti = soggetti/oggetti ricorrenti; daEvitare = cosa NON mostrare.",
    "",
    "## Materiale",
    materiale.slice(0, 12000),
  ].join("\n");
}
