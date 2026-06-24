"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { channelColor, type CalendarEntry } from "@/lib/calendar/helpers";
import { StatusBadge } from "@/components/status-badge";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

type View = "mese" | "settimana" | "agenda";
const CHANNELS = ["META", "BLOG", "TIKTOK", "EMAIL"];
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface Unscheduled { id: string; canale: string; titolo: string; }

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
const startOfWeek = (d: Date) => { const x = new Date(d); const D = (x.getDay() + 6) % 7; x.setDate(x.getDate() - D); x.setHours(0, 0, 0, 0); return x; };
const endOfWeek = (d: Date) => { const s = startOfWeek(d); const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59); return e; };
const ymd = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const sameDay = (iso: string, d: Date) => { const x = new Date(iso); return x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth() && x.getDate() === d.getDate(); };

export function CalendarBoard() {
  const [view, setView] = useState<View>("mese");
  const [cursor, setCursor] = useState(() => new Date());
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState<CalendarEntry[]>([]);
  const [unscheduled, setUnscheduled] = useState<Unscheduled[]>([]);

  const [from, to] = view === "settimana" ? [startOfWeek(cursor), endOfWeek(cursor)] : [startOfMonth(cursor), endOfMonth(cursor)];

  const loadItems = useCallback(async () => {
    const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
    if (channel) qs.set("channel", channel);
    if (status) qs.set("status", status);
    try {
      const res = await fetch(`/api/calendar?${qs.toString()}`);
      const d = await res.json();
      setItems(Array.isArray(d) ? d : []);
    } catch { setItems([]); }
  }, [from, to, channel, status]);

  const loadUnscheduled = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/unscheduled");
      const d = await res.json();
      setUnscheduled(Array.isArray(d) ? d : []);
    } catch { setUnscheduled([]); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadUnscheduled(); }, [loadUnscheduled]);

  const refresh = () => { loadItems(); loadUnscheduled(); };

  const schedule = async (contentId: string, date: string) => {
    if (!date) return;
    await fetch("/api/calendar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, scheduledAt: new Date(date).toISOString() }) });
    refresh();
  };
  const move = async (id: string, date: string) => {
    if (!date) return;
    await fetch(`/api/calendar/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ scheduledAt: new Date(date).toISOString() }) });
    refresh();
  };
  const remove = async (id: string) => {
    await fetch(`/api/calendar/${id}`, { method: "DELETE" });
    refresh();
  };

  const step = (dir: number) => setCursor((c) => {
    const n = new Date(c);
    if (view === "settimana") n.setDate(n.getDate() + dir * 7);
    else n.setMonth(n.getMonth() + dir);
    return n;
  });

  const label = view === "settimana"
    ? `Settimana del ${startOfWeek(cursor).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}`
    : cursor.toLocaleDateString("it-IT", { month: "long", year: "numeric" });

  const Pill = ({ e }: { e: CalendarEntry }) => (
    <Link href={e.href} className={`mb-1 block truncate rounded px-1 py-0.5 text-xs ${channelColor(e.channel)}`} title={`${e.channel} · ${e.titolo}`}>
      {e.titolo}
    </Link>
  );

  const renderMese = () => {
    const first = startOfMonth(cursor);
    const startDay = (first.getDay() + 6) % 7;
    const days = endOfMonth(cursor).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < startDay; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return (
      <div className="grid grid-cols-7 gap-px bg-neutral-200 text-sm">
        {GIORNI.map((g) => <div key={g} className="bg-neutral-100 p-2 text-center text-neutral-500">{g}</div>)}
        {cells.map((d, i) => {
          const dayDate = d ? new Date(cursor.getFullYear(), cursor.getMonth(), d) : null;
          return (
            <div key={i} className="min-h-24 bg-white p-1 align-top">
              {d && <div className="mb-1 text-xs text-neutral-400">{d}</div>}
              {dayDate && items.filter((e) => sameDay(e.scheduledAt, dayDate)).map((e) => <Pill key={e.id} e={e} />)}
            </div>
          );
        })}
      </div>
    );
  };

  const renderSettimana = () => {
    const s = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(s); x.setDate(s.getDate() + i); return x; });
    return (
      <div className="grid grid-cols-7 gap-px bg-neutral-200 text-sm">
        {days.map((d, i) => (
          <div key={i} className="min-h-40 bg-white p-1">
            <div className="mb-1 text-xs text-neutral-500">{GIORNI[i]} {d.getDate()}</div>
            {items.filter((e) => sameDay(e.scheduledAt, d)).map((e) => <Pill key={e.id} e={e} />)}
          </div>
        ))}
      </div>
    );
  };

  const renderAgenda = () => {
    if (items.length === 0) return <p className="text-sm text-neutral-500">Nessun contenuto programmato in questo periodo.</p>;
    return (
      <div className="space-y-2 text-sm">
        {items.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 border-b py-2">
            <span className="w-28 shrink-0 text-neutral-500">{new Date(e.scheduledAt).toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}</span>
            <span className={`rounded px-1.5 text-xs ${channelColor(e.channel)}`}>{e.channel}</span>
            <Link href={e.href} className="text-blue-600 hover:underline">{e.titolo}</Link>
            <StatusBadge status={e.status} />
            <input type="date" defaultValue={ymd(e.scheduledAt)} onChange={(ev) => move(e.id, ev.target.value)} className="ml-auto rounded border p-0.5 text-xs" />
            <button onClick={() => remove(e.id)} className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-700">Rimuovi</button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          {(["mese", "settimana", "agenda"] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded px-3 py-1 capitalize ${view === v ? "bg-blue-600 text-white" : "border"}`}>{v}</button>
          ))}
          <button onClick={() => step(-1)} className="ml-2 rounded border px-2 py-1">←</button>
          <span className="font-medium capitalize">{label}</span>
          <button onClick={() => step(1)} className="rounded border px-2 py-1">→</button>
          <select value={channel} onChange={(e) => setChannel(e.target.value)} className="ml-3 rounded border p-1">
            <option value="">Tutti i canali</option>
            {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded border p-1">
            <option value="">Tutti gli stati</option>
            {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-neutral-500">
          {CHANNELS.map((c) => <span key={c} className={`rounded px-1.5 py-0.5 ${channelColor(c)}`}>{c}</span>)}
        </div>
        {view === "mese" && renderMese()}
        {view === "settimana" && renderSettimana()}
        {view === "agenda" && renderAgenda()}
      </div>

      <aside className="w-64 shrink-0">
        <h2 className="mb-2 text-sm font-semibold">Da programmare</h2>
        {unscheduled.length === 0 ? <p className="text-sm text-neutral-500">Nessun contenuto approvato da programmare.</p> : (
          <div className="space-y-3 text-sm">
            {unscheduled.map((u) => (
              <div key={u.id} className="rounded border p-2">
                <div className="mb-1"><span className={`mr-1 rounded px-1 text-xs ${channelColor(u.canale)}`}>{u.canale}</span>{u.titolo}</div>
                <input type="date" onChange={(e) => schedule(u.id, e.target.value)} className="w-full rounded border p-0.5 text-xs" />
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}
