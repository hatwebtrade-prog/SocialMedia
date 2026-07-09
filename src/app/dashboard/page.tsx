import Link from "next/link";
import { IdeaWorkspace } from "@/components/idea-table";
import { PageHeader, Button } from "@/components/ui";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <PageHeader
        title="Brain — Idee"
        subtitle="Sposta le idee tra le colonne per cambiarne lo stato editoriale."
        actions={<Link href="/genera"><Button>+ Genera idee</Button></Link>}
      />
      <IdeaWorkspace />
    </div>
  );
}
