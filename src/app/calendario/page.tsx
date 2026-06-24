import { CalendarBoard } from "@/components/calendar-board";

export const dynamic = "force-dynamic";

export default function CalendarioPage() {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Calendario Editoriale</h1>
      <CalendarBoard />
    </div>
  );
}
