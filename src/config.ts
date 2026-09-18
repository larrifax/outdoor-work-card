import type { CardConfig, HassLike, Mode, TaskConfig } from "./types";
import { parseHM } from "./time";
import { pickLang, strings, dayNames, type Lang, type DayNames } from "./i18n";

export function defaultTasks(t: ReturnType<typeof strings>): TaskConfig[] {
  return [
    { name: t.taskMow, before: 24 },
    { name: t.taskPaint, before: 24, after: 24 },
  ];
}

export interface Resolved {
  lang: Lang;
  names: DayNames;
  mode: Mode;
  title: string;
  subtitle: string;
  lat: number;
  lon: number;
  tz: string;
  model: string;
  days: number;
  refreshMs: number;
  accent: string;
  // work
  weekdayStart: number;
  weekendStart: number;
  windowEnd: "dusk" | "sunset" | number;
  minWindowMinutes: number;
  rainThreshold: number;
  tasks: TaskConfig[];
  // wash
  washStart: number;
  okRain: number;
  nightMax: number;
  nightFrom: number;
  nightUntil: number;
  leadHours: number;
}

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export function resolve(c: CardConfig, hass: HassLike | undefined): Resolved {
  const lang = pickLang(hass);
  const t = strings(lang);
  const names = dayNames(lang);
  const mode: Mode = c.mode === "carwash" ? "carwash" : "work";
  const lat = num(c.latitude, hass?.config?.latitude ?? 59.91, -90, 90);
  const lon = num(c.longitude, hass?.config?.longitude ?? 10.75, -180, 180);
  const tz = hass?.config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  let windowEnd: "dusk" | "sunset" | number = "dusk";
  if (c.window_end === "sunset") windowEnd = "sunset";
  else if (c.window_end && /^\d{1,2}:\d{2}/.test(c.window_end))
    windowEnd = parseHM(c.window_end, "22:00");

  const tasks =
    Array.isArray(c.tasks) && c.tasks.length
      ? c.tasks.slice(0, 4).map((tc, i) => ({
          name: String(tc?.name ?? `Task ${i + 1}`).slice(0, 12),
          before: num(tc?.before, 24, 0, 168),
          after:
            tc?.after === undefined || tc?.after === null ? undefined : num(tc.after, 24, 0, 168),
        }))
      : defaultTasks(t);

  return {
    lang,
    names,
    mode,
    title: c.title ?? (mode === "carwash" ? t.defWashTitle : t.defWorkTitle),
    subtitle: c.subtitle ?? (mode === "carwash" ? t.defWashSub : t.defWorkSub),
    lat,
    lon,
    tz,
    model: c.model || "metno_seamless",
    days: Math.round(num(c.days, 7, 3, 10)),
    refreshMs: num(c.refresh_minutes, 60, 10, 720) * 60_000,
    accent: c.accent || (mode === "carwash" ? "#38bdf8" : "#34d399"),
    weekdayStart: parseHM(c.weekday_start, "18:00"),
    weekendStart: parseHM(c.weekend_start, "10:00"),
    windowEnd,
    minWindowMinutes: num(c.min_window_minutes, 45, 0, 600),
    rainThreshold: num(c.rain_threshold, 0.2, 0, 10),
    tasks,
    washStart: parseHM(c.wash_start, "18:00"),
    okRain: num(c.ok_rain, 0.5, 0, 20),
    nightMax: num(c.night_max, 4, 0, 50),
    nightFrom: parseHM(c.night_from, "22:00"),
    nightUntil: parseHM(c.night_until, "06:00"),
    leadHours: num(c.dry_roads_hours, 2, 0, 24),
  };
}
