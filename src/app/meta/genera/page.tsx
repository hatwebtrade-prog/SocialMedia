"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CONTENT_FORMATS, META_PLATFORMS } from "@/lib/meta/enums";

interface Idea { id: string; titolo: string; }

function GeneraInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [form, setForm] = useState({ ideaId: search.get("ideaId") ?? "", formato: "POST", piattaforme: ["INSTAGRAM"] as string[], numeroSlide: 5 });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=APPROVATA&destinazione=META").then((r) => r.json()).then((d) => setIdeas(Array.isArray(d) ? d : []));
  }, []);

  const togglePlatform = (p: string) =>
    setForm((f) => ({ ...f, piattaforme: f.piattaforme.includes(p) ? f.piattaforme.filter((x) => x !== p) : [...f.piattaforme, p] }));

  const submit = async () => {
    if (!form.ideaId || form.piattaforme.length === 0) { setStatus("Seleziona un'idea e almeno una piattaforma."); return; }
    setBusy(true); setStatus(null);
    const body: Record<string, unknown> = { ideaId: form.ideaId, formato: form.formato, piattaforme: form.piattaforme };
    if (form.formato === "CAROSELLO") body.numeroSlide = Number(form.numeroSlide);
    const res = await fetch("/api/meta/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json();
    setBusy(false);
    if (res.ok && json.contentId) router.push(`/meta/${json.contentId}`);
    else setStatus(`Errore: ${json.error ?? "sconosciuto"}`);
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Genera contenuto Meta</h1>
      <div className="space-y-3">
        <select className="w-full rounded border p-2" value={form.ideaId} onChange={(e) => setForm({ ...form, ideaId: e.target.value })}>
          <option value="">Scegli un'idea approvata…</option>
          {ideas.map((i) => <option key={i.id} value={i.id}>{i.titolo}</option>)}
        </select>
        <select className="w-full rounded border p-2" value={form.formato} onChange={(e) => setForm({ ...form, formato: e.target.value })}>
          {CONTENT_FORMATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="flex gap-3 text-sm">
          {META_PLATFORMS.map((p) => (
            <label key={p} className="flex items-center gap-1">
              <input type="checkbox" checked={form.piattaforme.includes(p)} onChange={() => togglePlatform(p)} />{p}
            </label>
          ))}
        </div>
        {form.formato === "CAROSELLO" && (
          <input type="number" min={3} max={10} className="w-full rounded border p-2" value={form.numeroSlide} onChange={(e) => setForm({ ...form, numeroSlide: Number(e.target.value) })} />
        )}
        <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">{busy ? "Generazione…" : "Genera"}</button>
      </div>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}

export default function GeneraPage() {
  return <Suspense><GeneraInner /></Suspense>;
}
