"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CONTENT_STATUSES, CONTENT_FORMATS, META_PLATFORMS } from "@/lib/meta/enums";
import { StatusBadge } from "@/components/status-badge";

interface Content {
  id: string;
  formato: string;
  piattaforme: string[];
  status: string;
  dataPrevista: string | null;
  idea?: { titolo: string } | null;
  assets: { id: string }[];
}

export function MetaContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [f, setF] = useState({ status: "", formato: "", platform: "" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (f.status) qs.set("status", f.status);
    if (f.formato) qs.set("formato", f.formato);
    if (f.platform) qs.set("platform", f.platform);
    const res = await fetch(`/api/meta/contents?${qs.toString()}`);
    setItems(await res.json());
    setLoading(false);
  }, [f]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-4 flex gap-3 text-sm">
        <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className="rounded border p-1">
          <option value="">Tutti gli stati</option>
          {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={f.formato} onChange={(e) => setF({ ...f, formato: e.target.value })} className="rounded border p-1">
          <option value="">Tutti i formati</option>
          {CONTENT_FORMATS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value })} className="rounded border p-1">
          <option value="">Tutte le piattaforme</option>
          {META_PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      {loading ? <p>Caricamento…</p> : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2">Idea</th><th className="p-2">Formato</th><th className="p-2">Piattaforme</th>
              <th className="p-2">Stato</th><th className="p-2">Data prevista</th><th className="p-2">Img</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2"><Link href={`/meta/${c.id}`} className="text-blue-600 hover:underline">{c.idea?.titolo ?? "—"}</Link></td>
                <td className="p-2">{c.formato}</td>
                <td className="p-2">{c.piattaforme.join(", ")}</td>
                <td className="p-2"><StatusBadge status={c.status} /></td>
                <td className="p-2">{c.dataPrevista ? new Date(c.dataPrevista).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2">{c.assets.length}</td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={6} className="p-4 text-neutral-500">Nessun contenuto.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
