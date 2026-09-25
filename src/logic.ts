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

export const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  /** Ground wetness (mm) at the (effective) window start. */
  wetAtStart: number;
  /** Per task: first hour boundary from window start when wetness ≤ its limit; null if never in data. */
  dryAt: (number | null)[];
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

/** ponytail: ET0 is for short grass, not wood or soil. Upgrade to a per-task factor if users ask. */
const DRYING_FACTOR = 1.0;
/** ponytail: wetness cap so a soaking doesn't take weeks to dry off in the model. */
const WET_CAP = 15;

/** Ground wetness (mm) at the end of each hour: rain adds, evaporation removes. */
function wetness(hours: HourPoint[]): number[] {
  let w = 0;
  return hours.map((h) => (w = Math.min(WET_CAP, Math.max(0, w + h.mm - h.et0 * DRYING_FACTOR))));
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
  const last = hours.length ? hours[hours.length - 1]!.t + H : now;
  const wet = wetness(hours);
  /** Wetness at `t`: the counter after the last full hour ending at or before `t`. */
  const wetAt = (t: number) => {
    let w = 0;
    for (let i = 0; i < hours.length && hours[i]!.t + H <= t; i++) w = wet[i]!;
    return w;
  };
  /** First hour boundary ≥ `t` where wetness ≤ `max` (or `t` itself); null if never in data. */
  const dryFrom = (t: number, max: number): number | null => {
    if (wetAt(t) <= max) return t;
    for (let i = 0; i < hours.length; i++) {
      const end = hours[i]!.t + H;
      if (end > t && wet[i]! <= max) return end;
    }
    return null;
  };

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

    // Ground wetness when the window opens (today: from now).
    const wetRef = effStart ?? start;
    const wetAtStart = wetAt(wetRef);
    const dryAt = o.tasks.map((t) => dryFrom(wetRef, t.max_wet));

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
      (t) => usable && wetAtStart <= t.max_wet && (t.after === undefined || after >= t.after),
    );

    return {
      ...b,
      start: hasWindow ? start : null,
      end: hasWindow ? end : null,
      effStart,
      hours: hrs,
      passed,
      wetAtStart,
      dryAt,
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

export type DryByCell =
  | { all: true }
  /** `task` = index of the strictest not-yet-dry task; `soon` = dries before the window closes. */
  | { all: false; task: number; at: number | null; soon: boolean };

/** What the Dry-by column shows: ✓, or the strictest (lowest max_wet) task still waiting. */
export function dryByCell(d: WorkDay, tasks: TaskConfig[]): DryByCell {
  let pick = -1;
  tasks.forEach((t, k) => {
    if (d.wetAtStart <= t.max_wet) return;
    if (pick < 0 || t.max_wet < tasks[pick]!.max_wet) pick = k;
  });
  if (pick < 0) return { all: true };
  const at = d.dryAt[pick] ?? null;
  return { all: false, task: pick, at, soon: at !== null && d.end !== null && at < d.end };
}

// ---------------------------------------------------------------------------
// CAR WASH MODE
// ---------------------------------------------------------------------------
//
// Wet-roads model: a garaged car gets dirty from spray while driving on wet
// roads, not from rain on the parked car. An hour above `okRain` wets the
// roads; they dry after `dryRoadsHours` rain-free hours (half speed at night).
// After frost on wet roads (or with snowfall) the roads count as salted until
// ~10 mm has washed them, and any measurable moisture wets them meanwhile.

/** ponytail: fixed night drying factor. Ceiling: ignores temperature/wind; upgrade to an ET0- or temperature-aware rate if users ask. */
const NIGHT_DRYING = 0.5;
// ponytail: fixed road-salt constants. Ceiling: salt inferred from frost, no gritting data; make configurable if users ask.
/** An hour at or below this (°C) on wet roads or with snowfall salts the roads… */
const SALT_TEMP = 1;
/** …until this much precipitation (mm) has fallen since… */
const SALT_WASH_OFF = 10;
/** …and while salted, anything above this (mm in an hour) wets them. */
const SALT_WET = 0.1;

export interface WashOptions {
  tz: string;
  /** minutes after midnight */
  washStart: number;
  /** mm in an hour above which roads turn wet. */
  okRain: number;
  /** Rain-free hours until wet roads are dry again (half speed at night). */
  dryRoadsHours: number;
  /** Night window: nobody drives, roads dry at half speed. */
  nightFrom: number;
  nightUntil: number;
  /** Optional [start, end) minutes when the car is parked indoors on workdays. */
  parked: [number, number] | null;
  /** ISO weekdays (1 = Mon … 7 = Sun) the parked window applies to. */
  workdays: number[];
  days: number;
  /** Localized weekday names. */
  names?: Names;
}

export type WashIcon = "sun" | "moon" | "rain";

/** A run of consecutive driving hours on wet roads. */
export interface DirtyStretch {
  /** UTC instant the first wet driving hour starts. */
  at: number;
  /** UTC instant the last wet driving hour ends. */
  end: number;
  hours: number;
  /** Peak / total mm of the rain hours that wet the roads for this stretch. */
  peak: number;
  total: number;
}

export interface WashDay extends DayBase {
  /** Peak mm/h on this day (display only). */
  peak: number;
  /** No driving hour on wet roads all day. */
  clean: boolean;
  /** No driving hour on wet roads from wash time (or now) to midnight. */
  eveningClean: boolean;
  /** Clean days after the wash day (-1 = can't wash this evening). */
  streak: number;
  /** Streak ran to the end of the data — it's at least this long. */
  openEnded: boolean;
  /** The first dirty stretch after the wash evening (null if none within range). */
  nextRain: DirtyStretch | null;
  /** First driving hour on wet roads this day (UTC ms), null if none. */
  wetFrom: number | null;
  /** Roads were salted at `wetFrom`, so any moisture wet them. */
  salted: boolean;
  /** When the roads dry after the day's last wet hour (UTC ms), null if never wet or never dry in data. */
  dryAt: number | null;
  icon: WashIcon;
}

export interface WashResult {
  days: WashDay[];
  bestIdx: number;
  /** Index of the day whose wet roads end a wash-today streak, -1 if none. */
  todayBreakIdx: number;
  /** Index of the day whose wet roads end the recommended evening's streak, -1 if open-ended. */
  bestBreakIdx: number;
}

const inRange = (m: number, from: number, until: number) =>
  from > until ? m >= from || m < until : m >= from && m < until;

export function planWash(hours: HourPoint[], now: number, o: WashOptions): WashResult {
  // Evaluate a few days beyond the displayed range so streaks can run past it.
  const extra = 3;
  const base = buildDays(now, o.tz, o.days + extra, o.names);

  // Per-hour road state; the hour before the data starts counts as dry.
  const wet: boolean[] = [];
  const driving: boolean[] = [];
  /** the hour's precipitation wet the roads (threshold depends on salt) */
  const rainy: boolean[] = [];
  /** roads counted as salted while judging this hour */
  const salted: boolean[] = [];
  let drying = 0;
  // ponytail: salt triggered before the fetched past days (7) is missed; accept, or fetch more history.
  let salt = false;
  let washOff = 0;
  for (const h of hours) {
    const p = localParts(h.t, o.tz);
    const m = p.h * 60 + p.mi;
    const night = inRange(m, o.nightFrom, o.nightUntil);
    const iso = p.wd === 0 ? 7 : p.wd;
    const parked =
      o.parked !== null && o.workdays.includes(iso) && inRange(m, o.parked[0], o.parked[1]);
    driving.push(!night && !parked);
    if (salt) {
      washOff += h.mm;
      if (washOff >= SALT_WASH_OFF) salt = false;
    }
    salted.push(salt);
    rainy.push(h.mm > (salt ? SALT_WET : o.okRain));
    if (rainy[rainy.length - 1]) {
      drying = o.dryRoadsHours;
      wet.push(true);
    } else {
      if (drying > 0) drying -= night ? NIGHT_DRYING : 1;
      wet.push(drying > 0);
    }
    if (h.temp != null && h.temp <= SALT_TEMP && (wet[wet.length - 1] || (h.snow ?? 0) > 0)) {
      salt = true;
      washOff = 0;
    }
  }
  const dirtyAt = (i: number) => wet[i]! && driving[i]!;

  type Info = {
    clean: boolean;
    eveningClean: boolean;
    peak: number;
    hasData: boolean;
    evening: number;
    wetFrom: number | null;
    salted: boolean;
    dryAt: number | null;
  };
  const info: Info[] = base.map((b) => {
    const dayEnd = b.dayStart + 24 * H;
    const p = localParts(b.dayStart + 12 * H, o.tz);
    const washAt = zonedToUtc(p.y, p.m, p.d, Math.floor(o.washStart / 60), o.washStart % 60, o.tz);
    const evening = Math.max(washAt, b.isToday ? now : washAt);
    let clean = true;
    let eveningClean = true;
    let peak = 0;
    let hasData = false;
    let wetFrom: number | null = null;
    let saltedWet = false;
    let lastWet = -1;
    hours.forEach((h, i) => {
      if (h.t + H <= b.dayStart || h.t >= dayEnd) return;
      hasData = true;
      peak = Math.max(peak, h.mm);
      if (wet[i]) lastWet = i;
      if (!dirtyAt(i)) return;
      clean = false;
      if (wetFrom === null) {
        wetFrom = h.t;
        saltedWet = salted[i]!;
      }
      if (h.t + H > evening) eveningClean = false;
    });
    let dryAt: number | null = null;
    if (lastWet >= 0) {
      const j = wet.indexOf(false, lastWet);
      dryAt = j >= 0 ? hours[j]!.t : null;
    }
    if (!hasData) clean = eveningClean = false;
    return { clean, eveningClean, peak, hasData, evening, wetFrom, salted: saltedWet, dryAt };
  });

  const streakFrom = (s: number): { n: number; open: boolean } => {
    // Wash day itself isn't counted — the car is dry in the garage overnight.
    if (!info[s]!.eveningClean) return { n: -1, open: false };
    let n = 0;
    for (let j = s + 1; j < info.length; j++) {
      if (!info[j]!.hasData) return { n, open: true };
      if (!info[j]!.clean) return { n, open: false };
      n++;
    }
    // Ran past the evaluated days without hitting wet roads: it's *at least* n.
    return { n, open: true };
  };

  const nextDirtyFrom = (s: number): DirtyStretch | null => {
    const inf = info[s]!;
    if (!inf.eveningClean) return null;
    const start = hours.findIndex((h, i) => h.t >= inf.evening && dirtyAt(i));
    if (start < 0) return null;
    let end = start;
    while (end + 1 < hours.length && dirtyAt(end + 1)) end++;
    // Count every rain hour of the wet spell, back to where it began.
    let from = start;
    while (from > 0 && wet[from - 1]) from--;
    let peak = 0;
    let total = 0;
    for (let i = from; i <= end; i++) {
      if (!rainy[i]) continue;
      const mm = hours[i]!.mm;
      peak = Math.max(peak, mm);
      total += mm;
    }
    return { at: hours[start]!.t, end: hours[end]!.t + H, hours: end - start + 1, peak, total };
  };

  const days: WashDay[] = base.slice(0, o.days).map((b, i) => {
    const inf = info[i]!;
    const st = streakFrom(i);
    const icon: WashIcon = inf.peak <= 0.05 ? "sun" : inf.clean ? "moon" : "rain";
    return {
      ...b,
      peak: inf.peak,
      clean: inf.clean,
      eveningClean: inf.eveningClean,
      streak: st.n,
      openEnded: st.open,
      nextRain: nextDirtyFrom(i),
      wetFrom: inf.wetFrom,
      salted: inf.salted,
      dryAt: inf.dryAt,
      icon,
    };
  });

  let bestIdx = 0;
  days.forEach((d, i) => {
    if (d.streak > days[bestIdx]!.streak) bestIdx = i;
  });

  const t0 = streakFrom(0);
  const breakIdx = t0.n + 1; // wash day not counted, so the break sits one day later
  const todayBreakIdx = t0.open ? -1 : breakIdx < base.length ? breakIdx : -1;

  // Same, for the recommended evening: the day whose wet roads end its streak.
  const tb = streakFrom(bestIdx);
  const bb = bestIdx + tb.n + 1;
  const bestBreakIdx = tb.open ? -1 : bb < base.length ? bb : -1;

  return { days, bestIdx, todayBreakIdx, bestBreakIdx };
}
