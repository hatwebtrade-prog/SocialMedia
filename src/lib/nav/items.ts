export interface NavSub { label: string; href: string; }
export interface NavArea { label: string; href: string; icon: string; children?: NavSub[]; }

export const navItems: NavArea[] = [
  { label: "Home", href: "/", icon: "🏠" },
  {
    label: "Brain", href: "/dashboard", icon: "🧠",
    children: [
      { label: "Tutte le idee", href: "/dashboard" },
      { label: "Genera idee", href: "/generate" },
      { label: "Inserimento manuale", href: "/manual" },
    ],
  },
  { label: "Trend & SEO", href: "/trend-seo", icon: "📈" },
  { label: "Meta", href: "/meta", icon: "📱" },
  { label: "Blog", href: "/blog", icon: "✍️" },
  { label: "TikTok", href: "/tiktok", icon: "🎬" },
  { label: "Email", href: "/email", icon: "✉️" },
  { label: "Calendario", href: "/calendario", icon: "🗓️" },
  { label: "Pubblicazioni", href: "/pubblicazioni", icon: "🚀" },
  { label: "Report", href: "/report", icon: "📊" },
  { label: "Knowledge Base", href: "/knowledge", icon: "📚" },
  { label: "Impostazioni", href: "/impostazioni", icon: "⚙️" },
];

/** True when `href` is the current area for `pathname`. Home (/) matches only exactly. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
