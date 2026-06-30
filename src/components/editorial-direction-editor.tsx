"use client";
import { useEffect, useState, useCallback } from "react";

interface Profile {
  campagna?: string | null;
  periodo?: string | null;
  temi?: string | null;
  tonoVisivo?: string | null;
  daMostrare?: string | null;
  daEvitare?: string | null;
}

export function EditorialDirectionEditor() {
  const [p, setP] = useState<Profile>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/knowledge/editorial-direction");
    setP(await r.json().catch(() => ({})));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/knowledge/editorial-direction", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    setMsg(r.ok ? "Salvato." : "Errore salvataggio."); setBusy(false);
  };

  const field = (k: keyof Profile, label: string, multiline = false) => (
    <label key={k} className="flex flex-col text-sm">{label}
      {multiline
        ? <textarea className="rounded border p-2" rows={2} value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
        : <input className="rounded border p-2" value={p[k] ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
      }
    </label>
  );

  return (
    <div className="rounded border bg-white p-4">
      <div className="mb-2">
        <h2 className="font-medium">Direzione Editoriale</h2>
      </div>
      <p className="mb-3 text-xs text-neutral-500">Guida la generazione delle immagini con la direzione editoriale corrente (campagna, temi, tono).</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {field("campagna", "Campagna")}
        {field("periodo", "Periodo")}
        {field("tonoVisivo", "Tono visivo")}
        {field("temi", "Temi", true)}
        {field("daMostrare", "Da mostrare", true)}
        {field("daEvitare", "Da evitare", true)}
      </div>
      <button onClick={save} disabled={busy} className="mt-3 rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40">Salva</button>
      {msg && <span className="ml-2 text-xs text-neutral-600">{msg}</span>}
    </div>
  );
}
