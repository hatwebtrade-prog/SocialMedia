export function channelColor(channel: string): string {
  switch (channel) {
    case "META": return "bg-blue-100 text-blue-800";
    case "BLOG": return "bg-green-100 text-green-800";
    case "TIKTOK": return "bg-purple-100 text-purple-800";
    case "EMAIL": return "bg-amber-100 text-amber-800";
    default: return "bg-neutral-100 text-neutral-700";
  }
}

export function contentHref(channel: string, contentId: string): string {
  if (channel === "META") return `/meta/${contentId}`;
  if (channel === "BLOG") return `/blog/${contentId}`;
  return "#";
}

export interface CalendarEntry {
  id: string;
  contentId: string;
  scheduledAt: string;
  channel: string;
  status: string;
  titolo: string;
  href: string;
}

interface RawItem {
  id: string;
  contentId: string;
  scheduledAt: Date | string;
  channel: string;
  content: { status: string; payload: unknown; idea: { titolo: string } | null };
}

export function toCalendarEntry(item: RawItem): CalendarEntry {
  const titolo = (item.content.payload as { titoloSeo?: string } | null)?.titoloSeo ?? item.content.idea?.titolo ?? "Contenuto";
  return {
    id: item.id,
    contentId: item.contentId,
    scheduledAt: new Date(item.scheduledAt).toISOString(),
    channel: item.channel,
    status: item.content.status,
    titolo,
    href: contentHref(item.channel, item.contentId),
  };
}
