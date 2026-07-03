"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { CONTENT_STATUSES } from "@/lib/meta/enums";
import { ImageBriefForm, type Brief } from "@/components/image-brief";
import { ProductMockupPicker, type ProductMockupValue } from "@/components/product-mockup-picker";
import { MetaPublishButton } from "@/components/meta-publish-button";
import { LogoUploader } from "@/components/logo-uploader";

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
  publicationStatus?: string;
  publicationError?: string | null;
  facebookPostId?: string | null;
  instagramPostId?: string | null;
}

export default function MetaContentDetail() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<Content | null>(null);
  const [busyImg, setBusyImg] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [products, setProducts] = useState<{ id: string; nome: string; imagePath: string | null }[]>([]);
  const [provider, setProvider] = useState("GPT");
  const [brief, setBrief] = useState<Brief>({});
  const [archetype, setArchetype] = useState<"UGC" | "ADV" | "PRODUCT_HERO">("ADV");
  const [headline, setHeadline] = useState("");
  const [perImage, setPerImage] = useState<Record<string, ProductMockupValue>>({});
  const ideaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);

  const keyFor = (slideIndex: number | null) => (slideIndex === null ? "post" : String(slideIndex));
  const valueFor = (slideIndex: number | null): ProductMockupValue => perImage[keyFor(slideIndex)] ?? { productId: "", useMockup: false };
  const setValueFor = (slideIndex: number | null, next: ProductMockupValue) => setPerImage((prev) => ({ ...prev, [keyFor(slideIndex)]: next }));

  const [imgOpts, setImgOpts] = useState<Record<string, { includiDescrizione: boolean; includiLogo: boolean; influencer: boolean }>>({});
  const optsFor = (slideIndex: number | null) => imgOpts[keyFor(slideIndex)] ?? { includiDescrizione: false, includiLogo: false, influencer: false };
  const setOptsFor = (slideIndex: number | null, patchObj: Partial<{ includiDescrizione: boolean; includiLogo: boolean; influencer: boolean }>) =>
    setImgOpts((m) => ({ ...m, [keyFor(slideIndex)]: { ...optsFor(slideIndex), ...patchObj } }));

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
    const v = valueFor(slideIndex);
    const res = await fetch(`/api/meta/contents/${id}/image`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slideIndex, productId: v.productId || undefined, useMockup: v.useMockup && !!v.productId, provider, brief, styleId: brief.stile, ideaCreativa: ideaRef.current?.value ?? undefined, archetype, headline: headline.trim() || undefined,
        includiDescrizione: optsFor(slideIndex).includiDescrizione,
        includiLogo: optsFor(slideIndex).includiLogo,
        influencer: optsFor(slideIndex).influencer,
      }),
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

      <label className="mb-2 block text-sm">Idea creativa = prompt immagine (testo/titoli inclusi nell&apos;immagine)</label>
      <textarea ref={ideaRef} className="mb-3 w-full rounded border p-2" rows={2} defaultValue={p.ideaCreativa ?? ""} onBlur={(e) => patch({ payload: { ...p, ideaCreativa: e.target.value } })} />

      <label className="mb-2 block text-sm">CTA</label>
      <input className="mb-3 w-full rounded border p-2" defaultValue={p.cta ?? ""} onBlur={(e) => patch({ payload: { ...p, cta: e.target.value } })} />

      <p className="mb-3 text-sm text-neutral-600">Hashtag: {(p.hashtags ?? []).join(" ")}</p>

      <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
        <div className="mb-2 font-medium">Generatore immagini (provider + brief)</div>
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded border p-1">
            <option value="GPT">GPT (OpenAI)</option>
            <option value="GEMINI">Gemini (nano banana)</option>
            <option value="HIGGSFIELD">Higgsfield</option>
            <option value="MANUAL">Caricamento manuale</option>
          </select>
        </div>
        <div className="mt-2"><LogoUploader /></div>
        {provider === "GPT" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs text-neutral-600">Stile immagine:</span>
            {([
              { k: "UGC", label: "UGC realistico" },
              { k: "ADV", label: "ADV premium" },
              { k: "PRODUCT_HERO", label: "Product Hero" },
            ] as const).map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setArchetype(o.k)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${archetype === o.k ? "border-sage-500 bg-sage-100 text-sage-700" : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"}`}
              >
                {o.label}
              </button>
            ))}
            {archetype === "ADV" && (
              <input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Headline breve (max 5 parole, opzionale)"
                className="ml-1 min-w-[16rem] flex-1 rounded border p-1 text-xs"
              />
            )}
          </div>
        )}
        <p className="mt-1 text-xs text-neutral-500">Provider e brief valgono per tutte le immagini. Il prodotto si sceglie per singola immagine qui sotto.</p>
        <ImageBriefForm provider={provider} value={brief} onChange={setBrief} />
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
          <>
            <div className="mb-2"><ProductMockupPicker products={products} value={valueFor(null)} onChange={(v) => setValueFor(null, v)} /></div>
            <div className="mb-2 flex flex-wrap gap-3 text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(null).includiDescrizione} onChange={(e) => setOptsFor(null, { includiDescrizione: e.target.checked })} /> Includi descrizione</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(null).includiLogo} onChange={(e) => setOptsFor(null, { includiLogo: e.target.checked })} /> Includi logo</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(null).influencer} onChange={(e) => setOptsFor(null, { influencer: e.target.checked })} /> Influencer (UGC)</label>
            </div>
            <button onClick={() => genImage(null)} disabled={busyImg === "null"} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === "null" ? "Genero…" : "Genera immagine"}</button>
          </>
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
            <>
              <div className="mb-2"><ProductMockupPicker products={products} value={valueFor(idx)} onChange={(v) => setValueFor(idx, v)} /></div>
              <div className="mb-2 flex flex-wrap gap-3 text-xs">
                <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(idx).includiDescrizione} onChange={(e) => setOptsFor(idx, { includiDescrizione: e.target.checked })} /> Includi descrizione</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(idx).includiLogo} onChange={(e) => setOptsFor(idx, { includiLogo: e.target.checked })} /> Includi logo</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={optsFor(idx).influencer} onChange={(e) => setOptsFor(idx, { influencer: e.target.checked })} /> Influencer (UGC)</label>
              </div>
              <button onClick={() => genImage(idx)} disabled={busyImg === `${idx}`} className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-40">{busyImg === `${idx}` ? "Genero…" : "Genera immagine slide"}</button>
            </>
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

      <div className="mt-6 rounded border bg-neutral-50 p-3">
        <div className="mb-2 font-medium">Pubblicazione su Meta</div>
        <p className="mb-2 text-sm text-neutral-600">
          Stato: <span className="font-mono">{c.publicationStatus ?? "NON_INVIATO"}</span>
          {c.facebookPostId && <> · FB: <span className="font-mono">{c.facebookPostId}</span></>}
          {c.instagramPostId && <> · IG: <span className="font-mono">{c.instagramPostId}</span></>}
        </p>
        {c.publicationError && <p className="mb-2 text-sm text-red-600">Errore: {c.publicationError}</p>}
        {(c.status === "APPROVATO" || c.status === "PROGRAMMATO") && c.publicationStatus !== "PUBBLICATO" ? (
          <MetaPublishButton contentId={c.id} onPublished={load} />
        ) : c.publicationStatus === "PUBBLICATO" ? (
          <p className="text-sm text-emerald-700">Già pubblicato.</p>
        ) : (
          <p className="text-sm text-neutral-500">Porta il contenuto in stato APPROVATO o PROGRAMMATO per pubblicare.</p>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-400">Testo generato da {c.modello}</p>
    </div>
  );
}
