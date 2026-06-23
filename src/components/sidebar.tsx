"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isActive } from "@/lib/nav/items";

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="w-60 shrink-0 border-r bg-neutral-50 p-4">
      <div className="mb-6 px-2 text-sm font-semibold text-neutral-900">AGOCAP Content AI Hub</div>
      <nav className="space-y-1 text-sm">
        {navItems.map((area) => {
          const active = isActive(pathname, area.href);
          return (
            <div key={area.href}>
              <Link
                href={area.href}
                className={`flex items-center gap-2 rounded px-2 py-1.5 ${active ? "bg-blue-600 text-white" : "text-neutral-700 hover:bg-neutral-200"}`}
              >
                <span aria-hidden>{area.icon}</span>
                <span>{area.label}</span>
              </Link>
              {area.children && active && (
                <div className="ml-7 mt-1 space-y-0.5">
                  {area.children.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`block rounded px-2 py-1 text-xs ${pathname === sub.href ? "font-medium text-blue-700" : "text-neutral-600 hover:text-neutral-900"}`}
                    >
                      {sub.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
