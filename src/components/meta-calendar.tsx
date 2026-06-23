"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Content { id: string; status: string; dataPrevista: string | null; idea?: { titolo: string } | null; }

export function MetaCalendar() {
  const [items, setItems] = useState<Content[]>([]);
  const [cursor, setCursor] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });

  useEffect(() => {
    fetch("/api/meta/contents").then((r) => r.json()).then(setItems);
  }, []);

  const first = new Date(cursor.y, cursor.m, 1);
  const startDay = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const byDay = (d: number) =>
    items.filter((c) => {
      if (!c.dataPrevista) return false;
      const dt = new Date(c.dataPrevista);
      return dt.getFullYear() === cursor.y && dt.getMonth() === cursor.m && dt.getDate() === d;
    });

  const monthLabel = first.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  const prev = () => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const next = () => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));

  return (
    <div>
      <div className="mb-3 flex items-center gap-4">
        <button onClick={prev} className="rounded border px-3 py-1">←</button>
        <span className="font-medium capitalize">{monthLabel}</span>
        <button onClick={next} className="rounded border px-3 py-1">→</button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-neutral-200 text-sm">
        {["Lun","Mar","Mer","Gio","Ven","Sab","Dom"].map((d) => (
          <div key={d} className="bg-neutral-100 p-2 text-center text-neutral-500">{d}</div>
        ))}
        {cells.map((d, i) => (
          <div key={i} className="min-h-24 bg-white p-1 align-top">
            {d && <div className="mb-1 text-xs text-neutral-400">{d}</div>}
            {d && byDay(d).map((c) => (
              <Link key={c.id} href={`/meta/${c.id}`} className="mb-1 block truncate rounded bg-blue-50 px-1 py-0.5 text-xs text-blue-700 hover:bg-blue-100">
                {c.idea?.titolo ?? "Contenuto"}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
