export function ComingSoon({ title, descrizione }: { title: string; descrizione: string }) {
  return (
    <div>
      <h1 className="mb-2 text-2xl font-semibold">{title}</h1>
      <div className="rounded-lg border border-dashed bg-neutral-50 p-8 text-center">
        <p className="mb-1 font-medium text-neutral-700">Area in arrivo</p>
        <p className="text-sm text-neutral-500">{descrizione}</p>
      </div>
    </div>
  );
}
