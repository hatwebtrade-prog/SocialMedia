"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTENT_STATUSES } from "@/lib/meta/enums";
import { StatusBadge } from "@/components/status-badge";

interface Content {
  id: string;
  status: string;
  dataPrevista: string | null;
  payload: { titoloSeo?: string; keywordPrincipale?: string };
  idea?: { titolo: string } | null;
}

export function BlogContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      const res = await fetch(`/api/blog/contents?${qs.toString()}`);
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [status]);

  const cestina = async (id: string) => {
    if (!window.confirm("Cestinare l'articolo? Se è pubblicato, verrà eliminato anche l'articolo live su Shopify.")) return;
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/trash`, { method: "PATCH" });
      const json = await res.json();
      if (!res.ok || json.status === "ERROR") { setMsg(`Errore: ${json.error ?? "sconosciuto"}`); return; }
      await load();
    } catch { setMsg("Errore di rete."); }
  };

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
      <div className="mb-4 flex gap-3 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
          <option value="">Tutti gli stati</option>
          {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2">Titolo SEO</th>
              <th className="p-2">Idea</th>
              <th className="p-2">Keyword</th>
              <th className="p-2">Stato</th>
              <th className="p-2">Data prevista</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><Link href={`/blog/${c.id}`} className="text-blue-600 hover:underline">{c.payload?.titoloSeo ?? "Articolo"}</Link></td>
                <td className="p-2">{c.idea?.titolo ?? "—"}</td>
                <td className="p-2">{c.payload?.keywordPrincipale ?? "—"}</td>
                <td className="p-2"><StatusBadge status={c.status} /></td>
                <td className="p-2">{c.dataPrevista ? new Date(c.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2"><button onClick={() => cestina(c.id)} aria-label="Cestina" title="Cestina" className="text-neutral-500 hover:text-red-600">🗑</button></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-4 text-neutral-500">Nessun articolo.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
