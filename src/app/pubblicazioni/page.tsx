import { PublicationsTable } from "@/components/publications-table";

export const dynamic = "force-dynamic";

export default function PubblicazioniPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Pubblicazioni</h1>
      <PublicationsTable />
    </div>
  );
}
