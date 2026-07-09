"use client";
import { useEffect, useState, useCallback } from "react";

interface Profile { palette: string[]; stileFotografico?: string | null; mood?: string | null; elementiRicorrenti?: string | null; daEvitare?: string | null }

export function BrandVisualEditor() {
  const [p, setP] = useState<Profile>({ palette: [] });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => { const r = await fetch("/api/knowledge/visual-profile"); setP(await r.json().catch(() => ({ palette: [] }))); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/knowledge/visual-profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(p) });
    setMsg(r.ok ? "Salvato." : "Errore salvataggio."); setBusy(false);
  };
  const autofill = async () => {
    setBusy(true); setMsg("Genero dall'AI…");
    const r = await fetch("/api/knowledge/visual-profile/generate", { method: "POST" });
    const j = await r.json();
    if (r.ok) { setP(j); setMsg("Identità visiva generata (modificabile)."); } else setMsg(`Errore: ${j.error ?? "sconosciuto"}`);
    setBusy(false);
  };
  const field = (k: keyof Profile, label: string) => (
    <label className="flex flex-col text-sm">{label}
      <textarea className="rounded border p-2" rows={2} value={(p[k] as string) ?? ""} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
    </label>
  );

  return (
    <div className="rounded border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-medium">Identità Visiva del brand</h2>
        <button onClick={autofill} disabled={busy} className="rounded border px-3 py-1 text-sm disabled:opacity-40">Genera dai materiali</button>
      </div>
      <p className="mb-3 text-xs text-neutral-500">Guida automaticamente la generazione di immagini e video per la coerenza di brand.</p>
      <label className="mb-2 flex flex-col text-sm">Palette colori (separati da virgola)
        <input className="rounded border p-2" value={p.palette.join(", ")} onChange={(e) => setP({ ...p, palette: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        {field("stileFotografico", "Stile fotografico")}
        {field("mood", "Mood")}
        {field("elementiRicorrenti", "Elementi ricorrenti")}
        {field("daEvitare", "Da evitare")}
      </div>
      <button onClick={save} disabled={busy} className="mt-3 rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-40">Salva</button>
      {msg && <span className="ml-2 text-xs text-neutral-600">{msg}</span>}
    </div>
  );
}
