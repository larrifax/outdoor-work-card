/**
 * Bike-to-work planning — pure functions, no DOM.
 *
 * Each workday has two commute windows (to work, home) and a midday context window.
 * Every commute hour is graded on two independent cyclist-comfort scales — rain and
 * wind — and a window is as bad as its worst hour. The day grade (A–F) comes from the
 * two commutes only and is fixed for the whole day: hours that have already passed
 * still count, so the letter never changes between the morning and the afternoon.
 * Midday never changes the grade; it only raises a home-office flag.
 */
import type { HourPoint } from "./types";
import { localParts, zonedToUtc } from "./time";
import { FAR_HOURS, type Names } from "./logic";

const H = 3_600_000;

/** 0 = fine, 1 = tolerable, 2 = bad, 3 = dangerous */
export type Level = 0 | 1 | 2 | 3;
/** Traffic light: 0 green, 1 amber, 2 red */
export type Light = 0 | 1 | 2;
export type Grade = "A" | "B" | "C" | "D" | "E" | "F";

// ponytail: fixed constants. Upgrade path: make configurable if riders ask.
/** Effective wind = max(mean, gust × GUST_FACTOR). Inland gust factors run ~1.5–1.7, so in steady wind this equals the mean. */
export const GUST_FACTOR = 0.6;
/** Dangerous regardless of rider thresholds: effective wind above this (m/s, ≈ gusts > 23 m/s)… */
export const DANGER_WIND = 14;
/** …or rain above this (mm/h, cloudburst). */
export const DANGER_RAIN = 8;
/** Midday flag: one hour above rainOk, or a midday total above this many × rainOk. */
const MIDDAY_TOTAL_FACTOR = 3;

/**
 * Localized fragments the reason line is assembled from. Kept out of this module so
 * the pure logic stays language-agnostic; the card passes them in from i18n.
 */
export interface CommutePhrases {
  rain: string;
  lightRain: string;
  strongWind: string;
  breezy: string;
  /** level-3 rain / wind */
  cloudburst: string;
  dangerousGusts: string;
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
  /** appended to the reason when the midday window is flagged */
  middayFlag: string;
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
  /** mean wind, m/s */
  wind: number;
  /** gust speed, m/s (falls back to mean) */
  gust: number;
  /** effective wind, m/s: max(mean, gust × GUST_FACTOR) */
  eff: number;
  rain: Level;
  windLevel: Level;
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
  /** total mm over the window */
  total: number;
  /** level of the peak hour */
  rain: Level;
  /** heavy midday rain on an A–C day: rain may drift into a commute, consider home office */
  flag: boolean;
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
  light: Light;
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

export interface Thresholds {
  rainFine: number;
  rainOk: number;
  windFine: number;
  windOk: number;
}
export type PresetId = "fair" | "everyday" | "all";

/** Rider presets. Shared by the config defaults (Everyday), the editor and the README table. */
export const PRESETS: Record<PresetId, Thresholds> = {
  fair: { rainFine: 0.1, rainOk: 0.3, windFine: 5, windOk: 8 },
  everyday: { rainFine: 0.2, rainOk: 0.8, windFine: 6, windOk: 10 },
  all: { rainFine: 0.5, rainOk: 2.0, windFine: 8, windOk: 12 },
};

/** Which preset these four values match exactly, or "custom". */
export function matchPreset(t: Thresholds): PresetId | "custom" {
  for (const [id, p] of Object.entries(PRESETS) as [PresetId, Thresholds][])
    if (
      p.rainFine === t.rainFine &&
      p.rainOk === t.rainOk &&
      p.windFine === t.windFine &&
      p.windOk === t.windOk
    )
      return id;
  return "custom";
}

/** English fallback fragments — mirrors the original hardcoded reason line. */
const EN_PHRASES: CommutePhrases = {
  rain: "rain",
  lightRain: "light rain",
  strongWind: "strong wind",
  breezy: "breezy",
  cloudburst: "cloudburst",
  dangerousGusts: "dangerous gusts",
  toWork: (w) => `${w} to work`,
  home: (w) => `${w} home`,
  and: " + ",
  sep: " · ",
  dryCalm: "dry and calm both ways",
  middayFlag: " · heavy rain midday — consider home office",
};

export function gradeToLight(g: Grade): Light {
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

  const rainLevel = (mm: number): Level =>
    mm > DANGER_RAIN ? 3 : mm <= o.rainFine ? 0 : mm <= o.rainOk ? 1 : 2;
  const windLevel = (w: number): Level =>
    w > DANGER_WIND ? 3 : w <= o.windFine ? 0 : w <= o.windOk ? 1 : 2;
  const worse = (a: Level, b: Level): Level => (a > b ? a : b);
  const rainWords = ["", ph.lightRain, ph.rain, ph.cloudburst];
  const windWords = ["", ph.breezy, ph.strongWind, ph.dangerousGusts];

  const cellAt = (t: number): HourCell => {
    const p = byT.get(t);
    const lp = localParts(t, o.tz);
    const mm = p?.mm ?? 0;
    const wind = p?.wind ?? 0;
    const gust = p?.gust ?? wind;
    const eff = Math.max(wind, gust * GUST_FACTOR);
    const rain = rainLevel(mm);
    const wl = windLevel(eff);
    return {
      t,
      label: String(lp.h).padStart(2, "0"),
      mm,
      wind,
      gust,
      eff,
      rain,
      windLevel: wl,
      level: worse(rain, wl),
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
    const wind = cells.reduce<Level>((acc, c) => worse(acc, c.windLevel), 0);
    return { cells, rain, wind, level: worse(rain, wind), passed: cells.every((c) => c.passed) };
  };

  const middayFor = (
    y: number,
    m: number,
    d: number,
    [a, b]: [number, number],
    grade: Grade,
  ): MiddaySummary => {
    let peak = 0;
    let total = 0;
    for (let min = a; min < b; min += 60) {
      const p = byT.get(zonedToUtc(y, m, d, Math.floor(min / 60), 0, o.tz));
      if (!p) continue;
      peak = Math.max(peak, p.mm);
      total += p.mm;
    }
    // Only on A–C days: on D/E/F the grade already says "don't".
    const flag =
      gradeToLight(grade) < 2 && (peak > o.rainOk || total > MIDDAY_TOTAL_FACTOR * o.rainOk);
    return { mm: peak, total, rain: rainLevel(peak), flag };
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

    const lw = toWork.level;
    const lh = home.level;
    const grade: Grade =
      lw === 3 || lh === 3
        ? "F"
        : lw === 2 && lh === 2
          ? "E"
          : lw === 2 || lh === 2
            ? "D"
            : lw === 1 && lh === 1
              ? "C"
              : lw === 1 || lh === 1
                ? "B"
                : "A";
    const midday = middayFor(p.y, p.m, p.d, o.midday, grade);

    const words = (w: CommuteWindow): string =>
      [rainWords[w.rain], windWords[w.wind]].filter(Boolean).join(ph.and);
    const bits: string[] = [];
    if (toWork.level) bits.push(ph.toWork(words(toWork)));
    if (home.level) bits.push(ph.home(words(home)));
    const reason = `${bits.length ? bits.join(ph.sep) : ph.dryCalm}${midday.flag ? ph.middayFlag : ""}`;

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
