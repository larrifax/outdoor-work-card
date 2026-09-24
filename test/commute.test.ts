import { test, expect } from "vitest";
import { planCommute, matchPreset, PRESETS, type CommuteOptions } from "../src/commute";
import { resolve } from "../src/config";
import type { HourPoint } from "../src/types";

const TZ = "Europe/Oslo";
const H = 3_600_000;
const OPTS: CommuteOptions = {
  tz: TZ,
  toWork: [7 * 60, 9 * 60],
  home: [16 * 60, 18 * 60],
  midday: [9 * 60, 15 * 60],
  rainFine: 0.2,
  rainOk: 1.0,
  windFine: 6,
  windOk: 10,
  workdays: [1, 2, 3, 4, 5],
  days: 5,
};

/** Hourly series from Sat 19 Sep 2026 (Oslo midnight) for 14 days. `set` maps "YYYY-MM-DDTHH" → [mm, wind, gust]. */
function series(set: Record<string, [number, number?, number?]> = {}): HourPoint[] {
  const start = Date.UTC(2026, 8, 18, 22, 0); // 2026-09-19 00:00 Oslo (UTC+2)
  const hours: HourPoint[] = [];
  for (let t = start; t < start + 14 * 24 * H; t += H)
    hours.push({ t, mm: 0, wind: 3, gust: 5, past: false });
  for (const [iso, [mm, wind, gust]] of Object.entries(set)) {
    const t = Date.parse(iso + ":00+02:00");
    const h = hours.find((x) => x.t === t);
    expect(h, `hour ${iso} not in series`).toBeTruthy();
    h!.mm = mm;
    if (wind !== undefined) {
      h!.wind = wind;
      h!.gust = wind / 0.6; // ordinary gust factor: effective wind == mean
    }
    if (gust !== undefined) h!.gust = gust;
  }
  return hours;
}
const at = (iso: string) => Date.parse(iso + "+02:00");

test("Monday morning: Mon–Fri of this week, no divider, today first", () => {
  const r = planCommute(series(), at("2026-09-21T06:40"), OPTS);
  expect(r.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  expect(r.days[0].isToday && r.days[0].full === "Today" && r.days[1].full === "Tomorrow").toBe(
    true,
  );
  expect(r.days.every((d) => !d.newWeek)).toBe(true);
  expect(r.days.map((d) => d.grade)).toEqual(["A", "A", "A", "A", "A"]);
});

test("Wednesday 13:30: rolling window skips the weekend and marks the new week", () => {
  const r = planCommute(series(), at("2026-09-23T13:30"), OPTS);
  expect(r.days.map((d) => d.short)).toEqual(["Wed", "Thu", "Fri", "Mon", "Tue"]);
  expect(r.days.map((d) => d.newWeek)).toEqual([false, false, false, true, false]);
  expect(r.days.map((d) => d.far)).toEqual([false, false, false, true, true]);
  expect(r.days[0].toWork.cells.every((c) => c.passed)).toBe(true);
  expect(r.days[0].home.cells.some((c) => c.passed)).toBe(false);
  expect(r.days[0].toWork.cells.map((c) => c.label)).toEqual(["07", "08"]);
  expect(r.days[0].home.cells.map((c) => c.label)).toEqual(["16", "17"]);
});

test("after the home window today drops off; Friday evening shows next week", () => {
  const r = planCommute(series(), at("2026-09-25T18:05"), OPTS);
  expect(r.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  expect(r.days[0].isToday).toBe(false);
  expect(r.days[0].full).toBe("Monday");
  expect(r.days[0].newWeek).toBe(false);
  const sat = planCommute(series(), at("2026-09-26T10:00"), OPTS);
  expect(sat.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
});

test("each property is graded on its own scale; tile takes the worse", () => {
  const hours = series({
    "2026-09-22T07": [0.6, 5],
    "2026-09-22T08": [0.2, 5],
    "2026-09-22T16": [0, 11],
  });
  const r = planCommute(hours, at("2026-09-21T06:40"), OPTS);
  const tue = r.days[1];
  expect(tue.toWork.cells[0].rain).toBe(1);
  expect(tue.toWork.cells[0].windLevel).toBe(0);
  expect(tue.toWork.cells[0].level).toBe(1);
  expect(tue.toWork.cells[1].level).toBe(0);
  expect(tue.toWork.level).toBe(1);
  expect(tue.home.cells[0].windLevel).toBe(2);
  expect(tue.home.level).toBe(2);
  expect(tue.grade).toBe("D");
  expect(tue.reason).toBe("light rain to work · strong wind home");
});

test("grade table: A–F from the two commutes only", () => {
  const now = at("2026-09-21T06:40");
  const g = (set: Record<string, [number, number?, number?]>) =>
    planCommute(series(set), now, OPTS).days[1].grade;
  expect(g({})).toBe("A");
  expect(g({ "2026-09-22T07": [0.5] })).toBe("B");
  expect(g({ "2026-09-22T17": [0, 8] })).toBe("B");
  expect(g({ "2026-09-22T07": [0.5], "2026-09-22T16": [0.5] })).toBe("C");
  expect(g({ "2026-09-22T07": [3.0] })).toBe("D");
  expect(g({ "2026-09-22T07": [3.0], "2026-09-22T16": [0.5] })).toBe("D");
  expect(g({ "2026-09-22T07": [3.0], "2026-09-22T17": [0, 12] })).toBe("E");
  expect(g({ "2026-09-22T17": [9] })).toBe("F");
  expect(g({ "2026-09-22T12": [20] })).toBe("A"); // midday never changes the grade
});

test("F wins over a D/E day and ignores lenient rider thresholds", () => {
  const now = at("2026-09-21T06:40");
  const lenient = { ...OPTS, rainFine: 20, rainOk: 20, windFine: 40, windOk: 40 };
  const tue = (set: Record<string, [number, number?, number?]>, o = OPTS) =>
    planCommute(series(set), now, o).days[1];
  expect(
    tue({ "2026-09-22T07": [3.0], "2026-09-22T16": [3.0], "2026-09-22T17": [0, 15] }).grade,
  ).toBe("F");
  const storm = tue({ "2026-09-22T17": [0, 9, 25] }, lenient);
  expect(storm.grade).toBe("F");
  expect(storm.light).toBe(2);
  expect(storm.home.cells[1].level).toBe(3);
  expect(storm.reason).toBe("dangerous gusts home");
  expect(tue({ "2026-09-22T07": [8.5] }, lenient).reason).toBe("cloudburst to work");
  expect(tue({ "2026-09-22T07": [8.0] }, lenient).grade).toBe("A"); // 8 is not above 8
});

test("effective wind is the mean in ordinary gusts, rises with unusually strong gusts", () => {
  const hours = series({
    "2026-09-22T07": [0, 6, 10],
    "2026-09-22T08": [0, 6, 20],
    "2026-09-22T16": [0, 5],
  });
  const tue = planCommute(hours, at("2026-09-21T06:40"), OPTS).days[1];
  const [c7, c8] = tue.toWork.cells;
  expect(c7.eff).toBe(6);
  expect(c7.windLevel).toBe(0);
  expect(c8.wind).toBe(6);
  expect(c8.gust).toBe(20);
  expect(c8.eff).toBe(12);
  expect(c8.windLevel).toBe(2);
  expect(tue.home.cells[0].eff).toBeCloseTo(5);
});

test("missing gust falls back to the mean", () => {
  const hours = series({ "2026-09-22T07": [0, 8] });
  const h = hours.find((x) => x.t === Date.parse("2026-09-22T07:00+02:00"))!;
  delete h.gust;
  const c = planCommute(hours, at("2026-09-21T06:40"), OPTS).days[1].toWork.cells[0];
  expect(c.gust).toBe(8);
  expect(c.eff).toBe(8);
  expect(c.windLevel).toBe(1);
});

test("midday summary: peak and total rain, flag on heavy peak or heavy total, only on A–C", () => {
  const now = at("2026-09-21T06:40");
  const tue = (set: Record<string, [number, number?, number?]>) =>
    planCommute(series(set), now, OPTS).days[1];
  const peak = tue({ "2026-09-22T10": [0.3], "2026-09-22T12": [1.2] });
  expect(peak.midday.mm).toBe(1.2);
  expect(peak.midday.total).toBeCloseTo(1.5);
  expect(peak.midday.rain).toBe(2);
  expect(peak.midday.flag).toBe(true);
  expect(peak.grade).toBe("A");
  expect(peak.reason).toBe("dry and calm both ways · heavy rain midday — consider home office");

  const drizzle = tue({
    "2026-09-22T09": [0.6],
    "2026-09-22T10": [0.6],
    "2026-09-22T11": [0.6],
    "2026-09-22T12": [0.6],
    "2026-09-22T13": [0.6],
    "2026-09-22T14": [0.6],
  });
  expect(drizzle.midday.mm).toBe(0.6);
  expect(drizzle.midday.flag).toBe(true);

  expect(tue({ "2026-09-22T12": [1.0], "2026-09-22T13": [1.0] }).midday.flag).toBe(false);

  const tolerable = tue({ "2026-09-22T07": [0.5], "2026-09-22T12": [2] });
  expect(tolerable.grade).toBe("B");
  expect(tolerable.midday.flag).toBe(true);
  expect(tolerable.reason).toBe("light rain to work · heavy rain midday — consider home office");

  const bad = tue({ "2026-09-22T07": [3], "2026-09-22T12": [2] });
  expect(bad.grade).toBe("D");
  expect(bad.midday.flag).toBe(false);
});

test("today's grade does not change during the day", () => {
  const hours = series({ "2026-09-23T07": [2.1, 9], "2026-09-23T08": [1.4, 9] });
  const morning = planCommute(hours, at("2026-09-23T06:00"), OPTS).days[0];
  const afternoon = planCommute(hours, at("2026-09-23T13:30"), OPTS).days[0];
  expect(morning.grade).toBe("D");
  expect(afternoon.grade).toBe("D");
  expect(afternoon.reason).toBe(morning.reason);
  expect(afternoon.toWork.cells.every((c) => c.passed)).toBe(true);
});

test("missing forecast hours are flagged, not treated as dry", () => {
  const hours = series().filter((h) => h.t < at("2026-09-24T00:00"));
  const r = planCommute(hours, at("2026-09-21T06:40"), OPTS);
  expect(r.days[3].toWork.cells.every((c) => c.missing)).toBe(true);
  expect(r.days[2].toWork.cells.every((c) => !c.missing)).toBe(true);
});

test("a day with missing commute hours is unknown, not graded A", () => {
  const hours = series().filter((h) => h.t < at("2026-09-24T00:00"));
  const r = planCommute(hours, at("2026-09-21T06:40"), OPTS);
  expect(r.days.map((d) => d.unknown)).toEqual([false, false, false, true, true]);
  expect(r.days[3].reason).toBe("no forecast yet");
});

test("off-the-hour window covers every hour it touches", () => {
  const hours = series({ "2026-09-23T08": [9] });
  const r = planCommute(hours, at("2026-09-23T06:00"), {
    ...OPTS,
    toWork: [7 * 60 + 45, 8 * 60 + 15],
  });
  expect(r.days[0].toWork.cells.map((c) => c.label)).toEqual(["07", "08"]);
  expect(r.days[0].grade).toBe("F");
});

test("seven-day week: divider before Monday", () => {
  const r = planCommute(series(), at("2026-09-25T06:00"), {
    ...OPTS,
    workdays: [1, 2, 3, 4, 5, 6, 7],
  });
  expect(r.days.map((d) => d.short)).toEqual(["Fri", "Sat", "Sun", "Mon", "Tue"]);
  expect(r.days.map((d) => d.newWeek)).toEqual([false, false, false, true, false]);
});

test("custom workdays: a four-day week", () => {
  const r = planCommute(series(), at("2026-09-21T06:40"), {
    ...OPTS,
    workdays: [1, 2, 3, 4],
    days: 5,
  });
  expect(r.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Mon"]);
  expect(r.days[4].newWeek).toBe(true);
});

test("localized names and phrases flow through", () => {
  const hours = series({ "2026-09-22T07": [0.6, 5] });
  const r = planCommute(hours, at("2026-09-21T06:40"), {
    ...OPTS,
    names: {
      short: ["Sø", "Ma", "Ti", "On", "To", "Fr", "Lø"],
      full: ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"],
    },
    today: "I dag",
    tomorrow: "I morgen",
    phrases: {
      rain: "regn",
      lightRain: "lett regn",
      strongWind: "sterk vind",
      breezy: "vindfullt",
      toWork: (w) => `${w} til jobb`,
      home: (w) => `${w} hjem`,
      and: " + ",
      sep: " · ",
      cloudburst: "styrtregn",
      dangerousGusts: "farlige vindkast",
      dryCalm: "tørt og vindstille begge veier",
      middayFlag: " · kraftig regn midt på dagen — vurder hjemmekontor",
    },
  });
  expect(r.days[0].full).toBe("I dag");
  expect(r.days[1].full).toBe("I morgen");
  expect(r.days[1].short).toBe("Ti");
  expect(r.days[1].reason).toBe("lett regn til jobb");
});

test("preset matcher: each preset maps to its id, any change to custom", () => {
  for (const [id, p] of Object.entries(PRESETS)) expect(matchPreset(p)).toBe(id);
  expect(matchPreset({ ...PRESETS.everyday, windOk: 11 })).toBe("custom");
});

test("resolver defaults equal the Everyday preset", () => {
  const r = resolve({ type: "custom:outdoor-work-card", mode: "commute" }, undefined);
  expect(matchPreset(r)).toBe("everyday");
});
