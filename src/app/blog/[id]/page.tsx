"use client";

import { useEffect, useState, use } from "react";
import { StatusBadge } from "@/components/status-badge";
import { GenerationProgress } from "@/components/generation-progress";
import { ImageBriefForm, type Brief } from "@/components/image-brief";

interface Asset { id: string; }
interface Content {
  id: string; status: string;
  payload: {
    titoloSeo?: string; metaDescription?: string; keywordPrincipale?: string; keywordSecondarie?: string[];
    corpoHtml?: string; cta?: string; puntiChiave?: string[];
    faq?: { domanda: string; risposta: string }[];
    prodotti?: { handle: string; titolo: string; url: string }[];
    jsonLd?: string;
  };
  assets: Asset[];
  publicationStatus?: string;
  shopifyArticleUrl?: string | null;
}

const STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"];

export default function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Content | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [blogs, setBlogs] = useState<{ id: number; title: string; handle: string }[]>([]);
  const [blogId, setBlogId] = useState("");
  const [pubMsg, setPubMsg] = useState<string | null>(null);
  const [pubBusy, setPubBusy] = useState(false);
  const [products, setProducts] = useState<{ id: string; nome: string; imagePath: string | null }[]>([]);
  const [refProductId, setRefProductId] = useState("");
  const [useMockup, setUseMockup] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [imgMsg, setImgMsg] = useState<string | null>(null);
  const [provider, setProvider] = useState("GPT");
  const [brief, setBrief] = useState<Brief>({});
  useEffect(() => { fetch("/api/blog/shopify-blogs").then((r) => r.json()).then((d) => setBlogs(Array.isArray(d) ? d : [])).catch(() => setBlogs([])); }, []);
  useEffect(() => { fetch("/api/products").then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : [])).catch(() => setProducts([])); }, []);

  const load = () =>
    fetch(`/api/blog/contents/${id}`)
      .then((r) => { if (!r.ok) throw new Error("Articolo non trovato"); return r.json(); })
      .then((d) => { setC(d); setErr(null); })
      .catch(() => setErr("Impossibile caricare l'articolo."));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  const setStatus = async (status: string) => {
    try {
      const res = await fetch(`/api/blog/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setErr("Aggiornamento stato non riuscito.");
    }
  };

  const pubblica = async () => {
    const blog = blogs.find((b) => String(b.id) === blogId);
    if (!blog) { setPubMsg("Scegli un blog Shopify."); return; }
    setPubBusy(true); setPubMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/publish`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ blogId: blog.id, blogHandle: blog.handle, published: true }) });
      const json = await res.json();
      setPubMsg(res.ok && json.status === "DONE" ? "Pubblicato su Shopify." : `Errore: ${json.error ?? "sconosciuto"}`);
      await load();
    } catch { setPubMsg("Errore di rete."); } finally { setPubBusy(false); }
  };

  const genImage = async () => {
    setImgBusy(true); setImgMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/image`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId: refProductId || undefined, useMockup: useMockup && !!refProductId, provider, brief, styleId: brief.stile }),
      });
      const json = await res.json();
      setImgMsg(res.ok && json.status === "DONE" ? "Immagine generata." : `Errore: ${json.error ?? "sconosciuto"}`);
      await load();
    } catch { setImgMsg("Errore di rete."); } finally { setImgBusy(false); }
  };

  const uploadImage = async (file: File) => {
    setImgBusy(true); setImgMsg(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file);
      });
      const res = await fetch(`/api/blog/contents/${id}/image/upload`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const json = await res.json();
      setImgMsg(res.ok && json.status === "DONE" ? "Immagine caricata." : `Errore: ${json.error ?? "sconosciuto"}`);
      await load();
    } catch { setImgMsg("Errore di rete."); } finally { setImgBusy(false); }
  };

  if (err) return <p className="text-red-600">{err}</p>;
  if (!c) return <p>Caricamento…</p>;
  const p = c.payload ?? {};

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-semibold">{p.titoloSeo ?? "Articolo"}</h1>
      <p className="mb-2 text-sm text-neutral-500">{p.metaDescription}</p>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="rounded bg-neutral-100 px-2 py-0.5">{c.status}</span>
        <select className="rounded border p-1" value={c.status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="text-neutral-500">Pubblicazione:</span>
        <StatusBadge status={c.publicationStatus ?? "NON_INVIATO"} />
        {c.shopifyArticleUrl && (
          <a href={c.shopifyArticleUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri su Shopify</a>
        )}
      </div>
      {c.status === "APPROVATO" && (
        <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
          <strong>Pubblica su Shopify</strong>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select value={blogId} onChange={(e) => setBlogId(e.target.value)} className="rounded border p-1">
              <option value="">Scegli blog…</option>
              {blogs.map((b) => <option key={b.id} value={String(b.id)}>{b.title}</option>)}
            </select>
            <button onClick={pubblica} disabled={pubBusy} className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-40">{pubBusy ? "Pubblico…" : "Pubblica su Shopify"}</button>
          </div>
          {pubMsg && <p className="mt-2">{pubMsg}</p>}
        </div>
      )}
      <p className="mb-3 text-xs text-neutral-500">Keyword: {p.keywordPrincipale} {p.keywordSecondarie?.length ? `· ${p.keywordSecondarie.join(", ")}` : ""}</p>
      <div className="mb-4 rounded border bg-neutral-50 p-3 text-sm">
        <div className="mb-2 font-medium">Immagine in evidenza</div>
        {c.assets?.[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/assets/${c.assets[0].id}`} alt="" className="mb-3 w-full max-w-md rounded border" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded border p-1">
            <option value="GPT">GPT (OpenAI)</option>
            <option value="GEMINI">Gemini (nano banana)</option>
            <option value="HIGGSFIELD">Higgsfield</option>
            <option value="MANUAL">Caricamento manuale</option>
          </select>
          <select value={refProductId} onChange={(e) => setRefProductId(e.target.value)} className="rounded border p-1">
            <option value="">Nessun prodotto</option>
            {products.filter((pr) => pr.imagePath).map((pr) => <option key={pr.id} value={pr.id}>{pr.nome}</option>)}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={useMockup} onChange={(e) => setUseMockup(e.target.checked)} disabled={!refProductId} />
            Inserisci il mockup nel contesto (image-edit)
          </label>
          {refProductId && useMockup && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/products/${refProductId}/image`} alt="" className="h-14 w-14 rounded border object-contain" />
          )}
          {provider === "MANUAL" ? (
            <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} className="text-sm" />
          ) : (
            <button onClick={genImage} disabled={imgBusy} className="rounded bg-emerald-600 px-3 py-1 text-white disabled:opacity-40">{imgBusy ? "Genero…" : (c.assets?.[0] ? "Rigenera immagine" : "Genera immagine")}</button>
          )}
        </div>
        <ImageBriefForm provider={provider} value={brief} onChange={setBrief} />
        <GenerationProgress running={imgBusy} estimatedMs={90000} label="Generazione immagine" />
        {imgMsg && <p className="mt-2">{imgMsg}</p>}
      </div>
      {p.puntiChiave?.length ? (
        <div className="mb-4 rounded bg-amber-50 p-3 text-sm">
          <strong>Punti chiave</strong>
          <ul className="ml-4 list-disc">{p.puntiChiave.map((k, i) => <li key={i}>{k}</li>)}</ul>
        </div>
      ) : null}
      <article className="prose mb-4 max-w-none" dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
      {p.cta && <p className="mb-4 font-medium">{p.cta}</p>}
      {p.prodotti?.length ? (
        <div className="mb-4 text-sm">
          <strong>Prodotti collegati</strong>
          <ul className="ml-4 list-disc">
            {p.prodotti.map((pr) => <li key={pr.handle}><a href={pr.url} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">{pr.titolo}</a></li>)}
          </ul>
        </div>
      ) : null}
      {p.faq?.length ? (
        <div className="mb-4 text-sm">
          <strong>FAQ</strong>
          {p.faq.map((f, i) => <div key={i} className="mt-2"><div className="font-medium">{f.domanda}</div><div>{f.risposta}</div></div>)}
        </div>
      ) : null}
      {p.jsonLd && <details className="text-xs text-neutral-500"><summary>JSON-LD</summary><pre className="overflow-auto">{p.jsonLd}</pre></details>}
    </div>
  );
}
