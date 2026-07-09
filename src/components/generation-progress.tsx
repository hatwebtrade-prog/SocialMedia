"use client";

import { useEffect, useState } from "react";
import { estimatedProgress } from "@/lib/ui/progress";

/** Estimated progress bar shown while `running`; snaps to 100% briefly when it ends.
 *  The server doesn't stream real progress, so time remaining is an estimate based on `estimatedMs`. */
export function GenerationProgress({ running, estimatedMs = 60000, label = "Generazione" }: { running: boolean; estimatedMs?: number; label?: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (running) {
      setDone(false);
      setElapsed(0);
      const start = Date.now();
      const t = setInterval(() => setElapsed(Date.now() - start), 200);
      return () => clearInterval(t);
    }
    if (elapsed > 0) {
      setDone(true);
      const t = setTimeout(() => setDone(false), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  if (!running && !done) return null;
  const { pct, remainingSec } = estimatedProgress(elapsed, estimatedMs);
  const width = running ? pct : 100;
  return (
    <div className="mt-3">
      <div className="h-2 w-full overflow-hidden rounded bg-neutral-200">
        <div className="h-full rounded bg-blue-600 transition-all duration-200 ease-out" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        {running
          ? `${label} in corso… ${remainingSec > 0 ? `~${remainingSec}s rimanenti (stima)` : "ancora un attimo…"}`
          : "Completato ✓"}
      </p>
    </div>
  );
}
