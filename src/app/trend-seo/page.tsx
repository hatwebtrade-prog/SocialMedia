import { ScopriKeyword } from "@/components/scopri-keyword";

export default function TrendSeoPage() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Trend & SEO</h1>
      <p className="mb-4 text-sm text-neutral-500">Analizza keyword reali da SEOZoom (volume, difficoltà) e genera idee che entrano nel Brain.</p>
      <h2 className="mb-2 font-medium">Scopri keyword</h2>
      <ScopriKeyword />
    </div>
  );
}
