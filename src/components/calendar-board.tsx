"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { channelColor, type CalendarEntry } from "@/lib/calendar/helpers";
import { StatusBadge } from "@/components/status-badge";
import { CONTENT_STATUSES } from "@/lib/meta/enums";

type View = "mese" | "settimana" | "agenda";
const CHANNELS = ["META", "BLOG", "TIKTOK", "EMAIL"];
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

interface Unscheduled { id: string; canale: string; titolo: string; }
interface ContentDetail { id: string; canale: string; status: string; titolo: string; caption?: string; imageUrl?: string; }

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
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [detail, setDetail] = useState<ContentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  // Memoizzato: senza questo `from`/`to` sono nuove Date a ogni render → loadItems
  // cambia identità → l'effetto rifà la fetch all'infinito (loop di re-render).
  const [from, to] = useMemo<[Date, Date]>(
    () => (view === "settimana" ? [startOfWeek(cursor), endOfWeek(cursor)] : [startOfMonth(cursor), endOfMonth(cursor)]),
    [view, cursor],
  );

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

  const contentEndpoint = (channel: string, contentId: string) =>
    channel === "META" ? `/api/meta/contents/${contentId}`
    : channel === "BLOG" ? `/api/blog/contents/${contentId}`
    : null;

  const fetchDetail = useCallback(async (entry: CalendarEntry) => {
    setDetailLoading(true);
    setDetail(null);
    const fallback: ContentDetail = { id: entry.contentId, canale: entry.channel, status: entry.status, titolo: entry.titolo };
    try {
      const endpoint = contentEndpoint(entry.channel, entry.contentId);
      if (!endpoint) { setDetail(fallback); return; }
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error();
      const d = await res.json();
      const withPath = Array.isArray(d.assets) ? d.assets.find((a: { path?: string }) => a.path) ?? d.assets[0] : null;
      setDetail({
        id: d.id, canale: entry.channel, status: d.status ?? entry.status, titolo: entry.titolo,
        caption: d.payload?.caption ?? d.payload?.titoloSeo ?? undefined,
        imageUrl: withPath?.id ? `/api/assets/${withPath.id}` : undefined,
      });
    } catch {
      setDetail(fallback);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const onSelectEntry = useCallback((entry: CalendarEntry) => {
    setSelected(entry);
    fetchDetail(entry);
  }, [fetchDetail]);

  const approveContent = useCallback(async () => {
    if (!selected) return;
    const endpoint = contentEndpoint(selected.channel, selected.contentId);
    if (!endpoint) return;
    setActionBusy(true);
    try {
      const res = await fetch(endpoint, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: "APPROVATO" }) });
      if (res.ok) { setDetail((d) => d ? { ...d, status: "APPROVATO" } : d); loadItems(); }
    } finally {
      setActionBusy(false);
    }
  }, [selected, loadItems]);

  const removeFromCalendar = useCallback(async () => {
    if (!selected) return;
    setActionBusy(true);
    try { await remove(selected.id); setSelected(null); }
    finally { setActionBusy(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

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
    <button type="button" onClick={() => onSelectEntry(e)} className={`mb-1 block w-full truncate rounded px-1 py-0.5 text-left text-xs ${channelColor(e.channel)}`} title={`${e.channel} · ${e.titolo}`}>
      {e.titolo}
    </button>
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

      {selected && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={() => setSelected(null)}>
          <div className="h-full w-96 max-w-full overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <span className={`rounded px-1.5 py-0.5 text-xs ${channelColor(selected.channel)}`}>{selected.channel}</span>
                <h2 className="mt-1 text-base font-semibold">{selected.titolo}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded p-1 text-neutral-400 hover:text-neutral-700" aria-label="Chiudi">✕</button>
            </div>

            {detailLoading ? (
              <p className="text-sm text-neutral-500">Caricamento…</p>
            ) : (
              <div className="space-y-3 text-sm">
                {detail?.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={detail.imageUrl} alt={selected.titolo} className="w-full rounded border border-neutral-200" />
                ) : null}
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Stato:</span>
                  <StatusBadge status={detail?.status ?? selected.status} />
                </div>
                {detail?.caption ? <p className="whitespace-pre-wrap text-neutral-700">{detail.caption}</p> : null}
                <span className="block text-xs text-neutral-400">Programmato: {new Date(selected.scheduledAt).toLocaleString("it-IT", { dateStyle: "medium", timeStyle: "short" })}</span>

                <div className="flex flex-col gap-2 pt-2">
                  {(detail?.status ?? selected.status) !== "APPROVATO" ? (
                    <button onClick={approveContent} disabled={actionBusy} className="rounded bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-50">
                      {actionBusy ? "…" : "Approva"}
                    </button>
                  ) : null}
                  <Link href={selected.href} className="rounded border border-neutral-300 px-3 py-2 text-center text-sm hover:bg-neutral-50">Vai al contenuto</Link>
                  <button onClick={removeFromCalendar} disabled={actionBusy} className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Rimuovi dal calendario</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
