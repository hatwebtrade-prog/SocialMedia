"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isActive } from "@/lib/nav/items";
import { navIcon } from "@/lib/nav/icons";
import { LuLeaf } from "react-icons/lu";

export function Sidebar() {
  const pathname = usePathname() ?? "/";
  return (
    <aside className="w-60 shrink-0 border-r border-sand-200 bg-sand-50 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <LuLeaf className="text-sage-600" aria-hidden />
        <span className="font-display text-base font-semibold text-ink">AGOCAP</span>
      </div>
      <nav className="space-y-1 text-sm">
        {navItems.map((area) => {
          const active = isActive(pathname, area.href);
          const Icon = navIcon(area.icon);
          return (
            <div key={area.href}>
              <Link
                href={area.href}
                className={`relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition ${active ? "bg-sage-100 font-medium text-sage-700" : "text-ink-soft hover:bg-sand-100"}`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-sage-500" aria-hidden />}
                <Icon className="shrink-0" aria-hidden />
                <span>{area.label}</span>
              </Link>
              {area.children && active && (
                <div className="ml-8 mt-1 space-y-0.5">
                  {area.children.map((sub) => (
                    <Link
                      key={sub.href}
                      href={sub.href}
                      className={`block rounded-lg px-2 py-1 text-xs transition ${pathname === sub.href ? "font-medium text-sage-700" : "text-ink-soft hover:text-ink"}`}
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
