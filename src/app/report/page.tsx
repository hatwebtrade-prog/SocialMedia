"use client";

import { useEffect, useState } from "react";

interface Summary {
  statusCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  alerts: string[];
}

export default function ReportPage() {
  const [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/report/summary").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p>Caricamento…</p>;
  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 text-2xl font-semibold">Report & Alert</h1>
      <section className="mb-6">
        <h2 className="mb-2 font-medium">Idee per stato</h2>
        <ul className="text-sm">{Object.entries(data.statusCounts).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
      </section>
      <section className="mb-6">
        <h2 className="mb-2 font-medium">Idee per categoria</h2>
        <ul className="text-sm">{Object.entries(data.categoryCounts).map(([k, v]) => <li key={k}>{k}: {v}</li>)}</ul>
      </section>
      <section>
        <h2 className="mb-2 font-medium">Alert</h2>
        {data.alerts.length === 0 ? <p className="text-sm text-green-700">Nessun alert.</p> : (
          <ul className="space-y-1 text-sm text-amber-700">{data.alerts.map((a, idx) => <li key={idx}>⚠️ {a}</li>)}</ul>
        )}
      </section>
    </div>
  );
}
