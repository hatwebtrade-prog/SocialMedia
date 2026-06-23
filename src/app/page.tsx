"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SummaryCard } from "@/components/summary-card";
import type { HomeSummary } from "@/lib/home/summary";

const n = (v: number | undefined) => v ?? 0;

export default function HomePage() {
  const [s, setS] = useState<HomeSummary | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/home/summary").then((r) => { if (!r.ok) throw new Error(); return r.json(); }).then(setS).catch(() => setErr(true));
  }, []);

  if (err) return <p className="text-red-600">Impossibile caricare il riepilogo.</p>;
  if (!s) return <p>Caricamento…</p>;

  const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Home</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SummaryCard title="Trend & SEO" icon="📈" ctaHref="/trend-seo" ctaLabel="Vai ad Analisi SEO / Trend"
          rows={[{ label: "Idee SEO nuove", value: n(s.idee.seozoomNuove) }, { label: "Idee SEO approvate", value: n(s.idee.seozoomApprovate) }]} />
        <SummaryCard title="Brain — Idee" icon="🧠" ctaHref="/dashboard" ctaLabel="Vai alle Idee"
          rows={[{ label: "Nuove", value: n(s.idee.perStato.NUOVA) }, { label: "Da approfondire", value: n(s.idee.perStato.DA_APPROFONDIRE) }, { label: "Approvate", value: n(s.idee.perStato.APPROVATA) }]} />
        <SummaryCard title="Meta" icon="📱" ctaHref="/meta" ctaLabel="Vai ad Area Meta"
          rows={[{ label: "Bozza", value: n(s.meta.BOZZA) }, { label: "Da approvare", value: n(s.meta.DA_APPROVARE) }, { label: "Approvati", value: n(s.meta.APPROVATO) }, { label: "Programmati", value: n(s.meta.PROGRAMMATO) }]} />
        <SummaryCard title="Blog" icon="✍️" ctaHref="/blog" ctaLabel="Vai ad Area Blog"
          rows={[{ label: "Bozza", value: n(s.blog.BOZZA) }, { label: "Da approvare", value: n(s.blog.DA_APPROVARE) }, { label: "Approvati", value: n(s.blog.APPROVATO) }, { label: "Pubblicati", value: n(s.blog.PUBBLICATO) }]} />
        <SummaryCard title="TikTok" icon="🎬" ctaHref="/tiktok" ctaLabel="Vai ad Area TikTok" soon
          rows={[{ label: "Script", value: 0 }, { label: "Programmati", value: 0 }]} />
        <SummaryCard title="Email" icon="✉️" ctaHref="/email" ctaLabel="Vai ad Area Email" soon
          rows={[{ label: "Newsletter", value: 0 }, { label: "Programmate", value: 0 }]} />
      </div>

      <div className="mt-6 rounded-lg border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-semibold"><span aria-hidden>🗓️</span>Calendario imminente</h2>
          <Link href="/calendario" className="text-sm text-blue-600 hover:underline">Vai al Calendario →</Link>
        </div>
        {s.prossimi.length === 0 ? (
          <p className="text-sm text-neutral-500">Nessun contenuto programmato.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {s.prossimi.map((p) => (
              <li key={p.id} className="flex gap-2">
                <span className="w-48 shrink-0 text-neutral-500">{fmtDay(p.dataPrevista)}</span>
                <span className="rounded bg-neutral-100 px-1.5 text-xs">{p.canale}</span>
                <span>{p.titolo}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
