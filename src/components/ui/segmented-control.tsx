export function SegmentedControl<T extends string>({
  options, value, onChange, className = "",
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={`inline-flex rounded-xl bg-sand-100 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${value === o.value ? "bg-surface text-sage-700 shadow-soft" : "text-ink-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
