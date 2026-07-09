"use client";

import { useEffect, useState, use } from "react";
import { StatusBadge } from "@/components/status-badge";
import { assembleEmailHtml, type EmailBlocks } from "@/lib/email/email-html";

interface Content {
  id: string; status: string; formato: string;
  payload: { oggetto?: string; preheader?: string; corpoHtml?: string; cta?: string; prodotti?: { handle: string; titolo: string; url: string }[]; emailBlocks?: EmailBlocks };
  publicationStatus?: string;
}

const STATUSES = ["BOZZA", "DA_APPROVARE", "APPROVATO", "PROGRAMMATO", "PUBBLICATO"];

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [c, setC] = useState<Content | null>(null);
  const [err, setErr] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const load = () => fetch(`/api/email/contents/${id}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setC).catch(() => setErr(true));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  if (err) return <p className="text-red-600">Impossibile caricare l&apos;email.</p>;
  if (!c) return <p>Caricamento…</p>;
  const p = c.payload ?? {};
  const assembled = assembleEmailHtml(p, p.emailBlocks ?? { productImages: [], crossSell: [] });
  const copyHtml = async () => {
    try { await navigator.clipboard.writeText(assembled); setCopyMsg("HTML copiato negli appunti."); }
    catch { setCopyMsg("Copia non riuscita."); }
  };
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
      <div className="mb-3 flex items-center gap-3">
        <button onClick={copyHtml} className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Copia HTML</button>
        {copyMsg && <span className="text-sm text-neutral-600">{copyMsg}</span>}
      </div>
      <div className="mb-4 rounded border" dangerouslySetInnerHTML={{ __html: assembled }} />
    </div>
  );
}
