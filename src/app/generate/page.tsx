"use client";

import { useState } from "react";
import { IDEA_CATEGORIES } from "@/lib/brain/enums";

export default function GeneratePage() {
  const [form, setForm] = useState({ prodotto: "", categoria: "", angolo: "", keywordSeed: "", count: 5 });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setStatus(null);
    const body: Record<string, unknown> = { count: Number(form.count) };
    for (const k of ["prodotto", "categoria", "angolo", "keywordSeed"] as const) {
      if (form[k]) body[k] = form[k];
    }
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
      <h1 className="mb-4 text-2xl font-semibold">Genera Idee (Superpower Brainstorming)</h1>
      <div className="space-y-3">
        <input className="w-full rounded border p-2" placeholder="Prodotto in focus (opzionale)" value={form.prodotto} onChange={(e) => setForm({ ...form, prodotto: e.target.value })} />
        <select className="w-full rounded border p-2" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
          <option value="">Categoria preferita (opzionale)</option>
          {IDEA_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="w-full rounded border p-2" placeholder="Angolo creativo (opzionale)" value={form.angolo} onChange={(e) => setForm({ ...form, angolo: e.target.value })} />
        <input className="w-full rounded border p-2" placeholder="Keyword seed (opzionale)" value={form.keywordSeed} onChange={(e) => setForm({ ...form, keywordSeed: e.target.value })} />
        <input type="number" min={1} max={20} className="w-full rounded border p-2" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Generazione…" : "Genera"}</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}
