import Link from "next/link";
import { MetaContentTable } from "@/components/meta-content-table";

export const dynamic = "force-dynamic";

export default function MetaDashboardPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Area Meta</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/meta/calendario" className="rounded border px-3 py-1">Calendario</Link>
          <Link href="/meta/genera" className="rounded bg-blue-600 px-3 py-1 text-white">Genera da idea</Link>
        </div>
      </div>
      <MetaContentTable />
    </div>
  );
}
