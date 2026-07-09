import Link from "next/link";
import { EmailContentTable } from "@/components/email-content-table";

export const dynamic = "force-dynamic";

export default function EmailPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Email Marketing</h1>
        <Link href="/email/genera" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera email da idea</Link>
      </div>
      <EmailContentTable />
    </div>
  );
}
