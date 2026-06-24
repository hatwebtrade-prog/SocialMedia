"use client";

import { useEffect, useState, use } from "react";
import { StatusBadge } from "@/components/status-badge";

interface Content {
  id: string; status: string; formato: string;
  payload: { oggetto?: string; preheader?: string; corpoHtml?: string; cta?: string; prodotti?: { handle: string; titolo: string; url: string }[] };
  publicationStatus?: string;
}

const STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"];

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Content | null>(null);
  const [err, setErr] = useState(false);

  const load = () => fetch(`/api/email/contents/${id}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setC).catch(() => setErr(true));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (err) return <p className="text-red-600">Impossibile caricare l&apos;email.</p>;
  if (!c) return <p>Caricamento…</p>;
  const p = c.payload ?? {};
  const setStatus = async (status: string) => {
    try { const r = await fetch(`/api/email/contents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }); if (!r.ok) throw new Error(); await load(); } catch { setErr(true); }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-semibold">{p.oggetto ?? "Email"}</h1>
      <p className="mb-2 text-sm text-neutral-500">{p.preheader}</p>
      <div className="mb-3 flex items-center gap-2 text-sm">
        <span className="rounded bg-neutral-100 px-2 py-0.5">{c.formato}</span>
        <select value={c.status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="text-neutral-500">Pubblicazione:</span>
        <StatusBadge status={c.publicationStatus ?? "NON_INVIATO"} />
      </div>
      <article className="prose mb-4 max-w-none rounded border p-3" dangerouslySetInnerHTML={{ __html: p.corpoHtml ?? "" }} />
      {p.cta && <p className="mb-4 font-medium">{p.cta}</p>}
      {p.prodotti?.length ? (
        <div className="text-sm"><strong>Prodotti</strong>
          <ul className="ml-4 list-disc">{p.prodotti.map((pr) => <li key={pr.handle}><a href={pr.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{pr.titolo}</a></li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}
