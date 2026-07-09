"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface TrashItem {
  id: string;
  status: string;
  deletedAt: string | null;
  payload: { titoloSeo?: string };
  idea?: { titolo: string } | null;
}

export default function BlogCestinoPage() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/blog/contents/trash");
      if (!res.ok) { setMsg("Caricamento del cestino non riuscito."); setItems([]); return; }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch { setMsg("Caricamento del cestino non riuscito."); setItems([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const restore = async (id: string) => {
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${id}/restore`, { method: "PATCH" });
      if (!res.ok) { setMsg("Ripristino non riuscito."); return; }
      await load();
    } catch { setMsg("Ripristino non riuscito."); }
  };

  const deleteForever = async (item: TrashItem) => {
    if (!window.confirm(`Eliminare definitivamente "${item.payload?.titoloSeo ?? "Articolo"}"? L'azione non è reversibile.`)) return;
    setMsg(null);
    try {
      const res = await fetch(`/api/blog/contents/${item.id}`, { method: "DELETE" });
      if (!res.ok) { setMsg("Eliminazione non riuscita."); return; }
      await load();
    } catch { setMsg("Eliminazione non riuscita."); }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cestino blog</h1>
        <Link href="/blog" className="text-sm text-neutral-600 hover:underline">← Torna al blog</Link>
      </div>
      {msg && <p className="mb-2 text-sm text-red-600">{msg}</p>}
      {loading ? <p>Caricamento…</p> : items.length === 0 ? (
        <p className="text-neutral-500">Il cestino è vuoto.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="p-2">Titolo SEO</th>
              <th className="p-2">Idea</th>
              <th className="p-2">Cestinato il</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b hover:bg-neutral-50">
                <td className="p-2">{c.payload?.titoloSeo ?? "Articolo"}</td>
                <td className="p-2">{c.idea?.titolo ?? "—"}</td>
                <td className="p-2">{c.deletedAt ? new Date(c.deletedAt).toLocaleDateString("it-IT") : "—"}</td>
                <td className="p-2 whitespace-nowrap">
                  <button onClick={() => restore(c.id)} className="mr-3 text-blue-600 hover:underline">Ripristina</button>
                  <button onClick={() => deleteForever(c)} className="text-red-600 hover:underline">Elimina definitivamente</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
