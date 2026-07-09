/**
 * Next chiama `register()` all'avvio del server. Lo scheduler di pubblicazione
 * è codice solo-Node (usa Prisma/sharp): va importato SOLO nel runtime nodejs,
 * dentro il blocco `if (NEXT_RUNTIME === 'nodejs')` — così il bundler edge non
 * prova a includere le dipendenze native (evita "Can't resolve 'child_process'").
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/lib/publications/scheduler");
    startScheduler();
  }
}
