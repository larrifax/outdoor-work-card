/**
 * Bike-to-work planning — pure functions, no DOM.
 *
 * Each workday has two commute windows (to work, home) and a midday context window.
 * Every commute hour is graded on two independent cyclist-comfort scales — rain and
 * wind — and a window is as bad as its worst hour. The day grade (A–F) comes from the
 * two commutes only and is fixed for the whole day: hours that have already passed
 * still count, so the letter never changes between the morning and the afternoon.
 * Midday never changes the grade; it only raises a home-office flag.
 *
 * Snow is split out of the precipitation total and graded on its own fixed cm/h scale.
 * A slippery-roads marker (`icy`) flags hours where a wet road met a cold night; it is
 * informational only and never changes a level or the grade.
 */
import type { HourPoint } from "./types";
import { localParts, zonedToUtc, zonedMin, isoWd } from "./time";
import { buildDays, type DayBase, type Names } from "./logic";

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

/** Open-Meteo's conversion: 7 cm snow ≈ 10 mm water. */
const SNOW_CM_PER_MM = 0.7;
// ponytail: fixed snow scale (cm/h), independent of rider presets. Upgrade path: make configurable if riders ask.
/** Snowfall above this is "bad" (≤ is tolerable)… */
export const SNOW_OK = 0.5;
/** …and above this "dangerous". */
export const DANGER_SNOW = 3;
// ponytail: fixed slippery-roads heuristic. Ceiling: air temperature only, no road-surface data; upgrade to configurable if riders ask.
/** Look back this many hours for precipitation that wet the road… */
const ICY_LOOKBACK_H = 12;
/** …and count it as wet above this total (mm). */
const ICY_WET_MM = 0.1;
/** Night minimum at or below this (°C) since the last precipitation… */
export const ICY_NIGHT_MAX = 2;
/** …and the hour itself at or below this (°C). */
export const ICY_NOW_MAX = 4;
/** Tyre guess: frost-free days before yesterday that mean summer tyres. */
const TYRE_FROST_DAYS = 5;

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
  lightSnow: string;
  snow: string;
  heavySnow: string;
  /** slippery-roads fragment, composed with toWork / home */
  icy: string;
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
  /** same, when snow dominates the midday precipitation */
  middayFlagSnow: string;
  /** shown when a commute hour has no forecast (day past the horizon) */
  noData: string;
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
  /** Rider is on summer tyres: evaluate the slippery-roads marker. Default false. */
  icyWatch?: boolean;
}

export interface HourCell {
  /** UTC ms of the hour start. */
  t: number;
  /** "07" */
  label: string;
  /** total precipitation incl. snow water, mm */
  mm: number;
  /** snowfall, cm/h */
  snow: number;
  /** snow water > 50% of `mm`: show snowflake + cm */
  snowDom: boolean;
  /** 2 m air temperature, °C (null when missing) */
  temp: number | null;
  /** mean wind, m/s */
  wind: number;
  /** gust speed, m/s (falls back to mean) */
  gust: number;
  /** effective wind, m/s: max(mean, gust × GUST_FACTOR) */
  eff: number;
  /** level of the rain part (precipitation minus snow water) */
  rain: Level;
  snowLevel: Level;
  windLevel: Level;
  /** worst of rain, snow and wind */
  level: Level;
  /** road may be icy (summer tyres only); never changes `level` */
  icy: boolean;
  /** the hour is already over */
  passed: boolean;
  /** no forecast for this hour */
  missing: boolean;
}

export interface CommuteWindow {
  cells: HourCell[];
  rain: Level;
  snow: Level;
  wind: Level;
  level: Level;
  /** some cell is icy */
  icy: boolean;
}

export interface MiddaySummary {
  /** peak mm/h over the window */
  mm: number;
  /** total mm over the window */
  total: number;
  /** level of the peak rain-part hour */
  rain: Level;
  /** peak snowfall, cm/h */
  snow: number;
  /** total snowfall, cm */
  snowTotal: number;
  /** level of the peak snow hour */
  snowLevel: Level;
  /** snow water > 50% of the midday total */
  snowDom: boolean;
  /** heavy midday rain or snow on an A–C day: rain may drift into a commute, consider home office */
  flag: boolean;
}

export interface CommuteDay extends DayBase {
  /** first shown day of a new calendar week (draw a divider before it) */
  newWeek: boolean;
  toWork: CommuteWindow;
  midday: MiddaySummary;
  home: CommuteWindow;
  grade: Grade;
  /** some commute hour has no forecast: `grade` covers only the known hours, show it as unknown */
  unknown: boolean;
  /** traffic light for the grade: 0 green, 1 amber, 2 red */
  light: Light;
  /** short human reason, e.g. "light rain to work · breezy home" */
  reason: string;
}

export interface CommuteResult {
  days: CommuteDay[];
}

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
export const EN_PHRASES: CommutePhrases = {
  rain: "rain",
  lightRain: "light rain",
  strongWind: "strong wind",
  breezy: "breezy",
  cloudburst: "cloudburst",
  dangerousGusts: "dangerous gusts",
  lightSnow: "light snow",
  snow: "snow",
  heavySnow: "heavy snow",
  icy: "icy roads possible",
  toWork: (w) => `${w} to work`,
  home: (w) => `${w} home`,
  and: " + ",
  sep: " · ",
  dryCalm: "dry and calm both ways",
  middayFlag: " · heavy rain midday — consider home office",
  middayFlagSnow: " · heavy snow midday — consider home office",
  noData: "no forecast yet",
};

/** Day grade from the two commute levels: any dangerous → F, then how many are bad / tolerable. */
export function gradeDay(toWork: Level, home: Level): Grade {
  const [lo, hi] = toWork < home ? [toWork, home] : [home, toWork];
  return hi === 3
    ? "F"
    : hi === 2
      ? lo === 2
        ? "E"
        : "D"
      : hi === 1
        ? lo === 1
          ? "C"
          : "B"
        : "A";
}

/** Rain part, mm/h → level on the rider's thresholds (above DANGER_RAIN is always dangerous). */
export const rainLevel = (mm: number, t: Thresholds): Level =>
  mm > DANGER_RAIN ? 3 : mm <= t.rainFine ? 0 : mm <= t.rainOk ? 1 : 2;
/** Effective wind, m/s → level. */
export const windLevel = (w: number, t: Thresholds): Level =>
  w > DANGER_WIND ? 3 : w <= t.windFine ? 0 : w <= t.windOk ? 1 : 2;
/** Snowfall, cm/h → level on the fixed snow scale. */
export const snowLevel = (cm: number): Level =>
  cm <= 0 ? 0 : cm > DANGER_SNOW ? 3 : cm <= SNOW_OK ? 1 : 2;

export function gradeToLight(g: Grade): Light {
  return g === "A" || g === "B" ? 0 : g === "C" ? 1 : 2;
}

/**
 * Automatic tyre guess: summer tyres while there was no frost in the TYRE_FROST_DAYS days
 * ending at the start of yesterday, and no snow lies on the ground now. The window stops
 * before yesterday so the first night or two of a cold snap still produce warnings.
 */
export function summerTyres(hours: HourPoint[], now: number, tz: string): boolean {
  const p = localParts(now, tz);
  const to = zonedToUtc(p.y, p.m, p.d - 1, 0, 0, tz);
  const from = zonedToUtc(p.y, p.m, p.d - 1 - TYRE_FROST_DAYS, 0, 0, tz);
  for (const h of hours) {
    if (h.t >= from && h.t < to && h.temp != null && h.temp <= 0) return false;
    if (h.t <= now && now < h.t + H && (h.snowDepth ?? 0) > 0) return false;
  }
  return true;
}

/** Winter-tyres entity state: on → true, off → false, missing / unavailable / unknown → null (use the guess). */
export function winterTyresFrom(state: string | undefined): boolean | null {
  return state === "on" ? true : state === "off" ? false : null;
}

/** Evaluate the slippery-roads marker: the entity wins when set (winter tyres → off), else the weather guess. */
export const icyWatch = (winter: boolean | null, summer: boolean): boolean =>
  winter === null ? summer : !winter;

export function planCommute(hours: HourPoint[], now: number, o: CommuteOptions): CommuteResult {
  const today = o.today ?? "Today";
  const tomorrow = o.tomorrow ?? "Tomorrow";
  const ph = o.phrases ?? EN_PHRASES;

  const byT = new Map<number, HourPoint>();
  for (const h of hours) byT.set(h.t, h);

  const worse = (a: Level, b: Level): Level => (a > b ? a : b);
  const rainWords = ["", ph.lightRain, ph.rain, ph.cloudburst];
  const windWords = ["", ph.breezy, ph.strongWind, ph.dangerousGusts];
  const snowWords = ["", ph.lightSnow, ph.snow, ph.heavySnow];
  /** Precipitation split: total mm, snowfall cm, snow water mm, rain part mm. */
  const split = (p: HourPoint | undefined) => {
    const mm = p?.mm ?? 0;
    const snow = p?.snow ?? 0;
    const water = snow / SNOW_CM_PER_MM;
    return { mm, snow, water, rain: Math.max(0, mm - water) };
  };

  /** Wet road in the last ICY_LOOKBACK_H hours (or snowing now), a cold night since, and not yet thawed. */
  const icyAt = (t: number, p: HourPoint | undefined): boolean => {
    if (!o.icyWatch || p?.temp == null || p.temp > ICY_NOW_MAX) return false;
    const snowing = (p.snow ?? 0) > 0;
    let wet = 0;
    let lastWet = t; // no earlier precipitation: only snow now can wet the road
    for (let k = ICY_LOOKBACK_H; k >= 1; k--) {
      const q = byT.get(t - k * H);
      if (!q || q.mm <= 0) continue;
      wet += q.mm;
      lastWet = t - k * H;
    }
    if (!snowing && wet <= ICY_WET_MM) return false;
    for (let u = lastWet; u <= t; u += H) {
      const q = byT.get(u)?.temp;
      if (q != null && q <= ICY_NIGHT_MAX) return true;
    }
    return false;
  };

  const cellAt = (t: number): HourCell => {
    const p = byT.get(t);
    const lp = localParts(t, o.tz);
    const s = split(p);
    const wind = p?.wind ?? 0;
    const gust = p?.gust ?? wind;
    const eff = Math.max(wind, gust * GUST_FACTOR);
    const rain = rainLevel(s.rain, o);
    const sl = snowLevel(s.snow);
    const wl = windLevel(eff, o);
    return {
      t,
      label: String(lp.h).padStart(2, "0"),
      mm: s.mm,
      snow: s.snow,
      snowDom: s.water > 0.5 * s.mm,
      temp: p?.temp ?? null,
      wind,
      gust,
      eff,
      rain,
      snowLevel: sl,
      windLevel: wl,
      level: worse(worse(rain, sl), wl),
      icy: icyAt(t, p),
      passed: t + H <= now,
      missing: !p,
    };
  };

  const windowFor = (y: number, m: number, d: number, [a, b]: [number, number]): CommuteWindow => {
    const cells: HourCell[] = [];
    // Every hour the window touches: 07:45–08:15 → hours 07 and 08.
    for (let h = Math.floor(a / 60); h * 60 < b; h++)
      cells.push(cellAt(zonedToUtc(y, m, d, h, 0, o.tz)));
    const rain = cells.reduce<Level>((acc, c) => worse(acc, c.rain), 0);
    const snow = cells.reduce<Level>((acc, c) => worse(acc, c.snowLevel), 0);
    const wind = cells.reduce<Level>((acc, c) => worse(acc, c.windLevel), 0);
    return {
      cells,
      rain,
      snow,
      wind,
      level: worse(worse(rain, snow), wind),
      icy: cells.some((c) => c.icy),
    };
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
    let rainPeak = 0;
    let snowPeak = 0;
    let snowTotal = 0;
    let water = 0;
    for (let h = Math.floor(a / 60); h * 60 < b; h++) {
      const s = split(byT.get(zonedToUtc(y, m, d, h, 0, o.tz)));
      peak = Math.max(peak, s.mm);
      total += s.mm;
      rainPeak = Math.max(rainPeak, s.rain);
      snowPeak = Math.max(snowPeak, s.snow);
      snowTotal += s.snow;
      water += s.water;
    }
    // Only on A–C days: on D/E/F the grade already says "don't". The total counts snow as water.
    const flag =
      gradeToLight(grade) < 2 &&
      (rainPeak > o.rainOk || total > MIDDAY_TOTAL_FACTOR * o.rainOk || snowLevel(snowPeak) >= 2);
    return {
      mm: peak,
      total,
      rain: rainLevel(rainPeak, o),
      snow: snowPeak,
      snowTotal,
      snowLevel: snowLevel(snowPeak),
      snowDom: water > 0.5 * total,
      flag,
    };
  };

  // Walk forward from today, keeping workdays until we have `days`. Today is skipped once its home window is over.
  const days: CommuteDay[] = [];
  let prevIso: number | null = null;
  for (const [i, base] of buildDays(now, o.tz, 21, o.names).entries()) {
    if (days.length >= o.days) break;
    const p = localParts(base.dayStart + 12 * H, o.tz);
    const iso = isoWd(p.wd);
    if (!o.workdays.includes(iso)) continue;
    if (i === 0 && now >= zonedMin(p, o.home[1], o.tz)) continue;

    const toWork = windowFor(p.y, p.m, p.d, o.toWork);
    const home = windowFor(p.y, p.m, p.d, o.home);

    const grade = gradeDay(toWork.level, home.level);
    const midday = middayFor(p.y, p.m, p.d, o.midday, grade);

    // Precipitation words from the worse of rain and snow (snow wins a tie), then wind, then icy.
    const words = (w: CommuteWindow): string =>
      [
        w.snow >= w.rain ? snowWords[w.snow] : rainWords[w.rain],
        windWords[w.wind],
        w.icy ? ph.icy : "",
      ]
        .filter(Boolean)
        .join(ph.and);
    const bits: string[] = [];
    if (toWork.level || toWork.icy) bits.push(ph.toWork(words(toWork)));
    if (home.level || home.icy) bits.push(ph.home(words(home)));
    const unknown = [...toWork.cells, ...home.cells].some((c) => c.missing);
    const reason = unknown
      ? ph.noData
      : `${bits.length ? bits.join(ph.sep) : ph.dryCalm}${midday.flag ? (midday.snowDom ? ph.middayFlagSnow : ph.middayFlag) : ""}`;

    // Days are walked in order, so a weekday at or before the previous one means the week wrapped.
    const newWeek = prevIso !== null && iso <= prevIso;

    days.push({
      ...base,
      full: i === 0 ? today : i === 1 ? tomorrow : base.full,
      newWeek,
      toWork,
      midday,
      home,
      grade,
      unknown,
      light: gradeToLight(grade),
      reason,
    });
    prevIso = iso;
  }

  return { days };
}
