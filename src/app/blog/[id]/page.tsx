"use client";

import { useEffect, useState, use } from "react";

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
}

const STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"];

export default function BlogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Content | null>(null);

  const load = () => fetch(`/api/blog/contents/${id}`).then((r) => r.json()).then(setC).catch(() => setC(null));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (!c) return <p>Caricamento…</p>;
  const p = c.payload ?? {};
  const setStatus = async (status: string) => {
    await fetch(`/api/blog/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

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
      <p className="mb-3 text-xs text-neutral-500">Keyword: {p.keywordPrincipale} {p.keywordSecondarie?.length ? `· ${p.keywordSecondarie.join(", ")}` : ""}</p>
      {c.assets[0] && <img src={`/api/assets/${c.assets[0].id}`} alt="" className="mb-4 w-full max-w-md rounded" />}
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
