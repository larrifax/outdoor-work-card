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
  needBefore: (before: number) => string;
  needBeforeAfter: (before: number, after: number) => string;
  noDayMeets: string;
  dryBeforehand: (x: string) => string;
  afterPart: (x: string) => string;
  ofLight: (dur: string) => string;
  longestPart: (full: string, dur: string) => string;
  noWindowWeek: string;
  colDay: string;
  colBefore: string;
  colWindow: string;
  colAfter: string;
  colGood: string;
  rowRain: string;
  rowPassed: string;
  rowDark: string;
  dusk: string;
  sunset: string;
  taskPiece: (name: string, before: number, after?: number) => string;
  footWork: (a: {
    weekday: string;
    weekend: string;
    end: string;
    tasks: string;
    thr: number;
    cap: number;
    model: string;
  }) => string;

  // --- car wash mode ---
  washTonight: string;
  noGoodEvening: string;
  skipToday: string;
  dash: string;
  nothingClean: string;
  cleanDays: (n: number, open: boolean) => string;
  whyOkBreak: (washStart: string, describe: string) => string;
  whyOkNoRain: (washStart: string) => string;
  whyNone: (okRain: number) => string;
  whySkipHeadRain: string;
  whySkipHeadLasts: (n: number) => string;
  whySpoils: (describe: string) => string;
  describe: (full: string, night: boolean, peak: string) => string;
  sectAsk: string;
  outTip: (streak: number, open: boolean) => string;
  tagTonight: string;
  tagBest: string;
  tagNow: string;
  dry: string;
  mm: (peak: string) => string;
  whenClear: string;
  whenEarlier: string;
  whenNight: string;
  whenDaytime: string;
  outDays: (streak: number, open: boolean) => string;
  footWash: (a: {
    washStart: string;
    okRain: number;
    from: string;
    until: string;
    nightMax: number;
    model: string;
  }) => string;

  // --- config defaults ---
  defWorkTitle: string;
  defWorkSub: string;
  defWashTitle: string;
  defWashSub: string;
  taskMow: string;
  taskPaint: string;

  // --- editor ---
  ed: EditorStrings;
}

export interface EditorStrings {
  modeWork: string;
  modeWash: string;
  modelMetno: string;
  modelBest: string;
  modelEcmwf: string;
  winDusk: string;
  winSunset: string;
  locationSource: string;
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
  needBefore: (b) => `needs ${b} h dry before`,
  needBeforeAfter: (b, a) => `needs ${b} h before · ${a} h after`,
  noDayMeets: "No day in the outlook meets that.",
  dryBeforehand: (x) => `${x} dry beforehand`,
  afterPart: (x) => ` · ${x} after`,
  ofLight: (dur) => ` · ${dur} of light`,
  longestPart: (full, dur) => ` · longest: ${full} (${dur})`,
  noWindowWeek: "No window this week",
  colDay: "Day",
  colBefore: "Dry before",
  colWindow: "Window",
  colAfter: "Dry after",
  colGood: "Good for",
  rowRain: "rain",
  rowPassed: "passed",
  rowDark: "dark",
  dusk: "dusk",
  sunset: "sunset",
  taskPiece: (name, before, after) =>
    `${name}: ${before} h dry before${after !== undefined ? ` and ${after} h after` : ""}`,
  footWork: (a) =>
    `Windows open ${a.weekday} on weekdays and ${a.weekend} on weekends and run until ${a.end}. ${a.tasks}. Rain above ${a.thr} mm/h counts. Bars cap at ${a.cap} h. Data: Open-Meteo (${a.model}).`,

  washTonight: "Wash tonight",
  noGoodEvening: "No good evening in sight",
  skipToday: "Skip today",
  dash: "—",
  nothingClean: "nothing stays clean",
  cleanDays: (n, open) =>
    n === 0 && !open
      ? "clean, but not past tomorrow"
      : `${n}${open ? "+" : ""} clean ${n === 1 && !open ? "day" : "days"}`,
  whyOkBreak: (ws, desc) => `Dry from ${ws} tonight. Stays clean until ${desc}.`,
  whyOkNoRain: (ws) => `Dry from ${ws} tonight, and no spoiling rain in the whole outlook.`,
  whyNone: (okRain) =>
    `Every evening in the outlook is followed by rain above ${okRain} mm/h within a day.`,
  whySkipHeadRain: "Rain tonight rules out washing today",
  whySkipHeadLasts: (n) =>
    n === 0
      ? `A wash today won't survive tomorrow`
      : `A wash today lasts only ${n} ${n === 1 ? "day" : "days"}`,
  whySpoils: (desc) => ` — ${desc} spoils it.`,
  describe: (full, night, peak) => `${full}'s ${night ? "night" : "daytime"} rain (${peak} mm/h)`,
  sectAsk: "When to wash?",
  outTip: (streak, open) =>
    streak === 0 && !open
      ? "No upcoming dry-weather streak"
      : `${streak}${open ? "+" : ""} day${streak === 1 && !open ? "" : "s"} until next real rainfall`,
  tagTonight: "Tonight",
  tagBest: "Best",
  tagNow: "Now",
  dry: "dry",
  mm: (peak) => `${peak} mm`,
  whenClear: "clear",
  whenEarlier: "earlier",
  whenNight: "night",
  whenDaytime: "daytime",
  outDays: (streak, open) => `${streak}${open ? "+" : ""} d`,
  footWash: (a) =>
    `Washing from ${a.washStart}. Rain up to ${a.okRain} mm/h is fine; heavier daytime rain ends the clean streak. Night (${a.from}–${a.until}) tolerates up to ${a.nightMax} mm/h. Data: Open-Meteo (${a.model}).`,

  defWorkTitle: "Outdoor Work",
  defWorkSub: "Dry-ground windows after work",
  defWashTitle: "Car Wash",
  defWashSub: "Which evening keeps it clean longest",
  taskMow: "Mow",
  taskPaint: "Paint",

  ed: {
    modeWork: "Outdoor work — dry-ground windows after work",
    modeWash: "Car wash — best evening for a lasting wash",
    modelMetno: "MET Nordic 1 km (Norway, Sweden, Denmark, Finland) — recommended",
    modelBest: "Open-Meteo best match (anywhere)",
    modelEcmwf: "ECMWF IFS 0.25°",
    winDusk: "Civil dusk",
    winSunset: "Sunset",
    locationSource: "Location & data source",
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
      rain_threshold: "Rain that wets the ground",
      wash_start: "Wash time",
      ok_rain: "Harmless daytime rain up to",
      night_max: "Harmless night rain up to",
      night_from: "Night starts",
      night_until: "Night ends",
      dry_roads_hours: "Roads must be dry for",
    },
    helpers: {
      rain_threshold: 'Anything above this counts as rain for "dry before / dry after".',
      ok_rain: "Light drizzle under this will not smudge a clean car, day or night.",
      night_max: "Heavier rain is tolerated overnight, when it does little cosmetic harm.",
      min_window_minutes: "Evenings with less daylight than this are shown but never recommended.",
      model: "MET Nordic is the same model behind Yr; it only covers the Nordics.",
      accent: "Leave blank for the mode default (green for work, blue for car wash).",
      dry_roads_hours:
        "No heavy rain this long before the wash, so you are not driving a clean car on wet roads.",
    },
    noteTasks1: "Activities default to ",
    noteTasks2: " (24 h dry before) and ",
    noteTasks3:
      " (24 h before, 24 h after). Add or change them in YAML with tasks: — e.g. - name: Stain deck, before: 48, after: 12.",
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
  needBefore: (b) => `trenger ${b} t tørt før`,
  needBeforeAfter: (b, a) => `trenger ${b} t før · ${a} t etter`,
  noDayMeets: "Ingen dag i varselet klarer det.",
  dryBeforehand: (x) => `${x} tørt på forhånd`,
  afterPart: (x) => ` · ${x} etter`,
  ofLight: (dur) => ` · ${dur} med lys`,
  longestPart: (full, dur) => ` · lengst: ${full} (${dur})`,
  noWindowWeek: "Ingen vindu denne uka",
  colDay: "Dag",
  colBefore: "Tørt før",
  colWindow: "Vindu",
  colAfter: "Tørt etter",
  colGood: "Egnet for",
  rowRain: "regn",
  rowPassed: "passert",
  rowDark: "mørkt",
  dusk: "skumring",
  sunset: "solnedgang",
  taskPiece: (name, before, after) =>
    `${name}: ${before} t tørt før${after !== undefined ? ` og ${after} t etter` : ""}`,
  footWork: (a) =>
    `Vinduer åpner ${a.weekday} på hverdager og ${a.weekend} i helgene og varer til ${a.end}. ${a.tasks}. Nedbør over ${a.thr} mm/t teller. Søyler stopper ved ${a.cap} t. Data: Open-Meteo (${a.model}).`,

  washTonight: "Vask i kveld",
  noGoodEvening: "Ingen god kveld i sikte",
  skipToday: "Dropp i dag",
  dash: "—",
  nothingClean: "ingenting holder seg rent",
  cleanDays: (n, open) =>
    n === 0 && !open
      ? "rent, men ikke forbi i morgen"
      : `${n}${open ? "+" : ""} rene ${n === 1 && !open ? "dag" : "dager"}`,
  whyOkBreak: (ws, desc) => `Tørt fra ${ws} i kveld. Holder seg rent til ${desc}.`,
  whyOkNoRain: (ws) => `Tørt fra ${ws} i kveld, og ingen ødeleggende nedbør i hele varselet.`,
  whyNone: (okRain) => `Hver kveld i varselet følges av nedbør over ${okRain} mm/t innen et døgn.`,
  whySkipHeadRain: "Regn i kveld gjør vask i dag nytteløst",
  whySkipHeadLasts: (n) =>
    n === 0
      ? `En vask i dag overlever ikke til i morgen`
      : `En vask i dag varer bare ${n} ${n === 1 ? "dag" : "dager"}`,
  whySpoils: (desc) => ` — ${desc} ødelegger det.`,
  describe: (full, night, peak) =>
    `${night ? "nattregn" : "regn på dagen"} ${full.toLowerCase()} (${peak} mm/t)`,
  sectAsk: "Når skal du vaske?",
  outTip: (streak, open) =>
    streak === 0 && !open
      ? "Ingen kommende tørrværsperiode"
      : `${streak}${open ? "+" : ""} ${streak === 1 && !open ? "dag" : "dager"} til neste ordentlige nedbør`,
  tagTonight: "I kveld",
  tagBest: "Best",
  tagNow: "Nå",
  dry: "tørt",
  mm: (peak) => `${peak} mm`,
  whenClear: "klart",
  whenEarlier: "tidligere",
  whenNight: "natt",
  whenDaytime: "dag",
  outDays: (streak, open) => `${streak}${open ? "+" : ""} d`,
  footWash: (a) =>
    `Vask fra ${a.washStart}. Nedbør opptil ${a.okRain} mm/t går fint; kraftigere dagregn avslutter den rene perioden. Natt (${a.from}–${a.until}) tåler opptil ${a.nightMax} mm/t. Data: Open-Meteo (${a.model}).`,

  defWorkTitle: "Utearbeid",
  defWorkSub: "Tørre vinduer etter jobb",
  defWashTitle: "Bilvask",
  defWashSub: "Hvilken kveld holder den lengst ren",
  taskMow: "Klippe",
  taskPaint: "Male",

  ed: {
    modeWork: "Utearbeid — tørre vinduer etter jobb",
    modeWash: "Bilvask — beste kveld for en vask som varer",
    modelMetno: "MET Nordic 1 km (Norge, Sverige, Danmark, Finland) — anbefalt",
    modelBest: "Open-Meteo beste treff (hvor som helst)",
    modelEcmwf: "ECMWF IFS 0,25°",
    winDusk: "Borgerlig skumring",
    winSunset: "Solnedgang",
    locationSource: "Sted og datakilde",
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
      rain_threshold: "Regn som gjør bakken våt",
      wash_start: "Vasketidspunkt",
      ok_rain: "Ufarlig dagregn opptil",
      night_max: "Ufarlig nattregn opptil",
      night_from: "Natt starter",
      night_until: "Natt slutter",
      dry_roads_hours: "Veiene må være tørre i",
    },
    helpers: {
      rain_threshold: 'Alt over dette teller som regn for "tørt før / tørt etter".',
      ok_rain: "Lett duskregn under dette tilsmusser ikke en ren bil, dag eller natt.",
      night_max: "Kraftigere regn tolereres om natta, når det gjør lite kosmetisk skade.",
      min_window_minutes: "Kvelder med mindre dagslys enn dette vises, men anbefales aldri.",
      model: "MET Nordic er samme modell som ligger bak Yr; den dekker bare Norden.",
      accent: "La stå tom for modusstandarden (grønn for arbeid, blå for bilvask).",
      dry_roads_hours:
        "Ikke kraftig regn så lenge før vasken, så du ikke kjører en ren bil på våte veier.",
    },
    noteTasks1: "Aktiviteter er som standard ",
    noteTasks2: " (24 t tørt før) og ",
    noteTasks3:
      " (24 t før, 24 t etter). Legg til eller endre dem i YAML med tasks: — f.eks. - name: Beise terrasse, before: 48, after: 12.",
    noteFetch:
      "Kortet henter Open-Meteo direkte fra nettleseren — ingen sensorer eller hjelpere trengs. Sted er som standard hjemmet ditt.",
  },
};

export function strings(lang: Lang): Strings {
  return lang === "nb" ? NB : EN;
}
