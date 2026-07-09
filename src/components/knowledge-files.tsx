"use client";
import { useEffect, useState, useCallback } from "react";

interface KFile { id: string; nome: string; mimeType: string; kind: string; stato: string; errore?: string | null }

export function KnowledgeFiles() {
  const [files, setFiles] = useState<KFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/knowledge/files"); setFiles(await r.json().catch(() => []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async (file: File) => {
    setBusy(true); setMsg(null);
    try {
      const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
      const resp = await fetch("/api/knowledge/files", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ nome: file.name, mimeType: file.type || "application/octet-stream", contentBase64: dataUrl }) });
      const j = await resp.json();
      setMsg(resp.ok ? `Caricato: ${j.nome} (${j.stato})` : `Errore: ${j.error ?? "sconosciuto"}`);
      await load();
    } catch { setMsg("Errore di rete."); } finally { setBusy(false); }
  };
  const remove = async (id: string) => { await fetch(`/api/knowledge/files/${id}`, { method: "DELETE" }); await load(); };

  return (
    <div className="rounded border bg-white p-4">
      <h2 className="mb-2 font-medium">File</h2>
      <p className="mb-2 text-xs text-neutral-500">PDF/DOCX/TXT/MD (testo estratto per i prompt) e immagini (riferimenti brand).</p>
      <input type="file" accept=".pdf,.doc,.docx,.txt,.md,image/*" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} className="text-sm" />
      {busy && <span className="ml-2 text-xs text-neutral-500">Carico…</span>}
      {msg && <p className="mt-1 text-xs text-neutral-600">{msg}</p>}
      <ul className="mt-3 space-y-2 text-sm">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 border-b pb-2">
            {f.kind === "IMMAGINE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/knowledge/files/${f.id}/raw`} alt="" className="h-10 w-10 rounded border object-contain" />
            ) : <span className="text-lg">📄</span>}
            <a href={`/api/knowledge/files/${f.id}/raw`} target="_blank" rel="noreferrer" className="flex-1 text-blue-600 hover:underline">{f.nome}</a>
            <span className={`rounded px-1.5 py-0.5 text-xs ${f.stato === "PRONTO" ? "bg-green-100 text-green-700" : f.stato === "ERRORE" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{f.stato}</span>
            <button onClick={() => remove(f.id)} className="text-xs text-red-600 hover:underline">elimina</button>
          </li>
        ))}
        {files.length === 0 && <li className="text-neutral-400">Nessun file.</li>}
      </ul>
    </div>
  );
}
