import { runDuePublications } from "./run-due";
import { buildRunDueDeps } from "./runtime";

/**
 * Avvia lo scheduler di pubblicazione (solo runtime Node, una sola volta).
 * Ogni `PUBLISH_SCHEDULER_INTERVAL_MS` (default 60s) pubblica i contenuti
 * programmati e scaduti su Meta + Blog. Disattivabile con `PUBLISH_SCHEDULER_DISABLED=1`.
 * Assume UNA sola istanza dell'app (un solo processo Node).
 */
export function startScheduler(): void {
  if (process.env.PUBLISH_SCHEDULER_DISABLED === "1") return;

  const g = globalThis as unknown as { __agocapSchedulerStarted?: boolean };
  if (g.__agocapSchedulerStarted) return;
  g.__agocapSchedulerStarted = true;

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
