/**
 * Bike-to-work planning — pure functions, no DOM.
 *
 * Each workday has two commute windows (to work, home) and a midday context window.
 * Every commute hour is graded on two independent cyclist-comfort scales — rain and
 * wind — and a window is as bad as its worst hour. The day grade (A–E) is fixed for
 * the whole day: hours that have already passed still count, so the letter never
 * changes between the morning and the afternoon.
 */
import type { HourPoint } from "./types";
import { localParts, zonedToUtc } from "./time";
import { FAR_HOURS, type Names } from "./logic";

const H = 3_600_000;

/** 0 = fine, 1 = tolerable, 2 = bad */
export type Level = 0 | 1 | 2;
export type Grade = "A" | "B" | "C" | "D" | "E";

/**
 * Localized fragments the reason line is assembled from. Kept out of this module so
 * the pure logic stays language-agnostic; the card passes them in from i18n.
 */
export interface CommutePhrases {
  rain: string;
  lightRain: string;
  strongWind: string;
  breezy: string;
  /** e.g. `(w) => \`${w} to work\`` */
  toWork: (what: string) => string;
  /** e.g. `(w) => \`${w} home\`` */
  home: (what: string) => string;
  /** joins the rain + wind fragments within one window ("light rain + breezy") */
  and: string;
  /** joins the to-work + home fragments (" · ") */
  sep: string;
  /** shown when both commutes are clear */
  dryCalm: string;
  /** appended to dryCalm when the midday window has heavy rain */
  rainMidday: string;
}

export interface CommuteOptions {
  tz: string;
  /** Window bounds as minutes after local midnight. End is exclusive: 07:00–09:00 → hours 07 and 08. */
  toWork: [number, number];
  home: [number, number];
  midday: [number, number];
  /** mm/h: ≤ rainFine is fine, ≤ rainOk tolerable, above is bad. */
  rainFine: number;
  rainOk: number;
  /** m/s, same three bands. */
  windFine: number;
  windOk: number;
  /** ISO weekdays to include (1 = Mon … 7 = Sun). */
  workdays: number[];
  /** How many workdays to show. */
  days: number;
  /** Localized weekday names, indexed 0 = Sun … 6 = Sat. */
  names?: Names;
  /** Localized "Today" / "Tomorrow" labels for the first two rows. */
  today?: string;
  tomorrow?: string;
  /** Localized fragments for the reason line. */
  phrases?: CommutePhrases;
}

export interface HourCell {
  /** UTC ms of the hour start. */
  t: number;
  /** "07" */
  label: string;
  mm: number;
  wind: number;
  rain: Level;
  gust: Level;
  /** worse of the two */
  level: Level;
  /** the hour is already over */
  passed: boolean;
  /** no forecast for this hour */
  missing: boolean;
}

export interface CommuteWindow {
  cells: HourCell[];
  rain: Level;
  wind: Level;
  level: Level;
  passed: boolean;
}

export interface MiddaySummary {
  /** peak mm/h over the window */
  mm: number;
  /** mean wind over the window */
  wind: number;
  rain: Level;
  windLevel: Level;
  level: Level;
}

export interface CommuteDay {
  key: string;
  short: string;
  full: string;
  dom: number;
  isToday: boolean;
  /** first shown day of a new calendar week (draw a divider before it) */
  newWeek: boolean;
  /** beyond the fine-resolution forecast horizon */
  far: boolean;
  dayStart: number;
  toWork: CommuteWindow;
  midday: MiddaySummary;
  home: CommuteWindow;
  grade: Grade;
  /** traffic light for the grade: 0 green, 1 amber, 2 red */
  light: Level;
  /** short human reason, e.g. "light rain to work · breezy home" */
  reason: string;
}

export interface CommuteResult {
  days: CommuteDay[];
  /** true when the first row is today */
  todayShown: boolean;
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** English fallback fragments — mirrors the original hardcoded reason line. */
const EN_PHRASES: CommutePhrases = {
  rain: "rain",
  lightRain: "light rain",
  strongWind: "strong wind",
  breezy: "breezy",
  toWork: (w) => `${w} to work`,
  home: (w) => `${w} home`,
  and: " + ",
  sep: " · ",
  dryCalm: "dry and calm both ways",
  rainMidday: " · rain midday",
};

export function gradeToLight(g: Grade): Level {
  return g === "A" || g === "B" ? 0 : g === "C" ? 1 : 2;
}

export function planCommute(hours: HourPoint[], now: number, o: CommuteOptions): CommuteResult {
  const short = o.names?.short ?? SHORT;
  const full = o.names?.full ?? FULL;
  const today = o.today ?? "Today";
  const tomorrow = o.tomorrow ?? "Tomorrow";
  const ph = o.phrases ?? EN_PHRASES;

  const byT = new Map<number, HourPoint>();
  for (const h of hours) byT.set(h.t, h);

  const rainLevel = (mm: number): Level => (mm <= o.rainFine ? 0 : mm <= o.rainOk ? 1 : 2);
  const windLevel = (w: number): Level => (w <= o.windFine ? 0 : w <= o.windOk ? 1 : 2);
  const worse = (a: Level, b: Level): Level => (a > b ? a : b);

  const cellAt = (t: number): HourCell => {
    const p = byT.get(t);
    const lp = localParts(t, o.tz);
    const mm = p?.mm ?? 0;
    const wind = p?.wind ?? 0;
    const rain = rainLevel(mm);
    const gust = windLevel(wind);
    return {
      t,
      label: String(lp.h).padStart(2, "0"),
      mm,
      wind,
      rain,
      gust,
      level: worse(rain, gust),
      passed: t + H <= now,
      missing: !p,
    };
  };

  const windowFor = (y: number, m: number, d: number, [a, b]: [number, number]): CommuteWindow => {
    const cells: HourCell[] = [];
    for (let min = a; min < b; min += 60) {
      cells.push(cellAt(zonedToUtc(y, m, d, Math.floor(min / 60), 0, o.tz)));
    }
    const rain = cells.reduce<Level>((acc, c) => worse(acc, c.rain), 0);
    const wind = cells.reduce<Level>((acc, c) => worse(acc, c.gust), 0);
    return { cells, rain, wind, level: worse(rain, wind), passed: cells.every((c) => c.passed) };
  };

  const middayFor = (y: number, m: number, d: number, [a, b]: [number, number]): MiddaySummary => {
    let peak = 0;
    let sum = 0;
    let n = 0;
    for (let min = a; min < b; min += 60) {
      const p = byT.get(zonedToUtc(y, m, d, Math.floor(min / 60), 0, o.tz));
      if (!p) continue;
      peak = Math.max(peak, p.mm);
      sum += p.wind;
      n++;
    }
    const wind = n ? sum / n : 0;
    const rain = rainLevel(peak);
    const wl = windLevel(wind);
    return { mm: peak, wind, rain, windLevel: wl, level: worse(rain, wl) };
  };

  // Walk forward from today, keeping workdays until we have `days`. Today is skipped once its home window is over.
  const todayParts = localParts(now, o.tz);
  const days: CommuteDay[] = [];
  let prevKey: string | null = null;
  let prevDayStart = 0;
  for (let i = 0; days.length < o.days && i < 21; i++) {
    const noon = zonedToUtc(todayParts.y, todayParts.m, todayParts.d + i, 12, 0, o.tz);
    const p = localParts(noon, o.tz);
    const iso = p.wd === 0 ? 7 : p.wd;
    if (!o.workdays.includes(iso)) continue;
    const dayStart = zonedToUtc(p.y, p.m, p.d, 0, 0, o.tz);
    const homeEnd = zonedToUtc(p.y, p.m, p.d, Math.floor(o.home[1] / 60), o.home[1] % 60, o.tz);
    if (i === 0 && now >= homeEnd) continue;

    const toWork = windowFor(p.y, p.m, p.d, o.toWork);
    const home = windowFor(p.y, p.m, p.d, o.home);
    const midday = middayFor(p.y, p.m, p.d, o.midday);

    const worst = worse(toWork.level, home.level);
    let grade: Grade;
    if (worst === 0) grade = midday.level === 2 ? "B" : "A";
    else if (worst === 1) grade = "C";
    else grade = toWork.level === 2 && home.level === 2 ? "E" : "D";

    const words = (w: CommuteWindow): string => {
      const b: string[] = [];
      if (w.rain) b.push(w.rain === 2 ? ph.rain : ph.lightRain);
      if (w.wind) b.push(w.wind === 2 ? ph.strongWind : ph.breezy);
      return b.join(ph.and);
    };
    const bits: string[] = [];
    if (toWork.level) bits.push(ph.toWork(words(toWork)));
    if (home.level) bits.push(ph.home(words(home)));
    const reason = bits.length
      ? bits.join(ph.sep)
      : `${ph.dryCalm}${midday.level === 2 ? ph.rainMidday : ""}`;

    // A new week starts when the previous shown day is not the previous calendar day and this is the first weekday.
    const newWeek =
      prevKey !== null && dayStart - prevDayStart > 24 * H && iso === Math.min(...o.workdays);

    days.push({
      key: p.key,
      short: short[p.wd]!,
      full: i === 0 ? today : i === 1 ? tomorrow : full[p.wd]!,
      dom: p.d,
      isToday: i === 0,
      newWeek,
      far: dayStart > now + FAR_HOURS * H,
      dayStart,
      toWork,
      midday,
      home,
      grade,
      light: gradeToLight(grade),
      reason,
    });
    prevKey = p.key;
    prevDayStart = dayStart;
  }

  return { days, todayShown: days.length > 0 && days[0]!.isToday };
}
