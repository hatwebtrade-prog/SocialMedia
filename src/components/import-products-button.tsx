"use client";

import { useState } from "react";

export function ImportProductsButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/products/import-shopify", { method: "POST" });
      const json = await res.json();
      setMsg(res.ok ? `Importati ${json.imported} prodotti da Shopify.` : `Errore: ${json.error ?? "sconosciuto"}`);
    } catch { setMsg("Errore di rete."); } finally { setBusy(false); }
  };
  return (
    <div className="mb-4 flex items-center gap-3 text-sm">
      <button onClick={run} disabled={busy} className="rounded-xl bg-sage-50 px-4 py-2 text-sm font-medium text-sage-700 hover:bg-sage-100 disabled:opacity-40">{busy ? "Importo…" : "Importa prodotti da Shopify"}</button>
      {msg && <span className="text-ink-soft">{msg}</span>}
    </div>
  );
}
