import type { CardConfig, HassLike, Mode, TaskConfig } from "./types";
import { parseHM } from "./time";
import { PRESETS } from "./commute";
import { pickLang, strings, dayNames, type Lang, type DayNames } from "./i18n";

export function defaultTasks(t: ReturnType<typeof strings>): TaskConfig[] {
  return [
    { name: t.taskMow, max_wet: 0.3 },
    { name: t.taskPaint, max_wet: 0.1, after: 24 },
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
  dryRoadsHours: number;
  nightFrom: number;
  nightUntil: number;
  /** Parked-indoors window on workdays, null when not configured. */
  parked: [number, number] | null;
  // commute
  toWork: [number, number];
  home: [number, number];
  midday: [number, number];
  rainFine: number;
  rainOk: number;
  windFine: number;
  windOk: number;
  workdays: number[];
}

/** Unknown or missing mode falls back to work. */
export const parseMode = (m: unknown): Mode => (m === "carwash" || m === "commute" ? m : "work");

/** minutes-after-midnight → "HH:MM" */
export const fmt = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const num = (v: unknown, d: number, min = -Infinity, max = Infinity) => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

const HM = /^\d{1,2}:\d{2}(:\d{2})?$/;
/** Both ends must be valid "HH:MM" and differ, else no parked window. */
const parkedWindow = (a: unknown, b: unknown): [number, number] | null => {
  if (typeof a !== "string" || typeof b !== "string" || !HM.test(a) || !HM.test(b)) return null;
  const s = parseHM(a, "00:00");
  const e = parseHM(b, "00:00");
  return s === e ? null : [s, e];
};

export function resolve(c: CardConfig, hass: HassLike | undefined): Resolved {
  const lang = pickLang(hass);
  const t = strings(lang);
  const names = dayNames(lang);
  const mode = parseMode(c.mode);
  const lat = num(c.latitude, hass?.config?.latitude ?? 59.91, -90, 90);
  const lon = num(c.longitude, hass?.config?.longitude ?? 10.75, -180, 180);
  const tz = hass?.config?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  let windowEnd: "dusk" | "sunset" | number = "dusk";
  if (c.window_end === "sunset") windowEnd = "sunset";
  else if (c.window_end && /^\d{1,2}:\d{2}/.test(c.window_end))
    windowEnd = parseHM(c.window_end, "22:00");

  // commute windows: end always after start
  const span = (
    a: string | undefined,
    b: string | undefined,
    da: string,
    db: string,
  ): [number, number] => {
    const s = parseHM(a, da);
    let e = parseHM(b, db);
    if (e <= s) e = s + 60;
    return [s, e];
  };
  const toWork = span(c.to_work_start, c.to_work_end, "07:00", "09:00");
  const home = span(c.home_start, c.home_end, "16:00", "18:00");
  const midday = span(c.midday_start, c.midday_end, "09:00", "15:00");
  const workdays =
    Array.isArray(c.workdays) && c.workdays.length
      ? [...new Set(c.workdays.map((n) => Math.round(num(n, 1, 1, 7))))].sort()
      : [1, 2, 3, 4, 5];
  const def = PRESETS.everyday;
  const rainFine = num(c.rain_fine, def.rainFine, 0, 20);
  const windFine = num(c.wind_fine, def.windFine, 0, 40);

  const tasks =
    Array.isArray(c.tasks) && c.tasks.length
      ? c.tasks.slice(0, 4).map((tc, i) => ({
          name: String(tc?.name ?? `Task ${i + 1}`).slice(0, 12),
          // Pre-2.0 `before` (hours) is ignored.
          max_wet: num(tc?.max_wet, 0.3, 0, 5),
          after:
            tc?.after === undefined || tc?.after === null ? undefined : num(tc.after, 24, 0, 168),
        }))
      : defaultTasks(t);

  return {
    lang,
    names,
    mode,
    title:
      c.title ??
      (
        {
          carwash: t.defWashTitle,
          commute: t.defCommuteTitle,
          work: t.defWorkTitle,
        } satisfies Record<Mode, string>
      )[mode],
    subtitle:
      c.subtitle ??
      (
        {
          carwash: t.defWashSub,
          commute: t.defCommuteSub(fmt(toWork[0]), fmt(toWork[1]), fmt(home[0]), fmt(home[1])),
          work: t.defWorkSub,
        } satisfies Record<Mode, string>
      )[mode],
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
    okRain: num(c.ok_rain, 0.2, 0, 5),
    dryRoadsHours: num(c.dry_roads_hours, 3, 0, 24),
    nightFrom: parseHM(c.night_from, "22:00"),
    nightUntil: parseHM(c.night_until, "06:00"),
    parked: parkedWindow(c.parked_start, c.parked_end),
    toWork,
    home,
    midday,
    rainFine,
    rainOk: Math.max(rainFine, num(c.rain_ok, def.rainOk, 0, 20)),
    windFine,
    windOk: Math.max(windFine, num(c.wind_ok, def.windOk, 0, 40)),
    workdays,
  };
}
