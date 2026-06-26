import { prisma } from "@/lib/prisma";

export interface KbItemLike { tipo: string; titolo: string; contenuto: string }

/** Pure merge of knowledge items + ready file texts (each file text capped at 2000 chars). */
export function toKbItems(
  items: { tipo: string; titolo: string; contenuto: string }[],
  files: { nome: string; testo: string | null }[],
): KbItemLike[] {
  const fromItems = items.map((i) => ({ tipo: i.tipo, titolo: i.titolo, contenuto: i.contenuto }));
  const fromFiles = files
    .filter((f) => f.testo && f.testo.trim())
    .map((f) => ({ tipo: "DOCUMENTO", titolo: f.nome, contenuto: (f.testo ?? "").slice(0, 2000) }));
  return [...fromItems, ...fromFiles];
}

/** Loads knowledge items + extracted file texts as KbItems for prompt context. */
export async function loadKnowledgeKbItems(): Promise<KbItemLike[]> {
  const [items, files] = await Promise.all([
    prisma.knowledgeItem.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.knowledgeFile.findMany({ where: { stato: "PRONTO", kind: "DOCUMENTO", NOT: { testo: null } }, orderBy: { createdAt: "desc" } }),
  ]);
  return toKbItems(items, files);
}
