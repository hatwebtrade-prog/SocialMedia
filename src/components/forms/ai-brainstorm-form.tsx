"use client";

import { useState, useEffect } from "react";
import { IDEA_CATEGORIES, DESTINAZIONI, type DestinazioneValue } from "@/lib/brain/enums";
import { GenerationProgress } from "@/components/generation-progress";

const DESTINAZIONE_LABEL: Record<DestinazioneValue, string> = {
  META: "Instagram / Facebook (Meta)",
  TIKTOK: "TikTok",
  BLOG: "Blog",
  EMAIL: "Email",
};

export function AiBrainstormForm() {
  const [form, setForm] = useState({ prodotto: "", categoria: "", angolo: "", keywordSeed: "", count: 5 });
  const [destinazioni, setDestinazioni] = useState<DestinazioneValue[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [products, setProducts] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);

  const toggleDestinazione = (d: DestinazioneValue) => {
    setDestinazioni((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  };

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    const body: Record<string, unknown> = { count: Number(form.count) };
    for (const k of ["prodotto", "categoria", "angolo", "keywordSeed"] as const) {
      if (form[k]) body[k] = form[k];
    }
    if (destinazioni.length) body.destinazioni = destinazioni;
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setStatus(res.ok ? `Generate ${json.created} nuove idee. Vai alla Dashboard.` : `Errore: ${json.error ?? "sconosciuto"}`);
    setBusy(false);
  };

  return (
    <div className="max-w-lg">
      <div className="space-y-3">
        <select className="w-full rounded border p-2" value={form.prodotto} onChange={(e) => setForm({ ...form, prodotto: e.target.value })}>
          <option value="">Prodotto in focus (opzionale)</option>
          {products.map((p) => <option key={p.id} value={p.nome}>{p.nome}</option>)}
        </select>
        <select className="w-full rounded border p-2" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
          <option value="">Categoria preferita (opzionale)</option>
          {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="w-full rounded border p-2" placeholder="Angolo creativo (opzionale)" value={form.angolo} onChange={(e) => setForm({ ...form, angolo: e.target.value })} />
        <input className="w-full rounded border p-2" placeholder="Keyword seed (opzionale)" value={form.keywordSeed} onChange={(e) => setForm({ ...form, keywordSeed: e.target.value })} />
        <div className="rounded border p-3">
          <span className="mb-2 block text-sm font-medium">Canali di destinazione (opzionale)</span>
          <p className="mb-2 text-xs text-neutral-500">Le idee verranno generate su misura per i canali selezionati e già assegnate ad essi.</p>
          <div className="flex flex-wrap gap-3 text-sm">
            {DESTINAZIONI.map((d) => (
              <label key={d} className="flex items-center gap-1">
                <input type="checkbox" checked={destinazioni.includes(d)} onChange={() => toggleDestinazione(d)} />
                {DESTINAZIONE_LABEL[d]}
              </label>
            ))}
          </div>
        </div>
        <input type="number" min={1} max={20} className="w-full rounded border p-2" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Generazione…" : "Genera"}</button>
        <GenerationProgress running={busy} estimatedMs={45000} label="Generazione idee" />
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
