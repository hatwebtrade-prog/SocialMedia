"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MetaPublishButton({ contentId, disabled, onPublished }: { contentId: string; disabled?: boolean; onPublished?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function publish() {
    if (!confirm("Pubblicare ORA su Facebook/Instagram? Il post sarà visibile pubblicamente.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/meta/contents/${contentId}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Pubblicazione fallita");
      else {
        onPublished?.();
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={publish}
        disabled={busy || disabled}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? "Pubblicazione…" : "Pubblica ora su Meta"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
