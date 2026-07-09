import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";

export default function ImpostazioniPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Impostazioni" subtitle="Configurazione del sistema." />
      <Link href="/impostazioni/chiavi-api" className="block">
        <Card interactive className="p-4">
          <h2 className="text-base font-semibold">Chiavi API</h2>
          <p className="text-sm text-neutral-500">Credenziali AI, Shopify e Meta — configurabili senza toccare il file .env.</p>
        </Card>
      </Link>
    </div>
  );
}
