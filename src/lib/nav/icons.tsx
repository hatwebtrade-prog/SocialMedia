import {
  LuHouse, LuBrain, LuTrendingUp, LuInstagram, LuFileText, LuVideo,
  LuMail, LuCalendar, LuRocket, LuChartBar, LuBookOpen, LuSettings, LuCircle,
} from "react-icons/lu";
import type { IconType } from "react-icons";

const ICONS: Record<string, IconType> = {
  home: LuHouse, brain: LuBrain, trend: LuTrendingUp, meta: LuInstagram,
  blog: LuFileText, tiktok: LuVideo, email: LuMail, calendar: LuCalendar,
  publish: LuRocket, report: LuChartBar, knowledge: LuBookOpen, settings: LuSettings,
};

export function navIcon(key: string): IconType {
  return ICONS[key] ?? LuCircle;
}
