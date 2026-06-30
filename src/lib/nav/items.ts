export interface NavSub { label: string; href: string; }
export interface NavArea { label: string; href: string; icon: string; children?: NavSub[]; }

export const navItems: NavArea[] = [
  { label: "Home", href: "/", icon: "home" },
  {
    label: "Brain", href: "/dashboard", icon: "brain",
    children: [
      { label: "Tutte le idee", href: "/dashboard" },
      { label: "Genera idee", href: "/genera" },
      { label: "Trend & SEO", href: "/trend-seo" },
      { label: "Cestino", href: "/cestino" },
    ],
  },
  { label: "Meta", href: "/meta", icon: "meta" },
  { label: "Blog", href: "/blog", icon: "blog" },
  { label: "TikTok", href: "/tiktok", icon: "tiktok" },
  { label: "Email", href: "/email", icon: "email" },
  { label: "Calendario", href: "/calendario", icon: "calendar" },
  { label: "Pubblicazioni", href: "/pubblicazioni", icon: "publish" },
  { label: "Report", href: "/report", icon: "report" },
  { label: "Knowledge Base", href: "/knowledge", icon: "knowledge" },
  { label: "Impostazioni", href: "/impostazioni", icon: "settings" },
];

/** True when `href` is the current area for `pathname`. Home (/) matches only exactly. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
