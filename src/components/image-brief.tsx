"use client";
import { useEffect, useState } from "react";

export interface Brief {
  soggetto?: string; ambientazione?: string; luce?: string; inquadratura?: string; mood?: string;
  formato?: "verticale" | "quadrato" | "orizzontale"; stile?: string; tieneProdotto?: boolean; note?: string;
}
const AMBIENTAZIONI = ["cucina luminosa", "bagno spa", "esterno naturale", "studio minimal", "camera accogliente", "palestra"];
const LUCI = ["luce naturale morbida", "golden hour", "studio softbox", "luce mattutina"];
const INQUADRATURE = ["primo piano", "medio busto", "figura intera", "dall'alto (flat lay)", "selfie 0.5"];
const MOOD = ["autentico UGC", "fresco ed energico", "calmo e rilassante", "lusso", "naturale"];

export function ImageBriefForm({ provider, value, onChange }: { provider: string; value: Brief; onChange: (b: Brief) => void }) {
  const [styles, setStyles] = useState<{ id: string; name: string; previewUrl: string | null }[]>([]);
  useEffect(() => {
    if (provider === "HIGGSFIELD") fetch("/api/higgsfield/soul-styles").then((r) => r.json()).then((d) => setStyles(Array.isArray(d) ? d : [])).catch(() => setStyles([]));
  }, [provider]);
  const set = (k: keyof Brief, v: unknown) => onChange({ ...value, [k]: v });
  const sel = (k: keyof Brief, opts: string[], label: string) => (
    <label className="flex flex-col text-xs">{label}
      <select className="rounded border p-1" value={(value[k] as string) ?? ""} onChange={(e) => set(k, e.target.value || undefined)}>
        <option value="">—</option>{opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
  return (
    <div className="mb-3 rounded border bg-neutral-50 p-3">
      <div className="mb-2 text-sm font-medium">Brief immagine (filtri)</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {sel("ambientazione", AMBIENTAZIONI, "Ambientazione")}
        {sel("luce", LUCI, "Luce")}
        {sel("inquadratura", INQUADRATURE, "Inquadratura")}
        {sel("mood", MOOD, "Mood")}
        <label className="flex flex-col text-xs">Formato
          <select className="rounded border p-1" value={value.formato ?? "quadrato"} onChange={(e) => set("formato", e.target.value)}>
            <option value="quadrato">Quadrato</option><option value="verticale">Verticale</option><option value="orizzontale">Orizzontale</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={!!value.tieneProdotto} onChange={(e) => set("tieneProdotto", e.target.checked)} /> Tiene il prodotto</label>
      </div>
      <input className="mt-2 w-full rounded border p-1 text-sm" placeholder="Soggetto / descrizione (opzionale)" value={value.soggetto ?? ""} onChange={(e) => set("soggetto", e.target.value || undefined)} />
      {provider === "HIGGSFIELD" && (
        <label className="mt-2 flex flex-col text-xs">Stile UGC (Higgsfield)
          <select className="rounded border p-1" value={value.stile ?? ""} onChange={(e) => set("stile", e.target.value || undefined)}>
            <option value="">Default (Realistic)</option>
            {styles.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
