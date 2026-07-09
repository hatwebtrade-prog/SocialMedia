import { prisma } from "@/lib/prisma";

/** Legge i valori (non vuoti) delle chiavi richieste da AppSetting. */
export async function getSettingsMap(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const rows = await prisma.appSetting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value) map[r.key] = r.value;
  return map;
}

/** Restituisce il valore di una singola chiave dal DB, con fallback su env. */
export async function getSetting(key: string, envFallback?: string): Promise<string> {
  const map = await getSettingsMap([key]);
  return map[key] || envFallback || process.env[key] || "";
}

/** Salva/aggiorna una chiave. Valore vuoto = elimina (torna al fallback env). */
export async function setSetting(key: string, value: string): Promise<void> {
  const v = value.trim();
  if (!v) {
    await prisma.appSetting.deleteMany({ where: { key } });
    return;
  }
  await prisma.appSetting.upsert({ where: { key }, create: { key, value: v }, update: { value: v } });
}
