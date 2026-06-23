import { IdeaTable } from "@/components/idea-table";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Dashboard Idee</h1>
      <IdeaTable />
    </div>
  );
}
