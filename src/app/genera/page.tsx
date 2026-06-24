"use client";

import { useState } from "react";
import { ManualIdeaForm } from "@/components/forms/manual-idea-form";
import { AiBrainstormForm } from "@/components/forms/ai-brainstorm-form";
import { ScopriKeyword } from "@/components/scopri-keyword";

type Tab = "ricerca" | "ai" | "manuale";
const TABS: { key: Tab; label: string }[] = [
  { key: "ricerca", label: "Ricerca → idee (SEOZoom + Google)" },
  { key: "ai", label: "AI brainstorming" },
  { key: "manuale", label: "Manuale" },
];

export default function GeneraPage() {
  const [tab, setTab] = useState<Tab>("ricerca");
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Genera idee</h1>
      <div className="mb-5 flex gap-2 border-b text-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-3 py-2 ${tab === t.key ? "border-blue-600 font-medium text-blue-700" : "border-transparent text-neutral-500 hover:text-neutral-800"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "ricerca" && (
        <div>
          <p className="mb-3 text-sm text-neutral-500">Da un seed o un prodotto: query correlate Google + keyword reali SEOZoom (volume/difficoltà) → idee data-driven nel Brain.</p>
          <ScopriKeyword />
        </div>
      )}
      {tab === "ai" && <AiBrainstormForm />}
      {tab === "manuale" && <ManualIdeaForm />}
    </div>
  );
}
