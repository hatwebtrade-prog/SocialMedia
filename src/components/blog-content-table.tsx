"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Content { id: string; status: string; createdAt: string; payload: { titoloSeo?: string }; idea?: { titolo: string } | null; }

export function BlogContentTable() {
  const [items, setItems] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/blog/contents")
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Caricamento…</p>;
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-neutral-500">
          <th className="p-2">Titolo SEO</th>
          <th className="p-2">Idea</th>
          <th className="p-2">Stato</th>
        </tr>
      </thead>
      <tbody>
        {items.map((c) => (
          <tr key={c.id} className="border-b hover:bg-neutral-50">
            <td className="p-2"><Link href={`/blog/${c.id}`} className="text-blue-600 hover:underline">{c.payload?.titoloSeo ?? "Articolo"}</Link></td>
            <td className="p-2">{c.idea?.titolo ?? "—"}</td>
            <td className="p-2">{c.status}</td>
          </tr>
        ))}
        {items.length === 0 && <tr><td colSpan={3} className="p-4 text-neutral-500">Nessun articolo.</td></tr>}
      </tbody>
    </table>
  );
}
