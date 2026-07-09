"use client";

import { useState, useEffect } from "react";
import { IDEA_CATEGORIES, PLATFORMS } from "@/lib/brain/enums";

export function ManualIdeaForm() {
  const [form, setForm] = useState({ titolo: "", descrizione: "", category: "TREND", piattaformeConsigliate: [] as string[], productId: "" });
  const [status, setStatus] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);

  const togglePlatform = (p: string) => {
    setForm((f) => ({
      ...f,
      piattaformeConsigliate: f.piattaformeConsigliate.includes(p)
        ? f.piattaformeConsigliate.filter((x) => x !== p)
        : [...f.piattaformeConsigliate, p],
    }));
  };

  const submit = async () => {
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, productId: form.productId || undefined }),
    });
    setStatus(res.ok ? "Idea creata." : "Errore nella creazione.");
    if (res.ok) setForm({ titolo: "", descrizione: "", category: "TREND", piattaformeConsigliate: [], productId: "" });
  };

  return (
    <div className="max-w-lg">
      <div className="space-y-3">
        <input className="w-full rounded border p-2" placeholder="Titolo" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
        <textarea className="w-full rounded border p-2" placeholder="Descrizione" value={form.descrizione} onChange={(e) => setForm({ ...form, descrizione: e.target.value })} />
        <select className="w-full rounded border p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="w-full rounded border p-2" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
          <option value="">Prodotto collegato (opzionale)</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
        <div className="flex flex-wrap gap-3 text-sm">
          {PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input type="checkbox" checked={form.piattaformeConsigliate.includes(p)} onChange={() => togglePlatform(p)} />{p}
            </label>
          ))}
        </div>
        <button onClick={submit} className="rounded bg-blue-600 px-4 py-2 text-white">Salva</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
