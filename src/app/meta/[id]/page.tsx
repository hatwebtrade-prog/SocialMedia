"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

interface Asset { id: string; slideIndex: number | null; }
interface Content {
  id: string;
  formato: string;
  piattaforme: string[];
  status: string;
  dataPrevista: string | null;
  payload: { caption?: string; ideaCreativa?: string; hashtags?: string[]; cta?: string; slides?: { testo: string }[] };
  modello: string;
  idea?: { id: string; titolo: string } | null;
  assets: Asset[];
}

export default function MetaContentDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Content | null>(null);
  const [busyImg, setBusyImg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; nome: string; imagePath: string | null }[]>([]);
  const [refProductId, setRefProductId] = useState("");
  const [useMockup, setUseMockup] = useState(false);
  const [provider, setProvider] = useState("GPT");
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);

  const load = useCallback(async () => {
    const res = await fetch(`/api/meta/contents/${id}`);
    setC(await res.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const patch = async (data: Record<string, unknown>) => {
    await fetch(`/api/meta/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
    await load();
  };

  const genImage = async (slideIndex: number | null) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const res = await fetch(`/api/meta/contents/${id}/image`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex, productId: refProductId || undefined, useMockup: useMockup && !!refProductId, provider }),
    });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore immagine: ${json.error ?? "sconosciuto"}`);
  };

  const uploadImage = async (slideIndex: number | null, file: File) => {
    setBusyImg(`${slideIndex}`); setMsg(null);
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file);
    });
    const res = await fetch(`/api/meta/contents/${id}/image/upload`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slideIndex, dataUrl }),
    });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore upload: ${json.error ?? "sconosciuto"}`);
  };

  if (!c) return <p>Caricamento…</p>;
  const assetFor = (slideIndex: number | null) => c.assets.find((a) => a.slideIndex === slideIndex);
  const p = c.payload ?? {};

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{c.idea?.titolo ?? "Contenuto Meta"}</h1>
      <p className="mb-4 text-sm text-neutral-500">{c.formato} · {c.piattaforme.join(", ")}</p>

      <label className="mb-2 block text-sm">Caption</label>
      <textarea className="mb-3 w-full rounded border p-2" rows={3} defaultValue={p.caption ?? ""} onBlur={(e) => patch({ payload: { ...p, caption: e.target.value } })} />

      <label className="mb-2 block text-sm">Idea creativa (concept immagine)</label>
      <textarea className="mb-3 w-full rounded border p-2" rows={2} defaultValue={p.ideaCreativa ?? ""} onBlur={(e) => patch({ payload: { ...p, ideaCreativa: e.target.value } })} />

      <label className="mb-2 block text-sm">CTA</label>
      <input className="mb-3 w-full rounded border p-2" defaultValue={p.cta ?? ""} onBlur={(e) => patch({ payload: { ...p, cta: e.target.value } })} />

      <p className="mb-3 text-sm text-neutral-600">Hashtag: {(p.hashtags ?? []).join(" ")}</p>

      <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
        <div className="mb-2 font-medium">Immagine prodotto (mockup) per la generazione</div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded border p-1">
            <option value="GPT">GPT (OpenAI)</option>
            <option value="GEMINI">Gemini (nano banana)</option>
            <option value="HIGGSFIELD">Higgsfield</option>
            <option value="MANUAL">Caricamento manuale</option>
          </select>
          <select value={refProductId} onChange={(e) => setRefProductId(e.target.value)} className="rounded border p-1">
            <option value="">Nessun prodotto</option>
            {products.filter((p) => p.imagePath).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={useMockup} onChange={(e) => setUseMockup(e.target.checked)} disabled={!refProductId} />
            Inserisci il mockup nel contesto (image-edit)
          </label>
          {refProductId && useMockup && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/products/${refProductId}/image`} alt="" className="h-14 w-14 rounded border object-contain" />
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">Se attivo, l'immagine generata (post o slide) sarà guidata dal mockup reale del prodotto.</p>
      </div>

      <div className="mb-4">
        <h2 className="mb-2 font-medium">Immagine principale</h2>
        {assetFor(null) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/assets/${assetFor(null)!.id}`} alt="" className="mb-2 w-64 rounded border" />
        ) : <p className="text-sm text-neutral-500">Nessuna immagine.</p>}
        {provider === "MANUAL" ? (
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(null, f); }} className="text-sm" />
        ) : (
          <button onClick={() => genImage(null)} disabled={busyImg === "null"} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === "null" ? "Genero…" : "Genera immagine"}</button>
        )}
      </div>

      {c.formato === "CAROSELLO" && (p.slides ?? []).map((s, idx) => (
        <div key={idx} className="mb-4 rounded border p-3">
          <p className="mb-2 text-sm font-medium">Slide {idx + 1}</p>
          <textarea className="mb-2 w-full rounded border p-2" rows={2} defaultValue={s.testo} onBlur={(e) => { const slides = [...(p.slides ?? [])]; slides[idx] = { testo: e.target.value }; patch({ payload: { ...p, slides } }); }} />
          {assetFor(idx) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/assets/${assetFor(idx)!.id}`} alt="" className="mb-2 w-48 rounded border" />
          ) : null}
          {provider === "MANUAL" ? (
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(idx, f); }} className="text-sm" />
          ) : (
            <button onClick={() => genImage(idx)} disabled={busyImg === `${idx}`} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === `${idx}` ? "Genero…" : "Genera immagine slide"}</button>
          )}
        </div>
      ))}

      <div className="mt-4 flex items-center gap-4 text-sm">
        <label>Stato:&nbsp;
          <select value={c.status} onChange={(e) => patch({ status: e.target.value })} className="rounded border p-1">
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Data prevista:&nbsp;
          <input type="date" defaultValue={c.dataPrevista ? c.dataPrevista.slice(0, 10) : ""} onChange={(e) => patch({ dataPrevista: e.target.value ? new Date(e.target.value).toISOString() : null })} className="rounded border p-1" />
        </label>
      </div>
      {msg && <p className="mt-3 text-sm text-red-600">{msg}</p>}
      <p className="mt-4 text-xs text-neutral-400">Testo generato da {c.modello}</p>
    </div>
  );
}
