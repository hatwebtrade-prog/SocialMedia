"use client";

import { useEffect, useState, useCallback } from "react";
import { StatusBadge } from "@/components/status-badge";

const PUB_STATUSES = ["NON_INVIATO", "INVIATO_A_N8N", "IN_PUBBLICAZIONE", "PUBBLICATO", "ERRORE"];

interface Row { id: string; canale: string; status: string; publicationStatus: string; publicationError: string | null; dataPrevista: string | null; shopifyArticleUrl: string | null; titolo: string; }

export function PublicationsTable() {
  const [items, setItems] = useState<Row[]>([]);
  const [ps, setPs] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (ps) qs.set("publicationStatus", ps);
      const res = await fetch(`/api/publications?${qs.toString()}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [ps]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-3 text-sm">
        <select value={ps} onChange={(e) => setPs(e.target.value)} className="rounded border p-1">
          <option value="">Tutti gli stati pubblicazione</option>
          {PUB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b text-left text-neutral-500">
            <th className="p-2">Contenuto</th><th className="p-2">Canale</th><th className="p-2">Pubblicazione</th><th className="p-2">Data</th><th className="p-2">Note</th>
          </tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id} className="border-b hover:bg-neutral-50">
                <td className="p-2">{r.titolo}</td>
                <td className="p-2">{r.canale}</td>
                <td className="p-2"><StatusBadge status={r.publicationStatus} /></td>
                <td className="p-2">{r.dataPrevista ? new Date(r.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2 text-xs text-neutral-500">{r.publicationError ?? (r.shopifyArticleUrl ? <a href={r.shopifyArticleUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">apri</a> : "—")}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={5} className="p-4 text-neutral-500">Nessuna pubblicazione.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
