/**
 * Tiny i18n layer. Two languages: English and Norwegian (Bokmål).
 * Language is picked from the Home Assistant user/instance locale; anything
 * that isn't recognisably Norwegian falls back to English.
 *
 * Day names come from `Intl` so they stay correct without a hand-kept table.
 * All strings here are plain (no lit dependency) — the card assembles the HTML.
 */
import type { HassLike } from "./types";

export type Lang = "en" | "nb";

export function pickLang(hass?: HassLike): Lang {
  const raw = (
    hass?.locale?.language ??
    hass?.language ??
    hass?.config?.language ??
    "en"
  ).toLowerCase();
  return raw.startsWith("nb") || raw.startsWith("nn") || raw.startsWith("no") ? "nb" : "en";
}

export interface DayNames {
  /** 0 = Sun … 6 = Sat */
  short: string[];
  full: string[];
}

/** A sentence fragment: plain text, or a bolded run (`gain` also takes the accent colour). */
export type Seg = string | { b: string; gain?: boolean };

const cap1 = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const dayCache = new Map<Lang, DayNames>();

export function dayNames(lang: Lang): DayNames {
  let d = dayCache.get(lang);
  if (!d) {
    const locale = lang === "nb" ? "nb-NO" : "en-US";
    const sf = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    const ff = new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" });
    const short: string[] = [];
    const full: string[] = [];
    const base = Date.UTC(2023, 0, 1); // a Sunday
    for (let i = 0; i < 7; i++) {
      const day = new Date(base + i * 86_400_000);
      short.push(cap1(sf.format(day).replace(/\.$/, "")));
      full.push(cap1(ff.format(day)));
    }
    d = { short, full };
    dayCache.set(lang, d);
  }
  return d;
}

export type WashKind = "clear" | "dryBeforeDrive" | "wetWhileDriving";

export interface Strings {
  hUnit: string; // hour abbreviation, "h" / "t"

  // header / loading state
  updating: string;
  loadErr: string;
  fetching: (lat: string, lon: string) => string;

  // --- work mode ---
  goTonight: string;
  goTonightOnly: (list: string) => string;
  passedToday: string;
  notTonight: string;
  tonight: string;
  needDry: (mm: number) => string;
  needDryAfter: (mm: number, after: number) => string;
  noDayMeets: string;
  /** Hero detail: ground wetness when the window opens. */
  wetAtOpen: (mm: string) => string;
  afterPart: (x: string) => string;
  ofLight: (dur: string) => string;
  longestPart: (full: string, dur: string) => string;
  noWindowWeek: string;
  colDay: string;
  colDryBy: string;
  /** Dry-by cell: "{task} {time}", time "—" when never dry in forecast. */
  dryByCell: (task: string, time: string) => string;
  dryByHead: (mm: string, time: string) => string;
  dryByOk: (task: string) => string;
  dryByLater: (task: string, time: string) => string;
  dryByNever: (task: string) => string;
  colWindow: string;
  colAfter: string;
  colGood: string;
  rowRain: string;
  rowPassed: string;
  rowDark: string;
  dusk: string;
  sunset: string;

  // --- info popover (design F) ---
  popHeadWash: string;
  popHeadWork: string;
  popHeadCommute: string;
  popWashFrom: string;
  popWetAbove: string;
  popDryAgain: string;
  popNightDry: string;
  popParked: string;
  popNoSalt: string;
  popWetVal: (mm: number) => string;
  popSpan: (from: string, until: string) => string;
  popParkedVal: (from: string, until: string, days: string) => string;
  popWeekdayWin: string;
  popWeekendWin: string;
  popIgnoreUnder: string;
  popCountsRain: string;
  popHours: (h: number) => string;
  popMinutes: (m: number) => string;
  popAboveRate: (mm: number) => string;
  popWetMax: (mm: number) => string;
  popWetMaxAfter: (mm: number, after: number) => string;
  popWetness: string;
  popSrc: (model: string) => string;

  // --- car wash mode ---
  dash: string;
  nothingClean: string;
  cleanDays: (n: number, open: boolean) => string;
  // hero — design E: alert banner + labelled recommendation + trade-off line
  /** Uppercase red banner label. */
  bannerLbl: string;
  /** Banner body when tonight can't be washed at all. */
  bannerRain: (washStart: string) => string;
  /** Banner body when tonight is washable but nothing survives tomorrow (streak 0). */
  bannerBrief: (describe: string) => string;
  /** Banner body when tonight works but only briefly. */
  bannerLasts: (n: number, describe: string) => string;
  /** Banner body fallback when the breaking day is unknown. */
  bannerLastsNoBreak: (n: number) => string;
  /** Small uppercase caption above the recommended day. */
  capBest: string;
  capWashOn: string;
  capOutlook: string;
  /** Context line for the skip state: lead-in before the "stays clean …" tail. */
  ctxSkipFrom: (washStart: string, waitDays: number) => string;
  ctxStaysUntil: (describe: string) => string;
  ctxStaysPast: string;
  whyOkBreak: (washStart: string, describe: string) => string;
  whyOkNoRain: (washStart: string) => string;
  whyNone: string;
  /** Trade-off line, as bold-aware segments. */
  tradeoffFirst: (bestFull: string) => Seg[];
  tradeoffBuys: (waitDays: number, gain: number, openGain: boolean) => Seg[];
  tradeoffOnly: (waitDays: number) => Seg[];
  /** "Monday's wet roads (from 07:00)" */
  describe: (full: string, from: string) => string;
  sectAsk: string;
  outTip: (streak: number, open: boolean) => string;
  /** Tip when the roads are wet at wash time (a "—" day). */
  outDirty: string;
  /** Headline sentence when the next dirty stretch is known. */
  outNextRain: (day: string, from: string, to: string, hours: number) => string;
  statTotal: string;
  statPeak: string;
  unitMm: string; // "mm"
  unitRate: string; // "mm/h" / "mm/t"
  tagTonight: string;
  tagBest: string;
  tagNow: string;
  dry: string;
  mm: (peak: string) => string;
  whenClear: string;
  whenDry: string;
  whenWet: string;
  /** Day hint; `time` = first wet driving hour (wetWhileDriving only), `salted` = roads were salted then. */
  washInfo: (kind: WashKind, time: string, salted?: boolean) => string;
  outDays: (streak: number, open: boolean) => string;

  // --- commute mode ---
  /** Fragments the reason line is built from (see CommutePhrases). */
  cRain: string;
  cLightRain: string;
  cStrongWind: string;
  cBreezy: string;
  cCloudburst: string;
  cDangerousGusts: string;
  cLightSnow: string;
  cSnow: string;
  cHeavySnow: string;
  cIcy: string;
  cToWork: (what: string) => string;
  cHome: (what: string) => string;
  cAnd: string;
  cSep: string;
  cDryCalm: string;
  cMiddayFlag: string;
  cMiddayFlagSnow: string;
  cNoData: string;
  cToday: string;
  cTomorrow: string;
  /** Hero captions and verdicts, indexed by traffic light 0/1/2. */
  cCaption: [string, string, string];
  cVerdict: [string, string, string];
  /** Grade F overrides the light-indexed caption/verdict. */
  cCaptionF: string;
  cVerdictF: string;
  /** Tile hint: hour, rain, effective/mean/gust wind (pre-formatted). */
  cTileHint: (hh: string, mm: string, eff: string, mean: string, gust: string) => string;
  /** Tile hint for a snow-dominated hour: snowfall in cm. */
  cTileHintSnow: (hh: string, cm: string, eff: string, mean: string, gust: string) => string;
  /** Second hint line: temperature, plus the icy suffix. */
  cHintTemp: (temp: string, icy: boolean) => string;
  cNoDays: string;
  cNextWeek: string;
  cOutlook: string;
  // column headers — cColToWork/cColHome take "HH"–"HH" strings
  cColDay: string;
  cColGrade: string;
  cColToWork: (from: string, to: string) => string;
  cColMidday: string;
  cColHome: (from: string, to: string) => string;
  // popover
  popCommuteTile: string;
  popRainUnit: string;
  popWindUnit: string;
  popTileNote: string;
  popScales: string;
  popFine: string;
  popTolerable: string;
  popBad: string;
  popRainLabel: string;
  popWindLabel: string;
  popDayGrade: string;
  popGradeA: string;
  popGradeB: string;
  popGradeC: string;
  popGradeD: string;
  popGradeE: string;
  popGradeF: string;
  popDanger: string;
  popDangerLine: (rain: number, wind: number) => string;
  popEffWind: (pct: number) => string;
  popSnowUnit: string;
  popSnowLabel: string;
  popSnowLine: (ok: number, danger: number) => string;
  popIcyLine: (night: number, now: number) => string;
  /** `summer` = what the weather guess says */
  popTyresAuto: (summer: boolean) => string;
  popTyresEntity: (entity: string, winter: boolean | null, summerGuess: boolean) => string;
  popMidday: string;
  popCommuteNote: (toA: string, toB: string, homeA: string, homeB: string) => string;

  // --- config defaults ---
  defWorkTitle: string;
  defWorkSub: string;
  defWashTitle: string;
  defWashSub: string;
  defCommuteTitle: string;
  defCommuteSub: (toA: string, toB: string, homeA: string, homeB: string) => string;
  taskMow: string;
  taskPaint: string;

  // --- editor ---
  ed: EditorStrings;
}

export interface EditorStrings {
  modeWork: string;
  modeWash: string;
  modeCommute: string;
  modelMetno: string;
  modelBest: string;
  modelEcmwf: string;
  winDusk: string;
  winSunset: string;
  locationSource: string;
  presetFair: string;
  presetEveryday: string;
  presetAll: string;
  presetCustom: string;
  labels: Record<string, string>;
  helpers: Record<string, string>;
  noteTasks1: string;
  noteTasks2: string; // shown between two <code> chunks
  noteTasks3: string;
  noteFetch: string;
}

const EN: Strings = {
  hUnit: "h",
  updating: "updating…",
  loadErr: "Couldn't load the forecast:",
  fetching: (lat, lon) => `Fetching forecast and recent rain for ${lat}, ${lon}…`,

  goTonight: "Go tonight",
  goTonightOnly: (list) => `Go tonight · ${list} only`,
  passedToday: "Today's window has passed",
  notTonight: "Not tonight",
  tonight: "Tonight",
  needDry: (mm) => `dry ground (≤ ${mm} mm)`,
  needDryAfter: (mm, a) => `dry ground (≤ ${mm} mm) · ${a} h no rain after`,
  noDayMeets: "No day in the outlook meets that.",
  wetAtOpen: (mm) => `${mm} mm at window open`,
  afterPart: (x) => ` · ${x} dry after`,
  ofLight: (dur) => ` · ${dur} of light`,
  longestPart: (full, dur) => ` · longest: ${full} (${dur})`,
  noWindowWeek: "No window this week",
  colDay: "Day",
  colDryBy: "Dry by",
  dryByCell: (task, time) => `${task} ${time}`,
  dryByHead: (mm, time) => `Ground wetness ${mm} mm at ${time}`,
  dryByOk: (task) => `${task} OK`,
  dryByLater: (task, time) => `${task} dry from ${time}`,
  dryByNever: (task) => `${task} not dry in forecast`,
  colWindow: "Window",
  colAfter: "Dry after",
  colGood: "Good for",
  rowRain: "rain",
  rowPassed: "passed",
  rowDark: "dark",
  dusk: "dusk",
  sunset: "sunset",

  popHeadWash: "How evenings are judged",
  popHeadWork: "How days are judged",
  popHeadCommute: "How this card decides",
  popWashFrom: "Wash from",
  popWetAbove: "Roads wet above",
  popDryAgain: "Dry again after",
  popNightDry: "Night (no driving, half-speed drying)",
  popParked: "Parked indoors",
  popNoSalt:
    "After frost, roads count as salted until ~10 mm of rain has washed them — then any moisture counts as wet.",
  popWetVal: (mm) => `${mm} mm/h`,
  popSpan: (from, until) => `${from}–${until}`,
  popParkedVal: (from, until, days) => `${from}–${until} on ${days}`,
  popWeekdayWin: "Weekday window",
  popWeekendWin: "Weekend window",
  popIgnoreUnder: "Ignore windows under",
  popCountsRain: "Counts as rain",
  popHours: (h) => `${h} h without rain`,
  popMinutes: (m) => `${m} min`,
  popAboveRate: (mm) => `above ${mm} mm/h`,
  popWetMax: (mm) => `≤ ${mm} mm`,
  popWetMaxAfter: (mm, after) => `≤ ${mm} mm · ${after} h after`,
  popWetness:
    "Ground wetness: rain adds to it, evaporation (sun, wind, warmth) removes it — about 1–2 mm a day in autumn, 3–5 in summer.",
  popSrc: (model) => `Open-Meteo · ${model}`,

  dash: "—",
  nothingClean: "nothing stays clean",
  cleanDays: (n, open) =>
    n === 0 && !open
      ? "clean, but not past tomorrow"
      : `${n}${open ? "+" : ""} clean ${n === 1 && !open ? "day" : "days"}`,
  bannerLbl: "Skip today",
  bannerRain: (ws) => `wet roads around ${ws} rule out washing tonight`,
  bannerBrief: (desc) => `a wash now won't last the day — ${desc}`,
  bannerLasts: (n, desc) => `a wash now lasts ${n} ${n === 1 ? "day" : "days"} — ${desc}`,
  bannerLastsNoBreak: (n) => `a wash now lasts ${n} ${n === 1 ? "day" : "days"}`,
  capBest: "Best evening to wash",
  capWashOn: "Wash on",
  capOutlook: "Outlook",
  ctxSkipFrom: (ws, w) => `From ${ws}, ${w === 1 ? "tomorrow" : `${w} days from now`} · `,
  ctxStaysUntil: (desc) => `stays clean until ${desc}.`,
  ctxStaysPast: "stays clean past the end of the outlook.",
  whyOkBreak: (ws, desc) => `Dry roads from ${ws} tonight. Stays clean until ${desc}.`,
  whyOkNoRain: (ws) => `Dry roads from ${ws} tonight, and no wet driving in the whole outlook.`,
  whyNone: "Every evening in the outlook is followed by wet roads while you drive within a day.",
  tradeoffFirst: (best) => [`${best} is the first evening that works.`],
  tradeoffBuys: (w, gain, open) => [
    "Waiting ",
    { b: `${w} ${w === 1 ? "day" : "days"}` },
    " buys ",
    { b: `${gain}${open ? "+" : ""} more`, gain: true },
    " clean days.",
  ],
  tradeoffOnly: (w) => [
    "Waiting ",
    { b: `${w} ${w === 1 ? "day" : "days"}` },
    " buys only ",
    { b: "1 more", gain: true },
    " clean day — tonight is nearly as good.",
  ],
  describe: (full, from) => `${full}'s wet roads (from ${from})`,
  sectAsk: "When to wash?",
  outTip: (streak, open) =>
    streak === 0 && !open
      ? "No upcoming dry-roads streak"
      : `${streak}+ days until you'd drive on wet roads`,
  outDirty: "Roads wet at or after wash time",
  outNextRain: (day, from, to, hours) =>
    `Roads wet while driving ${day} ${from}–${to} (${hours} h)`,
  statTotal: "Total",
  statPeak: "Peak",
  unitMm: "mm",
  unitRate: "mm/h",
  tagTonight: "Tonight",
  tagBest: "Best",
  tagNow: "Now",
  dry: "dry",
  mm: (peak) => `${peak} mm`,
  whenClear: "clear",
  whenDry: "dries off",
  whenWet: "wet roads",
  washInfo: (kind, time, salted) =>
    kind === "clear"
      ? "No rain forecast — roads stay dry."
      : kind === "dryBeforeDrive"
        ? "Rain, but roads are dry again before you drive."
        : salted
          ? `Salted roads wet while you drive from ${time}.`
          : `Roads wet while you drive from ${time}.`,
  outDays: (streak, open) => `${streak}${open ? "+" : ""} d`,

  cRain: "rain",
  cLightRain: "light rain",
  cStrongWind: "strong wind",
  cBreezy: "breezy",
  cCloudburst: "cloudburst",
  cDangerousGusts: "dangerous gusts",
  cLightSnow: "light snow",
  cSnow: "snow",
  cHeavySnow: "heavy snow",
  cIcy: "icy roads possible",
  cToWork: (w) => `${w} to work`,
  cHome: (w) => `${w} home`,
  cAnd: " + ",
  cSep: " · ",
  cDryCalm: "dry and calm both ways",
  cMiddayFlag: " · heavy rain midday — consider home office",
  cMiddayFlagSnow: " · heavy snow midday — consider home office",
  cNoData: "no forecast yet",
  cToday: "Today",
  cTomorrow: "Tomorrow",
  cCaption: ["Good day to ride", "Rideable, with a catch", "Home office day"],
  cVerdict: ["Bike", "Bike if you can bear it", "Take the home office"],
  cCaptionF: "Dangerous to ride",
  cVerdictF: "Don't bike",
  cTileHint: (hh, mm, eff, mean, gust) =>
    `${hh}:00 · ${mm} mm · wind ${eff} m/s (mean ${mean}, gusts ${gust})`,
  cTileHintSnow: (hh, cm, eff, mean, gust) =>
    `${hh}:00 · ${cm} cm snow · wind ${eff} m/s (mean ${mean}, gusts ${gust})`,
  cHintTemp: (temp, icy) => `${temp} °C${icy ? ", wet earlier" : ""}`,
  cNoDays: "No commute days in the forecast.",
  cNextWeek: "Next week",
  cOutlook: "outlook",
  cColDay: "Day",
  cColGrade: "Grade",
  cColToWork: (a, b) => `To work ${a}–${b}`,
  cColMidday: "Midday",
  cColHome: (a, b) => `Home ${a}–${b}`,
  popCommuteTile: "In each hour tile",
  popRainUnit: "rain, mm/h",
  popWindUnit: "effective wind, m/s",
  popTileNote: "Each icon is coloured by its own scale; the tile takes the worse of the two.",
  popScales: "Scales",
  popFine: "fine",
  popTolerable: "tolerable",
  popBad: "bad",
  popRainLabel: "rain",
  popWindLabel: "wind",
  popDayGrade: "Day grade",
  popGradeA: "both commutes fine",
  popGradeB: "one commute tolerable",
  popGradeC: "both commutes tolerable",
  popGradeD: "one commute bad",
  popGradeE: "both commutes bad",
  popGradeF: "a commute hour is dangerous",
  popDanger: "dangerous",
  popDangerLine: (rain, wind) =>
    `Dangerous: rain above ${rain} mm/h or effective wind above ${wind} m/s, whatever your thresholds.`,
  popEffWind: (pct) =>
    `Effective wind is the mean, or ${pct}% of the gust speed when gusts are unusually strong.`,
  popSnowUnit: "snowfall, cm/h (when snow dominates)",
  popSnowLabel: "snow",
  popSnowLine: (ok, danger) =>
    `Snow, cm/h: fine none · tolerable ≤ ${ok} · bad > ${ok} · dangerous > ${danger}`,
  popIcyLine: (night, now) =>
    `Snowflake badge: road may be icy on summer tyres (wet road, night ≤ +${night} °C, now ≤ +${now} °C). Doesn't change the grade.`,
  popTyresAuto: (summer) =>
    summer
      ? "Summer tyres assumed: no frost in the days before yesterday and no snow on the ground"
      : "Winter tyres assumed: frost in the days before yesterday or snow on the ground",
  popTyresEntity: (entity, winter, summerGuess) =>
    `Tyres from ${entity}: ${winter === null ? `unavailable, guessing ${summerGuess ? "summer" : "winter"}` : winter ? "winter" : "summer"}`,
  popMidday:
    "Midday doesn't change the grade. A red outline means heavy midday rain or snow — the forecast may be off by an hour or two.",
  popCommuteNote: (toA, toB, homeA, homeB) =>
    `A commute is judged by its worst hour and the grade covers the whole day. To work ${toA}–${toB} · home ${homeA}–${homeB}.`,

  defWorkTitle: "Outdoor Work",
  defWorkSub: "Dry-ground windows after work",
  defWashTitle: "Car Wash",
  defWashSub: "Which evening keeps it clean longest",
  defCommuteTitle: "Bike to Work",
  defCommuteSub: (toA, toB, homeA, homeB) => `Commute ${toA}–${toB} and ${homeA}–${homeB}`,
  taskMow: "Mow",
  taskPaint: "Paint",

  ed: {
    modeWork: "Outdoor work — dry-ground windows after work",
    modeWash: "Car wash — best evening for a lasting wash",
    modeCommute: "Bike to work — grade each workday’s commutes",
    modelMetno: "MET Nordic 1 km (Norway, Sweden, Denmark, Finland) — recommended",
    modelBest: "Open-Meteo best match (anywhere)",
    modelEcmwf: "ECMWF IFS 0.25°",
    winDusk: "Civil dusk",
    winSunset: "Sunset",
    locationSource: "Location & data source",
    presetFair: "Fair-weather",
    presetEveryday: "Everyday",
    presetAll: "All-weather",
    presetCustom: "Custom",
    labels: {
      mode: "Card mode",
      title: "Title",
      subtitle: "Subtitle",
      days: "Days to show",
      refresh_minutes: "Refresh every",
      latitude: "Latitude (blank = home)",
      longitude: "Longitude (blank = home)",
      model: "Weather model",
      accent: "Accent colour (CSS)",
      weekday_start: "Weekday window opens",
      weekend_start: "Weekend window opens",
      window_end: "Window closes at",
      min_window_minutes: "Ignore windows shorter than",
      rain_threshold: "Rain that counts as rain",
      wash_start: "Wash time",
      ok_rain: "Wet-road threshold",
      night_from: "Night starts",
      night_until: "Night ends",
      dry_roads_hours: "Dry again after (hours)",
      parked_start: "Parked from",
      parked_end: "Parked until",
      to_work_start: "Ride to work from",
      to_work_end: "Ride to work until",
      home_start: "Ride home from",
      home_end: "Ride home until",
      rain_fine: "Rain is fine up to",
      rain_ok: "Rain is tolerable up to",
      wind_fine: "Wind is fine up to",
      wind_ok: "Wind is tolerable up to",
      preset: "Rider type",
      workdays: "Commute days",
      parked_days: "Parked on",
      winter_tyres_entity: "Winter tyres entity",
    },
    helpers: {
      rain_threshold:
        'Rain above this inside the window rules it out, and ends the "dry after" runway. Ground wetness counts all rain.',
      ok_rain: "Rain per hour that makes roads wet",
      parked_start: "Optional: hours your car is parked indoors on workdays",
      min_window_minutes: "Evenings with less daylight than this are shown but never recommended.",
      model: "MET Nordic is the same model behind Yr; it only covers the Nordics.",
      accent: "Leave blank for the mode default (green for work, blue for car wash).",
      dry_roads_hours: "Rain-free hours until roads are dry (half speed at night)",
      rain_ok: 'Above this an hour is "bad". Between fine and this it is "tolerable".',
      wind_ok:
        'Effective wind at 10 m (mean, or more with strong gusts). Above this an hour is "bad".',
      preset: "Fills the rain and wind thresholds below",
      workdays: "The card shows the next five of these, skipping the others.",
      parked_days: "Days the parked window applies.",
      winter_tyres_entity:
        "On = winter tyres (no icy-road badges). Leave empty to guess from recent weather.",
    },
    noteTasks1: "Activities default to ",
    noteTasks2: " (≤ 0.3 mm wet) and ",
    noteTasks3:
      " (≤ 0.1 mm wet, 24 h no rain after). Add or change them in YAML with tasks: — e.g. - name: Stain deck, max_wet: 0.05, after: 12.",
    noteFetch:
      "The card fetches Open-Meteo directly from the browser — no sensors or helpers needed. Location defaults to your home.",
  },
};

const NB: Strings = {
  hUnit: "t",
  updating: "oppdaterer…",
  loadErr: "Kunne ikke laste værvarselet:",
  fetching: (lat, lon) => `Henter varsel og nylig nedbør for ${lat}, ${lon}…`,

  goTonight: "Kjør på i kveld",
  goTonightOnly: (list) => `Kjør på i kveld · kun ${list}`,
  passedToday: "Kveldens vindu er passert",
  notTonight: "Ikke i kveld",
  tonight: "I kveld",
  needDry: (mm) => `tørr bakke (≤ ${mm} mm)`,
  needDryAfter: (mm, a) => `tørr bakke (≤ ${mm} mm) · ${a} t uten regn etter`,
  noDayMeets: "Ingen dag i varselet klarer det.",
  wetAtOpen: (mm) => `${mm} mm når vinduet åpner`,
  afterPart: (x) => ` · ${x} tørt etter`,
  ofLight: (dur) => ` · ${dur} med lys`,
  longestPart: (full, dur) => ` · lengst: ${full} (${dur})`,
  noWindowWeek: "Ingen vindu denne uka",
  colDay: "Dag",
  colDryBy: "Tørt kl.",
  dryByCell: (task, time) => `${task} ${time}`,
  dryByHead: (mm, time) => `Fuktighet i bakken ${mm} mm kl. ${time}`,
  dryByOk: (task) => `${task} OK`,
  dryByLater: (task, time) => `${task} tørt fra ${time}`,
  dryByNever: (task) => `${task} ikke tørt i varselet`,
  colWindow: "Vindu",
  colAfter: "Tørt etter",
  colGood: "Egnet for",
  rowRain: "regn",
  rowPassed: "passert",
  rowDark: "mørkt",
  dusk: "skumring",
  sunset: "solnedgang",

  popHeadWash: "Slik vurderes kveldene",
  popHeadWork: "Slik vurderes dagene",
  popHeadCommute: "Slik bestemmer kortet",
  popWashFrom: "Vask fra",
  popWetAbove: "Våte veier over",
  popDryAgain: "Tørre igjen etter",
  popNightDry: "Natt (ingen kjøring, halv tørkefart)",
  popParked: "Parkert innendørs",
  popNoSalt:
    "Etter frost regnes veiene som saltet til ~10 mm regn har vasket dem — imens teller all fukt som vått.",
  popWetVal: (mm) => `${mm} mm/t`,
  popSpan: (from, until) => `${from}–${until}`,
  popParkedVal: (from, until, days) => `${from}–${until} på ${days}`,
  popWeekdayWin: "Hverdagsvindu",
  popWeekendWin: "Helgevindu",
  popIgnoreUnder: "Ignorer vinduer under",
  popCountsRain: "Teller som regn",
  popHours: (h) => `${h} t uten regn`,
  popMinutes: (m) => `${m} min`,
  popAboveRate: (mm) => `over ${mm} mm/t`,
  popWetMax: (mm) => `≤ ${mm} mm`,
  popWetMaxAfter: (mm, after) => `≤ ${mm} mm · ${after} t etter`,
  popWetness:
    "Fukt i bakken: regn legger til, fordampning (sol, vind, varme) trekker fra — rundt 1–2 mm i døgnet om høsten, 3–5 om sommeren.",
  popSrc: (model) => `Open-Meteo · ${model}`,

  dash: "—",
  nothingClean: "ingenting holder seg rent",
  cleanDays: (n, open) =>
    n === 0 && !open
      ? "rent, men ikke forbi i morgen"
      : `${n}${open ? "+" : ""} rene ${n === 1 && !open ? "dag" : "dager"}`,
  bannerLbl: "Dropp i dag",
  bannerRain: (ws) => `våte veier rundt ${ws} utelukker vask i kveld`,
  bannerBrief: (desc) => `en vask nå holder ikke dagen ut — ${desc}`,
  bannerLasts: (n, desc) => `en vask nå varer ${n} ${n === 1 ? "dag" : "dager"} — ${desc}`,
  bannerLastsNoBreak: (n) => `en vask nå varer ${n} ${n === 1 ? "dag" : "dager"}`,
  capBest: "Beste kveld å vaske",
  capWashOn: "Vask",
  capOutlook: "Utsikter",
  ctxSkipFrom: (ws, w) => `Fra ${ws}, ${w === 1 ? "i morgen" : `om ${w} dager`} · `,
  ctxStaysUntil: (desc) => `holder seg rent til ${desc}.`,
  ctxStaysPast: "holder seg rent forbi slutten av varselet.",
  whyOkBreak: (ws, desc) => `Tørre veier fra ${ws} i kveld. Holder seg rent til ${desc}.`,
  whyOkNoRain: (ws) => `Tørre veier fra ${ws} i kveld, og ingen våte veier i hele varselet.`,
  whyNone: "Hver kveld i varselet følges av våte veier mens du kjører innen et døgn.",
  tradeoffFirst: (best) => [`${best} er første kveld som funker.`],
  tradeoffBuys: (w, gain, open) => [
    "Å vente ",
    { b: `${w} ${w === 1 ? "dag" : "dager"}` },
    " gir ",
    { b: `${gain}${open ? "+" : ""} flere`, gain: true },
    " rene dager.",
  ],
  tradeoffOnly: (w) => [
    "Å vente ",
    { b: `${w} ${w === 1 ? "dag" : "dager"}` },
    " gir bare ",
    { b: "1 dag", gain: true },
    " mer — i kveld er nesten like bra.",
  ],
  describe: (full, from) => `våte veier ${full.toLowerCase()} (fra ${from})`,
  sectAsk: "Når skal du vaske?",
  outTip: (streak, open) =>
    streak === 0 && !open
      ? "Ingen kommende periode med tørre veier"
      : `${streak}+ dager til du kjører på våte veier`,
  outDirty: "Våte veier ved eller etter vasketid",
  outNextRain: (day, from, to, hours) =>
    `Våte veier mens du kjører ${day} ${from}–${to} (${hours} t)`,
  statTotal: "Totalt",
  statPeak: "Topp",
  unitMm: "mm",
  unitRate: "mm/t",
  tagTonight: "I kveld",
  tagBest: "Best",
  tagNow: "Nå",
  dry: "tørt",
  mm: (peak) => `${peak} mm`,
  whenClear: "klart",
  whenDry: "tørker opp",
  whenWet: "våte veier",
  washInfo: (kind, time, salted) =>
    kind === "clear"
      ? "Ingen nedbør meldt — veiene holder seg tørre."
      : kind === "dryBeforeDrive"
        ? "Regn, men veiene er tørre igjen før du kjører."
        : salted
          ? `Saltede veier våte mens du kjører fra ${time}.`
          : `Våte veier mens du kjører fra ${time}.`,
  outDays: (streak, open) => `${streak}${open ? "+" : ""} d`,

  cRain: "regn",
  cLightRain: "lett regn",
  cStrongWind: "sterk vind",
  cBreezy: "vindfullt",
  cCloudburst: "styrtregn",
  cDangerousGusts: "farlige vindkast",
  cLightSnow: "lett snø",
  cSnow: "snø",
  cHeavySnow: "kraftig snø",
  cIcy: "mulig glatte veier",
  cToWork: (w) => `${w} til jobb`,
  cHome: (w) => `${w} hjem`,
  cAnd: " + ",
  cSep: " · ",
  cDryCalm: "tørt og vindstille begge veier",
  cMiddayFlag: " · kraftig regn midt på dagen — vurder hjemmekontor",
  cMiddayFlagSnow: " · kraftig snø midt på dagen — vurder hjemmekontor",
  cNoData: "ingen prognose ennå",
  cToday: "I dag",
  cTomorrow: "I morgen",
  cCaption: ["Fin dag å sykle", "Syklbart, med en hake", "Hjemmekontordag"],
  cVerdict: ["Sykle", "Sykle om du tåler det", "Ta hjemmekontor"],
  cCaptionF: "Farlig å sykle",
  cVerdictF: "Ikke sykle",
  cTileHint: (hh, mm, eff, mean, gust) =>
    `${hh}:00 · ${mm} mm · vind ${eff} m/s (middel ${mean}, kast ${gust})`,
  cTileHintSnow: (hh, cm, eff, mean, gust) =>
    `${hh}:00 · ${cm} cm snø · vind ${eff} m/s (middel ${mean}, kast ${gust})`,
  cHintTemp: (temp, icy) => `${temp} °C${icy ? ", vått tidligere" : ""}`,
  cNoDays: "Ingen pendledager i varselet.",
  cNextWeek: "Neste uke",
  cOutlook: "utsikter",
  cColDay: "Dag",
  cColGrade: "Karakter",
  cColToWork: (a, b) => `Til jobb ${a}–${b}`,
  cColMidday: "Midt på dagen",
  cColHome: (a, b) => `Hjem ${a}–${b}`,
  popCommuteTile: "I hver timerute",
  popRainUnit: "regn, mm/t",
  popWindUnit: "effektiv vind, m/s",
  popTileNote: "Hvert ikon fargelegges på sin egen skala; ruta tar den verste av de to.",
  popScales: "Skalaer",
  popFine: "fint",
  popTolerable: "tålelig",
  popBad: "dårlig",
  popRainLabel: "regn",
  popWindLabel: "vind",
  popDayGrade: "Dagskarakter",
  popGradeA: "begge turer fine",
  popGradeB: "en tur tålelig",
  popGradeC: "begge turer tålelige",
  popGradeD: "en tur dårlig",
  popGradeE: "begge turer dårlige",
  popGradeF: "en pendlertime er farlig",
  popDanger: "farlig",
  popDangerLine: (rain, wind) =>
    `Farlig: regn over ${rain} mm/t eller effektiv vind over ${wind} m/s, uansett dine terskler.`,
  popEffWind: (pct) =>
    `Effektiv vind er middelvinden, eller ${pct} % av kastene når de er uvanlig kraftige.`,
  popSnowUnit: "snøfall, cm/t (når snø dominerer)",
  popSnowLabel: "snø",
  popSnowLine: (ok, danger) =>
    `Snø, cm/t: fint ingen · tålelig ≤ ${ok} · dårlig > ${ok} · farlig > ${danger}`,
  popIcyLine: (night, now) =>
    `Snøfnugg-merke: veien kan være glatt på sommerdekk (våt vei, natt ≤ +${night} °C, nå ≤ +${now} °C). Endrer ikke karakteren.`,
  popTyresAuto: (summer) =>
    summer
      ? "Sommerdekk antatt: ingen frost dagene før i går og ingen snø på bakken"
      : "Vinterdekk antatt: frost dagene før i går eller snø på bakken",
  popTyresEntity: (entity, winter, summerGuess) =>
    `Dekk fra ${entity}: ${winter === null ? `utilgjengelig, gjetter ${summerGuess ? "sommer" : "vinter"}` : winter ? "vinter" : "sommer"}`,
  popMidday:
    "Midt på dagen endrer ikke karakteren. Rød kant betyr kraftig regn eller snø midt på dagen — varselet kan bomme med en time eller to.",
  popCommuteNote: (toA, toB, homeA, homeB) =>
    `En tur vurderes etter sin verste time, og karakteren gjelder hele dagen. Til jobb ${toA}–${toB} · hjem ${homeA}–${homeB}.`,

  defWorkTitle: "Utearbeid",
  defWorkSub: "Tørre vinduer etter jobb",
  defWashTitle: "Bilvask",
  defWashSub: "Hvilken kveld holder den lengst ren",
  defCommuteTitle: "Sykle til jobb",
  defCommuteSub: (toA, toB, homeA, homeB) => `Pendling ${toA}–${toB} og ${homeA}–${homeB}`,
  taskMow: "Klippe",
  taskPaint: "Male",

  ed: {
    modeWork: "Utearbeid — tørre vinduer etter jobb",
    modeWash: "Bilvask — beste kveld for en vask som varer",
    modeCommute: "Sykle til jobb — gi hver arbeidsdags pendling en karakter",
    modelMetno: "MET Nordic 1 km (Norge, Sverige, Danmark, Finland) — anbefalt",
    modelBest: "Open-Meteo beste treff (hvor som helst)",
    modelEcmwf: "ECMWF IFS 0,25°",
    winDusk: "Borgerlig skumring",
    winSunset: "Solnedgang",
    locationSource: "Sted og datakilde",
    presetFair: "Finværssyklist",
    presetEveryday: "Hverdagssyklist",
    presetAll: "Allværssyklist",
    presetCustom: "Egendefinert",
    labels: {
      mode: "Kortmodus",
      title: "Tittel",
      subtitle: "Undertittel",
      days: "Dager som vises",
      refresh_minutes: "Oppdater hvert",
      latitude: "Breddegrad (tom = hjem)",
      longitude: "Lengdegrad (tom = hjem)",
      model: "Værmodell",
      accent: "Aksentfarge (CSS)",
      weekday_start: "Hverdagsvindu åpner",
      weekend_start: "Helgevindu åpner",
      window_end: "Vindu lukkes",
      min_window_minutes: "Ignorer vinduer kortere enn",
      rain_threshold: "Regn som teller som regn",
      wash_start: "Vasketidspunkt",
      ok_rain: "Terskel for våte veier",
      night_from: "Natt starter",
      night_until: "Natt slutter",
      dry_roads_hours: "Tørre igjen etter (timer)",
      parked_start: "Parkert fra",
      parked_end: "Parkert til",
      to_work_start: "Sykler til jobb fra",
      to_work_end: "Sykler til jobb til",
      home_start: "Sykler hjem fra",
      home_end: "Sykler hjem til",
      rain_fine: "Regn er fint opptil",
      rain_ok: "Regn er tålelig opptil",
      wind_fine: "Vind er fin opptil",
      wind_ok: "Vind er tålelig opptil",
      preset: "Syklisttype",
      workdays: "Pendledager",
      parked_days: "Parkert på",
      winter_tyres_entity: "Vinterdekk-entitet",
    },
    helpers: {
      rain_threshold:
        'Regn over dette i vinduet utelukker det, og avslutter "tørt etter". Fukt i bakken teller alt regn.',
      ok_rain: "Regn per time som gjør veiene våte",
      parked_start: "Valgfritt: timer bilen står parkert innendørs på arbeidsdager",
      min_window_minutes: "Kvelder med mindre dagslys enn dette vises, men anbefales aldri.",
      model: "MET Nordic er samme modell som ligger bak Yr; den dekker bare Norden.",
      accent: "La stå tom for modusstandarden (grønn for arbeid, blå for bilvask).",
      dry_roads_hours: "Timer uten regn før veiene er tørre (halvt så fort om natta)",
      rain_ok: 'Over dette er en time "dårlig". Mellom fint og dette er den "tålelig".',
      wind_ok:
        'Effektiv vind på 10 m (middel, eller mer ved kraftige kast). Over dette er en time "dårlig".',
      preset: "Fyller ut regn- og vindtersklene under",
      workdays: "Kortet viser de neste fem av disse, og hopper over resten.",
      parked_days: "Dager parkeringsvinduet gjelder.",
      winter_tyres_entity:
        "På = vinterdekk (ingen glatt-vei-merker). La stå tom for å gjette ut fra været.",
    },
    noteTasks1: "Aktiviteter er som standard ",
    noteTasks2: " (≤ 0,3 mm fukt) og ",
    noteTasks3:
      " (≤ 0,1 mm fukt, 24 t uten regn etter). Legg til eller endre dem i YAML med tasks: — f.eks. - name: Beise terrasse, max_wet: 0.05, after: 12.",
    noteFetch:
      "Kortet henter Open-Meteo direkte fra nettleseren — ingen sensorer eller hjelpere trengs. Sted er som standard hjemmet ditt.",
  },
};

export function strings(lang: Lang): Strings {
  return lang === "nb" ? NB : EN;
}
