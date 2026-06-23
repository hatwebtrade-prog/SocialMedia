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
    const res = await fetch(`/api/meta/contents/${id}/image`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slideIndex }) });
    const json = await res.json();
    setBusyImg(null);
    if (res.ok) await load(); else setMsg(`Errore immagine: ${json.error ?? "sconosciuto"}`);
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

      <div className="mb-4">
        <h2 className="mb-2 font-medium">Immagine principale</h2>
        {assetFor(null) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/assets/${assetFor(null)!.id}`} alt="" className="mb-2 w-64 rounded border" />
        ) : <p className="text-sm text-neutral-500">Nessuna immagine.</p>}
        <button onClick={() => genImage(null)} disabled={busyImg === "null"} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === "null" ? "Genero…" : "Genera immagine"}</button>
      </div>

      {c.formato === "CAROSELLO" && (p.slides ?? []).map((s, idx) => (
        <div key={idx} className="mb-4 rounded border p-3">
          <p className="mb-2 text-sm font-medium">Slide {idx + 1}</p>
          <textarea className="mb-2 w-full rounded border p-2" rows={2} defaultValue={s.testo} onBlur={(e) => { const slides = [...(p.slides ?? [])]; slides[idx] = { testo: e.target.value }; patch({ payload: { ...p, slides } }); }} />
          {assetFor(idx) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/assets/${assetFor(idx)!.id}`} alt="" className="mb-2 w-48 rounded border" />
          ) : null}
          <button onClick={() => genImage(idx)} disabled={busyImg === `${idx}`} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === `${idx}` ? "Genero…" : "Genera immagine slide"}</button>
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
