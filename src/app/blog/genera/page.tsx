"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GenerationProgress } from "@/components/generation-progress";

interface Idea { id: string; titolo: string; }

function BlogGeneraInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [ideaId, setIdeaId] = useState(search.get("ideaId") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ideas?status=APPROVATA&destinazione=BLOG").then((r) => r.json()).then((d) => setIdeas(Array.isArray(d) ? d : [])).catch(() => setIdeas([]));
  }, []);

  const submit = async () => {
    if (!ideaId) { setError("Scegli un'idea approvata."); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/blog/generate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ideaId }) });
      const json = await res.json();
      if (res.ok && json.contentId) router.push(`/blog/${json.contentId}`);
      else setError(`Errore: ${json.error ?? "sconosciuto"}`);
    } catch {
      setError("Errore di rete durante la generazione.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-semibold">Genera articolo blog</h1>
      <select className="mb-3 w-full rounded border p-2" value={ideaId} onChange={(e) => setIdeaId(e.target.value)}>
        <option value="">Scegli un'idea approvata…</option>
        {ideas.map((i) => <option key={i.id} value={i.id}>{i.titolo}</option>)}
      </select>
      <button onClick={submit} disabled={busy} className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-40">
        {busy ? "Genero… (può richiedere ~1 min)" : "Genera"}
      </button>
      <GenerationProgress running={busy} estimatedMs={150000} label="Generazione articolo" />
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function BlogGeneraPage() {
  return <Suspense><BlogGeneraInner /></Suspense>;
}
