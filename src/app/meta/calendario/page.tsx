import Link from "next/link";
import { MetaCalendar } from "@/components/meta-calendar";

export const dynamic = "force-dynamic";

export default function MetaCalendarPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendario Meta</h1>
        <Link href="/meta" className="rounded border px-3 py-1 text-sm">Lista</Link>
      </div>
      <MetaCalendar />
    </div>
  );
}
