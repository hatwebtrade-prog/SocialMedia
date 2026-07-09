import Link from "next/link";
import { BlogContentTable } from "@/components/blog-content-table";

export const dynamic = "force-dynamic";

export default function BlogPage() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Blog</h1>
        <div className="flex items-center gap-3">
          <Link href="/blog/cestino" className="text-sm text-neutral-600 hover:underline">Cestino</Link>
          <Link href="/blog/genera" className="rounded bg-blue-600 px-3 py-1 text-sm text-white">Genera articolo da idea</Link>
        </div>
      </div>
      <BlogContentTable />
    </div>
  );
}
