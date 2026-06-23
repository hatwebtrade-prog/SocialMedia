"use client";

import { useEffect, useState, useCallback } from "react";
import { KNOWLEDGE_TYPES } from "@/lib/brain/enums";

interface Item { id: string; tipo: string; titolo: string; contenuto: string; }

export default function KnowledgePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState({ tipo: "DOCUMENTO", titolo: "", contenuto: "" });

  const load = useCallback(async () => {
    const res = await fetch("/api/knowledge");
    setItems(await res.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    await fetch("/api/knowledge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ tipo: "DOCUMENTO", titolo: "", contenuto: "" });
    await load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Knowledge Base</h1>
      <div className="mb-6 space-y-3 rounded border bg-white p-4">
        <select className="w-full rounded border p-2" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
          {KNOWLEDGE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input className="w-full rounded border p-2" placeholder="Titolo" value={form.titolo} onChange={(e) => setForm({ ...form, titolo: e.target.value })} />
        <textarea className="w-full rounded border p-2" rows={4} placeholder="Contenuto (incolla materiali Agocap)" value={form.contenuto} onChange={(e) => setForm({ ...form, contenuto: e.target.value })} />
        <button onClick={submit} className="rounded bg-blue-600 px-4 py-2 text-white">Aggiungi</button>
      </div>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.id} className="rounded border bg-white p-3 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">[{i.tipo}] {i.titolo}</span>
              <button onClick={() => remove(i.id)} className="text-red-600">Elimina</button>
            </div>
            <p className="mt-1 text-neutral-600">{i.contenuto}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
