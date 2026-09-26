/**
 * Time-zone aware helpers. The card must reason in the *home's* time zone
 * (hass.config.time_zone), not the browser's — a wall tablet and a phone
 * abroad should agree on what "18:00" means.
 */

export interface LocalParts {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
  h: number; // 0-23
  mi: number;
  /** 0 = Sunday … 6 = Saturday */
  wd: number;
  /** "YYYY-MM-DD" in the zone */
  key: string;
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localParts(ms: number, tz: string): LocalParts {
  const parts = fmt(tz).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = +get("year");
  const m = +get("month");
  const d = +get("day");
  const h = +get("hour") % 24;
  const mi = +get("minute");
  const wd = WD[get("weekday")] ?? 0;
  return {
    y,
    m,
    d,
    h,
    mi,
    wd,
    key: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  };
}

/** UTC ms for a wall-clock time in `tz`. Handles DST via two correction passes. */
export function zonedToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): number {
  let guess = Date.UTC(y, m - 1, d, h, mi);
  for (let i = 0; i < 2; i++) {
    const p = localParts(guess, tz);
    const got = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    const want = Date.UTC(y, m - 1, d, h, mi);
    guess += want - got;
  }
  return guess;
}

/** UTC ms for `min` minutes after local midnight of the local date in `p`. */
export function zonedMin(p: { y: number; m: number; d: number }, min: number, tz: string): number {
  return zonedToUtc(p.y, p.m, p.d, Math.floor(min / 60), min % 60, tz);
}

/** Weekday 0 = Sun … 6 = Sat → ISO 1 = Mon … 7 = Sun. */
export const isoWd = (wd: number): number => (wd === 0 ? 7 : wd);

/** Parse "HH:MM" → minutes since midnight. Returns null when malformed. */
export function parseHM(s: string | undefined, fallback: string): number {
  const str = (s && /^\d{1,2}:\d{2}(:\d{2})?$/.test(s) ? s : fallback).split(":");
  return Math.min(23, +str[0]!) * 60 + Math.min(59, +(str[1] ?? 0));
}

export function hm(ms: number, tz: string): string {
  const p = localParts(ms, tz);
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function hoursBetween(a: number, b: number): number {
  return (b - a) / 3_600_000;
}

/** "2h11" style duration label. `unit` is the hour marker ("h" / "t"). */
export function durLabel(hours: number, unit = "h"): string {
  if (hours <= 0) return "—";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 60 ? `${h + 1}${unit}00` : `${h}${unit}${String(m).padStart(2, "0")}`;
}

/** "31 h" / "48 h+" */
export function hLabel(hours: number, cap: number, unit = "h"): string {
  if (hours >= cap) return `${cap} ${unit}+`;
  return `${Math.round(hours)} ${unit}`;
}
