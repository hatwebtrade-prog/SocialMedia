"use client";
import { useEffect, useState } from "react";

export function LogoUploader() {
  const [exists, setExists] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetch("/api/brand/logo").then((r) => r.json()).then((d) => setExists(!!d.exists)).catch(() => setExists(false)); }, []);
  const upload = async (file: File) => {
    setBusy(true);
    const dataUrl = await new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file); });
    const r = await fetch("/api/brand/logo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dataUrl }) });
    setBusy(false);
    if (r.ok) setExists(true);
  };
  return (
    <div className="text-xs text-ink-soft">
      Logo brand: {exists ? "✓ caricato" : "non caricato"}{" "}
      <label className="cursor-pointer underline">
        {busy ? "carico…" : exists ? "sostituisci" : "carica"}
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      </label>
    </div>
  );
}
