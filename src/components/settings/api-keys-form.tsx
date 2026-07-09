"use client";
import { useCallback, useEffect, useState } from "react";

const AI_FIELDS = [
  { name: "ANTHROPIC_API_KEY", label: "Anthropic API Key", placeholder: "sk-ant-••••", type: "password" },
  { name: "OPENAI_API_KEY", label: "OpenAI API Key", placeholder: "sk-••••", type: "password" },
  { name: "SEOZOOM_API_KEY", label: "SEOZoom API Key", placeholder: "••••", type: "password" },
  { name: "N8N_WEBHOOK_URL", label: "n8n Webhook URL", placeholder: "https://…", type: "text" },
] as const;

const SHOPIFY_FIELDS = [
  { name: "SHOPIFY_SHOP_DOMAIN", label: "Shopify Shop Domain", placeholder: "mystore.myshopify.com", type: "text" },
  { name: "SHOPIFY_ADMIN_TOKEN", label: "Shopify Admin API Token", placeholder: "shpat_••••", type: "password" },
] as const;

const META_FIELDS = [
  { name: "META_PAGE_ACCESS_TOKEN", label: "Page Access Token", placeholder: "EAA…", type: "password" },
  { name: "META_FACEBOOK_PAGE_ID", label: "Facebook Page ID", placeholder: "123456789", type: "text" },
  { name: "META_INSTAGRAM_ACCOUNT_ID", label: "Instagram Account ID", placeholder: "987654321", type: "text" },
  { name: "META_API_VERSION", label: "API Version", placeholder: "v20.0", type: "text" },
] as const;

type FieldName =
  | (typeof AI_FIELDS)[number]["name"]
  | (typeof SHOPIFY_FIELDS)[number]["name"]
  | (typeof META_FIELDS)[number]["name"];

interface KeyItem {
  key: FieldName;
  set: boolean;
  source: "db" | "env" | "none";
  value: string;
  preview: string;
  isSecret: boolean;
}

function SourceBadge({ source }: { source: KeyItem["source"] }) {
  const map = {
    db: { t: "Salvata", c: "bg-emerald-100 text-emerald-700" },
    env: { t: "Da .env", c: "bg-amber-100 text-amber-700" },
    none: { t: "Non impostata", c: "bg-neutral-100 text-neutral-500" },
  } as const;
  const s = map[source];
  return <span className={`rounded px-2 py-0.5 text-xs ${s.c}`}>{s.t}</span>;
}

export function ApiKeysForm() {
  const [items, setItems] = useState<Record<string, KeyItem>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/api-keys");
      const data = await res.json();
      const map: Record<string, KeyItem> = {};
      const dr: Record<string, string> = {};
      for (const it of data.items as KeyItem[]) {
        map[it.key] = it;
        dr[it.key] = it.isSecret ? "" : it.value; // segreti: campo vuoto (mostra preview mascherata)
      }
      setItems(map);
      setDrafts(dr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(
    async (key: string) => {
      setBusy(key);
      setSavedMsg(null);
      try {
        const res = await fetch("/api/settings/api-keys", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key, value: drafts[key] ?? "" }),
        });
        if (!res.ok) throw new Error();
        setSavedMsg(`${key} salvata`);
        await load();
      } catch {
        setSavedMsg(`Errore nel salvataggio di ${key}`);
      } finally {
        setBusy(null);
      }
    },
    [drafts, load],
  );

  const renderField = (f: { name: string; label: string; placeholder: string; type: string }) => {
    const it = items[f.name];
    return (
      <div key={f.name} className="flex flex-col gap-1 border-b border-neutral-100 py-3 last:border-0">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={f.name} className="text-sm font-medium text-neutral-700">{f.label}</label>
          {it ? <SourceBadge source={it.source} /> : null}
        </div>
        <div className="flex items-center gap-2">
          <input
            id={f.name}
            type={f.type}
            value={drafts[f.name] ?? ""}
            placeholder={it?.isSecret && it.set ? `${it.preview} — lascia vuoto per non modificare` : f.placeholder}
            onChange={(e) => setDrafts((d) => ({ ...d, [f.name]: e.target.value }))}
            className="flex-1 rounded border border-neutral-300 p-2 text-sm"
            autoComplete="off"
          />
          <button
            type="button"
            onClick={() => save(f.name)}
            disabled={busy === f.name}
            className="rounded bg-neutral-800 px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            {busy === f.name ? "…" : "Salva"}
          </button>
        </div>
      </div>
    );
  };

  if (loading) return <p className="text-sm text-neutral-500">Caricamento…</p>;

  return (
    <div className="flex flex-col gap-6">
      {savedMsg ? <p className="rounded bg-neutral-100 px-3 py-2 text-sm text-neutral-700">{savedMsg}</p> : null}

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-1 text-base font-semibold">AI & Integrazioni</h2>
        <p className="mb-2 text-xs text-neutral-500">Le chiavi salvate qui hanno precedenza sul file <code>.env</code>.</p>
        {AI_FIELDS.map(renderField)}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-1 text-base font-semibold">Shopify</h2>
        <p className="mb-2 text-xs text-neutral-500">Collega lo store Shopify da cui importare i prodotti e su cui pubblicare gli articoli.</p>
        {SHOPIFY_FIELDS.map(renderField)}
      </section>

      <section className="rounded-lg border border-neutral-200 p-4">
        <h2 className="mb-1 text-base font-semibold">Meta / Facebook</h2>
        <p className="mb-2 text-xs text-neutral-500">Credenziali per pubblicare su Facebook e Instagram (Graph API).</p>
        {META_FIELDS.map(renderField)}
      </section>
    </div>
  );
}
