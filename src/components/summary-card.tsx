import Link from "next/link";

export function SummaryCard({
  title, icon, rows, ctaHref, ctaLabel, soon,
}: {
  title: string; icon: string; rows: { label: string; value: number | string }[];
  ctaHref: string; ctaLabel: string; soon?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-semibold"><span aria-hidden>{icon}</span>{title}</h2>
        {soon && <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">in arrivo</span>}
      </div>
      <dl className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <dt className="text-neutral-500">{r.label}</dt>
            <dd className="font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      <Link href={ctaHref} className="mt-3 inline-block text-sm text-blue-600 hover:underline">{ctaLabel} →</Link>
    </div>
  );
}
