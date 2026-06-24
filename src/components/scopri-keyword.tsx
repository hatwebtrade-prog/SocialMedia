"use client";

import { useEffect, useState } from "react";

interface Product { id: string; nome: string; }

export function ScopriKeyword() {
  const [products, setProducts] = useState<Product[]>([]);
  const [seedsText, setSeedsText] = useState("");
  const [productId, setProductId] = useState("");
  const [topN, setTopN] = useState(12);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([]));
  }, []);

  const submit = async () => {
    const seeds = seedsText.split(",").map((x) => x.trim()).filter(Boolean);
    if (seeds.length === 0 && !productId) { setStatus("Inserisci almeno un seed oppure scegli un prodotto."); return; }
    const num = Number(topN);
    if (!Number.isInteger(num) || num < 1 || num > 30) { setStatus("Numero risultati non valido (1-30)."); return; }
    setBusy(true); setStatus(null);
    try {
      const body: Record<string, unknown> = { topN: num };
      if (seeds.length > 0) body.seeds = seeds;
      if (productId) body.productId = productId;
      const res = await fetch("/api/seozoom/discover", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      setStatus(res.ok ? `Create ${json.created} idee da SEOZoom. Vai alla Dashboard Idee.` : `Errore: ${json.error ?? "sconosciuto"}`);
    } catch {
      setStatus("Errore di rete durante la scoperta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg">
      <div className="space-y-3">
        <input className="w-full rounded border p-2" placeholder="Seed liberi separati da virgola (es. magnesio, sonno)" value={seedsText} onChange={(e) => setSeedsText(e.target.value)} />
        <div className="text-sm text-neutral-500">oppure parti da un prodotto:</div>
        <select className="w-full rounded border p-2" value={productId} onChange={(e) => setProductId(e.target.value)}>
          <option value="">Nessun prodotto</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <input type="number" min={1} max={30} className="w-full rounded border p-2" value={topN} onChange={(e) => setTopN(Number(e.target.value))} />
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Scopro…" : "Scopri"}</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
