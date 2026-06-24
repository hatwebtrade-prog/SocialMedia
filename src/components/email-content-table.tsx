"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTENT_STATUSES } from "@/lib/meta/enums";
import { StatusBadge } from "@/components/status-badge";

interface Content { id: string; status: string; formato: string; payload: { oggetto?: string }; idea?: { titolo: string } | null; }

export function EmailContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      const res = await fetch(`/api/email/contents?${qs.toString()}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-3 text-sm">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
          <option value="">Tutti gli stati</option>
          {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead><tr className="border-b text-left text-neutral-500">
            <th className="p-2">Oggetto</th><th className="p-2">Idea</th><th className="p-2">Tipo</th><th className="p-2">Stato</th>
          </tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><Link href={`/email/${c.id}`} className="text-blue-600 hover:underline">{c.payload?.oggetto ?? "Email"}</Link></td>
                <td className="p-2">{c.idea?.titolo ?? "—"}</td>
                <td className="p-2">{c.formato}</td>
                <td className="p-2"><StatusBadge status={c.status} /></td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={4} className="p-4 text-neutral-500">Nessuna email.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
