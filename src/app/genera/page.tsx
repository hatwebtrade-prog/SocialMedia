"use client";

import { useState } from "react";
import { ManualIdeaForm } from "@/components/forms/manual-idea-form";
import { AiBrainstormForm } from "@/components/forms/ai-brainstorm-form";
import { ScopriKeyword } from "@/components/scopri-keyword";
import { ImportProductsButton } from "@/components/import-products-button";
import { PageHeader, SegmentedControl, Card } from "@/components/ui";

type Tab = "ricerca" | "ai" | "manuale";

export default function GeneraPage() {
  const [tab, setTab] = useState<Tab>("ricerca");
  return (
    <div>
      <PageHeader title="Genera idee" subtitle="Ricerca data-driven, brainstorming AI o inserimento manuale." actions={<ImportProductsButton />} />
      <SegmentedControl<Tab>
        className="mb-5"
        options={[{ value: "ricerca", label: "Ricerca → idee" }, { value: "ai", label: "AI brainstorming" }, { value: "manuale", label: "Manuale" }]}
        value={tab}
        onChange={setTab}
      />
      <Card className="p-5">
        {tab === "ricerca" && (
          <div>
            <p className="mb-3 text-sm text-ink-soft">Da un seed o un prodotto: query correlate Google + keyword reali SEOZoom (volume/difficoltà) → idee data-driven nel Brain.</p>
            <ScopriKeyword />
          </div>
        )}
        {tab === "ai" && <AiBrainstormForm />}
        {tab === "manuale" && <ManualIdeaForm />}
      </Card>
    </div>
  );
}
