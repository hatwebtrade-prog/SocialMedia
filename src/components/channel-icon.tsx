import { FaInstagram, FaFacebook, FaTiktok, FaBlog, FaEnvelope } from "react-icons/fa";
import type { IconType } from "react-icons";

const ICONS: Record<string, { Icon: IconType; color: string; label: string }> = {
  INSTAGRAM: { Icon: FaInstagram, color: "#E1306C", label: "Instagram" },
  FACEBOOK: { Icon: FaFacebook, color: "#1877F2", label: "Facebook" },
  META: { Icon: FaFacebook, color: "#1877F2", label: "Meta" },
  TIKTOK: { Icon: FaTiktok, color: "#000000", label: "TikTok" },
  BLOG: { Icon: FaBlog, color: "#16a34a", label: "Blog" },
  EMAIL: { Icon: FaEnvelope, color: "#d97706", label: "Email" },
};

export function isKnownChannel(channel: string): boolean {
  return channel in ICONS;
}

export function ChannelIcon({ channel }: { channel: string }) {
  const def = ICONS[channel];
  if (!def) return <span className="text-xs text-neutral-500">{channel}</span>;
  const { Icon, color, label } = def;
  return <Icon title={label} aria-label={label} style={{ color }} className="inline-block" />;
}

export function ChannelIcons({ channels }: { channels: string[] }) {
  if (!channels?.length) return <span className="text-neutral-400">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {channels.map((c) => <ChannelIcon key={c} channel={c} />)}
    </span>
  );
}
