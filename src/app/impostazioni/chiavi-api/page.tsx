import { PageHeader } from "@/components/ui";
import { ApiKeysForm } from "@/components/settings/api-keys-form";

export default function ChiaviApiPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Chiavi API"
        subtitle="Configura le credenziali di AI, Shopify e Meta. I valori salvati qui hanno precedenza sul file .env."
      />
      <ApiKeysForm />
    </div>
  );
}
