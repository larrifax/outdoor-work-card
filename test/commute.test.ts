import { test, expect } from "vitest";
import { planCommute, type CommuteOptions } from "../src/commute";
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

/** Hourly series from Sat 19 Sep 2026 (Oslo midnight) for 14 days. `set` maps "YYYY-MM-DDTHH" → [mm, wind]. */
function series(set: Record<string, [number, number?]> = {}): HourPoint[] {
  const start = Date.UTC(2026, 8, 18, 22, 0); // 2026-09-19 00:00 Oslo (UTC+2)
  const hours: HourPoint[] = [];
  for (let t = start; t < start + 14 * 24 * H; t += H)
    hours.push({ t, mm: 0, wind: 3, past: false });
  for (const [iso, [mm, wind]] of Object.entries(set)) {
    const t = Date.parse(iso + ":00+02:00");
    const h = hours.find((x) => x.t === t);
    expect(h, `hour ${iso} not in series`).toBeTruthy();
    h!.mm = mm;
    if (wind !== undefined) h!.wind = wind;
  }
  return hours;
}
const at = (iso: string) => Date.parse(iso + "+02:00");

test("Monday morning: Mon–Fri of this week, no divider, today first", () => {
  const r = planCommute(series(), at("2026-09-21T06:40"), OPTS);
  expect(r.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  expect(r.todayShown && r.days[0].full === "Today" && r.days[1].full === "Tomorrow").toBe(true);
  expect(r.days.every((d) => !d.newWeek)).toBe(true);
  expect(r.days.map((d) => d.grade)).toEqual(["A", "A", "A", "A", "A"]);
});

test("Wednesday 13:30: rolling window skips the weekend and marks the new week", () => {
  const r = planCommute(series(), at("2026-09-23T13:30"), OPTS);
  expect(r.days.map((d) => d.short)).toEqual(["Wed", "Thu", "Fri", "Mon", "Tue"]);
  expect(r.days.map((d) => d.newWeek)).toEqual([false, false, false, true, false]);
  expect(r.days.map((d) => d.far)).toEqual([false, false, false, true, true]);
  expect(r.days[0].toWork.passed && !r.days[0].home.passed).toBe(true);
  expect(r.days[0].toWork.cells.map((c) => c.label)).toEqual(["07", "08"]);
  expect(r.days[0].home.cells.map((c) => c.label)).toEqual(["16", "17"]);
});

test("after the home window today drops off; Friday evening shows next week", () => {
  const r = planCommute(series(), at("2026-09-25T18:05"), OPTS);
  expect(r.days.map((d) => d.short)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri"]);
  expect(r.todayShown).toBe(false);
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
  expect(tue.toWork.cells[0].gust).toBe(0);
  expect(tue.toWork.cells[0].level).toBe(1);
  expect(tue.toWork.cells[1].level).toBe(0);
  expect(tue.toWork.level).toBe(1);
  expect(tue.home.cells[0].gust).toBe(2);
  expect(tue.home.level).toBe(2);
  expect(tue.grade).toBe("D");
  expect(tue.reason).toBe("light rain to work · strong wind home");
});

test("grade ladder: A, B (midday rain only), C, D, E", () => {
  const now = at("2026-09-21T06:40");
  const g = (set: Record<string, [number, number?]>) =>
    planCommute(series(set), now, OPTS).days[1].grade;
  expect(g({})).toBe("A");
  expect(g({ "2026-09-22T12": [2.5] })).toBe("B");
  expect(g({ "2026-09-22T12": [0.5] })).toBe("A");
  expect(g({ "2026-09-22T07": [0.5] })).toBe("C");
  expect(g({ "2026-09-22T07": [3.0] })).toBe("D");
  expect(g({ "2026-09-22T07": [3.0], "2026-09-22T17": [0, 12] })).toBe("E");
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

test("midday summary is peak rain and mean wind", () => {
  const hours = series({ "2026-09-22T10": [0.3, 4], "2026-09-22T12": [1.2, 8] });
  const tue = planCommute(hours, at("2026-09-21T06:40"), OPTS).days[1];
  expect(tue.midday.mm).toBe(1.2);
  expect(tue.midday.wind).toBe(4);
  expect(tue.midday.level).toBe(2);
  expect(tue.grade).toBe("B");
});

test("missing forecast hours are flagged, not treated as dry", () => {
  const hours = series().filter((h) => h.t < at("2026-09-24T00:00"));
  const r = planCommute(hours, at("2026-09-21T06:40"), OPTS);
  expect(r.days[3].toWork.cells.every((c) => c.missing)).toBe(true);
  expect(r.days[2].toWork.cells.every((c) => !c.missing)).toBe(true);
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
      dryCalm: "tørt og vindstille begge veier",
      rainMidday: " · regn midt på dagen",
    },
  });
  expect(r.days[0].full).toBe("I dag");
  expect(r.days[1].full).toBe("I morgen");
  expect(r.days[1].short).toBe("Ti");
  expect(r.days[1].reason).toBe("lett regn til jobb");
});
