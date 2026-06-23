import Link from "next/link";
const links = [
  { href: "/dashboard", label: "Dashboard Idee" },
  { href: "/generate", label: "Genera Idee" },
  { href: "/brain/scopri", label: "Scopri keyword" },
  { href: "/manual", label: "Inserimento Manuale" },
  { href: "/knowledge", label: "Knowledge Base" },
  { href: "/report", label: "Report" },
  { href: "/meta", label: "Area Meta" },
];
export function Nav() {
  return (
    <nav className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl gap-4 p-4 text-sm">
        <span className="font-semibold">AGOCAP Brain</span>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-neutral-600 hover:text-neutral-900">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
