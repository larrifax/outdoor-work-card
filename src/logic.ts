/**
 * Pure planning logic — no DOM, no fetch. Everything the card shows is
 * derived here from an hourly precipitation series and the config.
 */
import type { HourPoint, TaskConfig } from "./types";
import { localParts, zonedToUtc, hoursBetween } from "./time";
import { sunTimesFor } from "./sun";

const H = 3_600_000;
/** Beyond this horizon the MET Nordic model hands over to coarser data. */
export const FAR_HOURS = 60;

export interface DayBase {
  key: string;
  /** "Wed" */
  short: string;
  /** "Wednesday" */
  full: string;
  /** Day of month */
  dom: number;
  isToday: boolean;
  isWeekend: boolean;
  /** Forecast for this day is beyond the fine-resolution horizon. */
  far: boolean;
  /** UTC ms of local midnight starting the day. */
  dayStart: number;
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Localized weekday names, indexed 0 = Sun … 6 = Sat. */
export interface Names {
  short: string[];
  full: string[];
}

export function buildDays(now: number, tz: string, count: number, names?: Names): DayBase[] {
  const short = names?.short ?? SHORT;
  const full = names?.full ?? FULL;
  const today = localParts(now, tz);
  const out: DayBase[] = [];
  for (let i = 0; i < count; i++) {
    const noon = zonedToUtc(today.y, today.m, today.d + i, 12, 0, tz);
    const p = localParts(noon, tz);
    const dayStart = zonedToUtc(p.y, p.m, p.d, 0, 0, tz);
    out.push({
      key: p.key,
      short: short[p.wd]!,
      full: full[p.wd]!,
      dom: p.d,
      isToday: i === 0,
      isWeekend: p.wd === 0 || p.wd === 6,
      far: dayStart > now + FAR_HOURS * H,
      dayStart,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// WORK MODE
// ---------------------------------------------------------------------------

export interface WorkOptions {
  tz: string;
  lat: number;
  lon: number;
  /** minutes after midnight */
  weekdayStart: number;
  weekendStart: number;
  /** 'dusk' | 'sunset' | minutes after midnight */
  windowEnd: "dusk" | "sunset" | number;
  minWindowMinutes: number;
  rainThreshold: number;
  tasks: TaskConfig[];
  days: number;
  /** Runway hours are capped for display (default 48). */
  cap: number;
  /** Localized weekday names. */
  names?: Names;
}

export interface WorkDay extends DayBase {
  /** Window as scheduled (before clamping to "now"). null = no daylight window. */
  start: number | null;
  end: number | null;
  /** Effective start (today: max(start, now)). */
  effStart: number | null;
  /** Usable hours of light. 0 when passed / none. */
  hours: number;
  passed: boolean;
  /** Dry hours before the window opens (capped). */
  before: number;
  /** Dry hours after the window closes (capped). */
  after: number;
  /** True when it rains inside the window. */
  during: boolean;
  /** Per configured task: is this day OK? */
  ok: boolean[];
}

export interface TaskVerdict {
  name: string;
  nextIdx: number;
  longestIdx: number;
}

export interface WorkResult {
  days: WorkDay[];
  tasks: TaskVerdict[];
  /** Index of tasks that are OK tonight. */
  tonightOk: number[];
}

function lastRainBefore(hours: HourPoint[], t: number, thr: number): HourPoint | null {
  for (let i = hours.length - 1; i >= 0; i--) {
    const h = hours[i]!;
    if (h.t >= t) continue;
    if (h.mm > thr) return h;
  }
  return null;
}

function firstRainAfter(hours: HourPoint[], t: number, thr: number): HourPoint | null {
  for (const h of hours) {
    if (h.t + H <= t) continue;
    if (h.mm > thr) return h;
  }
  return null;
}

function rainWithin(hours: HourPoint[], a: number, b: number, thr: number): boolean {
  for (const h of hours) {
    if (h.t + H <= a) continue;
    if (h.t >= b) break;
    if (h.mm > thr) return true;
  }
  return false;
}

export function planWork(hours: HourPoint[], now: number, o: WorkOptions): WorkResult {
  const base = buildDays(now, o.tz, o.days, o.names);
  const first = hours[0]?.t ?? now;
  const last = hours.length ? hours[hours.length - 1]!.t + H : now;

  const days: WorkDay[] = base.map((b) => {
    const p = localParts(b.dayStart + 12 * H, o.tz);
    const startMin = b.isWeekend ? o.weekendStart : o.weekdayStart;
    const start = zonedToUtc(p.y, p.m, p.d, Math.floor(startMin / 60), startMin % 60, o.tz);

    let end: number | null;
    if (typeof o.windowEnd === "number") {
      end = zonedToUtc(p.y, p.m, p.d, Math.floor(o.windowEnd / 60), o.windowEnd % 60, o.tz);
    } else {
      const s = sunTimesFor(p.y, p.m, p.d, o.lat, o.lon, o.tz);
      end = o.windowEnd === "sunset" ? s.sunset : s.dusk;
    }

    const hasWindow = end !== null && end > start;
    const effStart = hasWindow ? Math.max(start, b.isToday ? now : start) : null;
    const passed = hasWindow && effStart !== null && effStart >= (end as number);
    const hrs = hasWindow && !passed ? hoursBetween(effStart as number, end as number) : 0;

    // Runway before: time since the last rainy hour ended, capped.
    const lr = lastRainBefore(hours, start, o.rainThreshold);
    const beforeRaw = lr ? hoursBetween(lr.t + H, start) : hoursBetween(first, start);
    const before = Math.max(0, Math.min(o.cap, beforeRaw));

    // Runway after: time until the next rainy hour starts, capped.
    const endRef = hasWindow ? (end as number) : start;
    const fr = firstRainAfter(hours, endRef, o.rainThreshold);
    const afterRaw = fr ? hoursBetween(endRef, fr.t) : hoursBetween(endRef, last);
    const after = Math.max(0, Math.min(o.cap, afterRaw));

    const during =
      hasWindow && !passed
        ? rainWithin(hours, effStart as number, end as number, o.rainThreshold)
        : false;

    const usable = hasWindow && !passed && hrs * 60 >= o.minWindowMinutes && !during;
    const ok = o.tasks.map(
      (t) => usable && before >= t.before && (t.after === undefined || after >= t.after),
    );

    return {
      ...b,
      start: hasWindow ? start : null,
      end: hasWindow ? end : null,
      effStart,
      hours: hrs,
      passed,
      before,
      after,
      during,
      ok,
    };
  });

  const tasks: TaskVerdict[] = o.tasks.map((t, k) => {
    let nextIdx = -1;
    let longestIdx = -1;
    days.forEach((d, i) => {
      if (!d.ok[k]) return;
      if (nextIdx < 0) nextIdx = i;
      if (longestIdx < 0 || d.hours > days[longestIdx]!.hours) longestIdx = i;
    });
    return { name: t.name, nextIdx, longestIdx };
  });

  const tonightOk = o.tasks.map((_, k) => k).filter((k) => days[0]?.ok[k]);
  return { days, tasks, tonightOk };
}

// ---------------------------------------------------------------------------
// CAR WASH MODE
// ---------------------------------------------------------------------------

export interface WashOptions {
  tz: string;
  /** minutes after midnight */
  washStart: number;
  okRain: number;
  nightMax: number;
  nightFrom: number;
  nightUntil: number;
  days: number;
  /** Hours before wash time that must be free of intolerable rain (roads dry). */
  leadHours: number;
  /** Localized weekday names. */
  names?: Names;
}

export type WashIcon = "sun" | "moon" | "drop" | "rain";

export interface RainEvent {
  /** UTC instant the rain starts. */
  at: number;
  /** How many consecutive hours it stays above the threshold. */
  hours: number;
  /** Peak mm/h during the event. */
  peak: number;
  /** Total accumulated mm over the event. */
  total: number;
}

export interface WashDay extends DayBase {
  /** Peak mm/h on this day. */
  peak: number;
  /** When the peak fell. */
  peakNight: boolean;
  /** The day's disqualifying rain is all before wash time (so the evening is still washable). */
  clearsBeforeWash: boolean;
  /** Day is harmless to a clean car (all hours). */
  tolerated: boolean;
  /** Evening onward is harmless (so you can wash then). */
  eveningTolerated: boolean;
  /** Dry days after the wash day, assuming a dry garage overnight (-1 = can't wash). */
  streak: number;
  /** Streak ran to the end of the data — it's at least this long. */
  openEnded: boolean;
  /** The next disqualifying rain after the wash evening (null if none within range). */
  nextRain: RainEvent | null;
  icon: WashIcon;
}

export interface WashResult {
  days: WashDay[];
  bestIdx: number;
  /** Index of the day whose rain ends a wash-today streak, -1 if none. */
  todayBreakIdx: number;
}

export function planWash(hours: HourPoint[], now: number, o: WashOptions): WashResult {
  // Evaluate a few days beyond the displayed range so streaks can run past it.
  const extra = 3;
  const base = buildDays(now, o.tz, o.days + extra, o.names);

  const isNight = (ms: number) => {
    const p = localParts(ms, o.tz);
    const m = p.h * 60 + p.mi;
    return o.nightFrom > o.nightUntil
      ? m >= o.nightFrom || m < o.nightUntil
      : m >= o.nightFrom && m < o.nightUntil;
  };
  const bad = (h: HourPoint) => (isNight(h.t) ? h.mm > o.nightMax : h.mm > o.okRain);

  type Info = {
    tolerated: boolean;
    eveningTolerated: boolean;
    peak: number;
    peakNight: boolean;
    hasData: boolean;
    evening: number;
  };
  const info: Info[] = base.map((b) => {
    const dayEnd = b.dayStart + 24 * H;
    const p = localParts(b.dayStart + 12 * H, o.tz);
    const washAt = zonedToUtc(p.y, p.m, p.d, Math.floor(o.washStart / 60), o.washStart % 60, o.tz);
    const evening = Math.max(washAt, b.isToday ? now : washAt);
    let tolerated = true;
    let eveningTolerated = true;
    let peak = 0;
    let peakNight = false;
    let hasData = false;
    for (const h of hours) {
      if (h.t + H <= b.dayStart) continue;
      if (h.t >= dayEnd) break;
      hasData = true;
      if (h.mm > peak) {
        peak = h.mm;
        peakNight = isNight(h.t);
      }
      if (bad(h)) {
        tolerated = false;
        // Rain during or shortly before the wash (wet roads) rules the evening out.
        if (h.t + H > evening - o.leadHours * H) eveningTolerated = false;
      }
    }
    if (!hasData) tolerated = eveningTolerated = false;
    return { tolerated, eveningTolerated, peak, peakNight, hasData, evening };
  });

  const streakFrom = (s: number): { n: number; open: boolean } => {
    // Wash day itself isn't counted — the car is dry in the garage overnight.
    if (!info[s]!.eveningTolerated) return { n: -1, open: false };
    let n = 0;
    for (let j = s + 1; j < info.length; j++) {
      if (!info[j]!.hasData) return { n, open: true };
      if (!info[j]!.tolerated) return { n, open: false };
      n++;
    }
    // Ran past the evaluated days without hitting rain: it's *at least* n.
    return { n, open: true };
  };

  // The next disqualifying rain after the wash evening (null when the evening
  // itself is spoiled or nothing rains within the data).
  const nextRainFrom = (s: number): RainEvent | null => {
    const inf = info[s]!;
    if (!inf.eveningTolerated) return null;
    const start = hours.findIndex((h) => h.t >= inf.evening && bad(h));
    if (start < 0) return null;
    let end = start;
    let peak = 0;
    let total = 0;
    while (end < hours.length && bad(hours[end]!)) {
      peak = Math.max(peak, hours[end]!.mm);
      total += hours[end]!.mm;
      end++;
    }
    return { at: hours[start]!.t, hours: end - start, peak, total };
  };

  const days: WashDay[] = base.slice(0, o.days).map((b, i) => {
    const inf = info[i]!;
    const st = streakFrom(i);
    let icon: WashIcon;
    if (inf.peak <= 0.05) icon = "sun";
    else if (!inf.tolerated) icon = "rain";
    else if (inf.peakNight) icon = "moon";
    else icon = "drop";
    return {
      ...b,
      peak: inf.peak,
      peakNight: inf.peakNight,
      clearsBeforeWash: !inf.tolerated && inf.eveningTolerated,
      tolerated: inf.tolerated,
      eveningTolerated: inf.eveningTolerated,
      streak: st.n,
      openEnded: st.open,
      nextRain: nextRainFrom(i),
      icon,
    };
  });

  let bestIdx = 0;
  days.forEach((d, i) => {
    if (d.streak > days[bestIdx]!.streak) bestIdx = i;
  });

  const t0 = streakFrom(0);
  const breakIdx = t0.n + 1; // wash day no longer counted, so the break sits one day later
  const todayBreakIdx = t0.open ? -1 : breakIdx < base.length ? breakIdx : -1;

  return { days, bestIdx, todayBreakIdx };
}
