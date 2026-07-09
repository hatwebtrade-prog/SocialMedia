/**
 * Scheduler interno di pubblicazione.
 * Next chiama `register()` una volta all'avvio del server (runtime Node).
 * Ogni `PUBLISH_SCHEDULER_INTERVAL_MS` (default 60s) pubblica i contenuti
 * programmati e scaduti (Meta + Blog). Nessun cron esterno richiesto.
 *
 * Disattivabile con `PUBLISH_SCHEDULER_DISABLED=1`.
 * Assume UNA sola istanza dell'app (un solo processo Node).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.PUBLISH_SCHEDULER_DISABLED === "1") return;

  // Evita doppie registrazioni (hot-reload in dev, moduli ricaricati)
  const g = globalThis as unknown as { __agocapSchedulerStarted?: boolean };
  if (g.__agocapSchedulerStarted) return;
  g.__agocapSchedulerStarted = true;

  const { runDuePublications } = await import("@/lib/publications/run-due");
  const { buildRunDueDeps } = await import("@/lib/publications/runtime");

  const intervalMs = Number(process.env.PUBLISH_SCHEDULER_INTERVAL_MS) || 60_000;
  let running = false;

  const tick = async () => {
    if (running) return; // niente giri sovrapposti
    running = true;
    try {
      const res = await runDuePublications(buildRunDueDeps());
      if (res.published.length || res.failed.length) {
        console.log(`[scheduler] pubblicati=${res.published.length} falliti=${res.failed.length}`);
      }
    } catch (e) {
      console.error("[scheduler] errore nel giro:", e instanceof Error ? e.message : e);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(tick, intervalMs);
  if (typeof timer.unref === "function") timer.unref(); // non tenere vivo il processo solo per il timer
  console.log(`[scheduler] avviato — controllo ogni ${intervalMs}ms`);

  // primo giro poco dopo il boot (non blocca l'avvio)
  setTimeout(tick, 10_000);
}
