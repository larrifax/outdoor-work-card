import { test, expect } from "vitest";
import { planWork, planWash, buildDays } from "../src/logic";
import type { HourPoint } from "../src/types";

const TZ = "Europe/Oslo";
const H = 3_600_000;
// Wednesday 16 Sep 2026, 16:00 Oslo (14:00Z)
const NOW = Date.UTC(2026, 8, 16, 14, 0);
const OSLO = { lat: 59.91, lon: 10.75 };

/** Build an hourly series from `past` hours back to `ahead` hours forward, with rain given as [isoLocalOslo, mm] pairs. */
function series(rain: [string, number][], { pastDays = 3, days = 9 } = {}): HourPoint[] {
  const start = Date.UTC(2026, 8, 16 - pastDays, 0, 0) - 2 * H; // local midnight Oslo = 22:00Z prev day
  const hours: HourPoint[] = [];
  for (let t = start; t < start + (pastDays + days) * 24 * H; t += H) {
    hours.push({ t, mm: 0, past: t + H <= NOW });
  }
  for (const [iso, mm] of rain) {
    const t = Date.parse(iso + "+02:00");
    const idx = hours.findIndex((h) => h.t === t);
    expect(idx, `rain hour ${iso} not in series`).toBeGreaterThanOrEqual(0);
    hours[idx].mm = mm;
  }
  return hours;
}

const WORK = {
  tz: TZ,
  ...OSLO,
  weekdayStart: 18 * 60,
  weekendStart: 10 * 60,
  windowEnd: "dusk" as const,
  minWindowMinutes: 45,
  rainThreshold: 0.2,
  days: 7,
  cap: 48,
  tasks: [
    { name: "Mow", before: 24 },
    { name: "Paint", before: 24, after: 24 },
  ],
};

test("buildDays: seven consecutive Oslo days starting today", () => {
  const d = buildDays(NOW, TZ, 7);
  expect(d.length).toBe(7);
  expect(d[0].key).toBe("2026-09-16");
  expect(d[0].short).toBe("Wed");
  expect(d[3].short).toBe("Sat");
  expect(d[3].isWeekend && d[4].isWeekend && !d[5].isWeekend).toBe(true);
  expect(d[6].key).toBe("2026-09-22");
});

test("work: tonight window is 18:00 → civil dusk (~20:10 in mid-Sept Oslo)", () => {
  const r = planWork(series([]), NOW, WORK);
  const t = r.days[0];
  expect(t.start && t.end).toBeTruthy();
  const endOslo = new Date(t.end!).toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  expect(endOslo).toMatch(/^20:(0|1)\d$/);
  expect(t.hours > 1.9 && t.hours < 2.5).toBe(true);
  // Weekend window opens at 10:00
  const sat = r.days[3];
  const satStart = new Date(sat.start!).toLocaleTimeString("en-GB", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
  expect(satStart).toBe("10:00");
  expect(sat.hours).toBeGreaterThan(9.5);
});

test("work: rain history sets dry-before; forecast rain sets dry-after and blocks paint", () => {
  // Rained Tue 15 Sep 10:00–11:00 (ended 11:00 → 31 h before Wed 18:00). Rain Fri 18 Sep 05:00–09:00.
  const hours = series([
    ["2026-09-15T10:00", 1.2],
    ["2026-09-18T05:00", 0.8],
    ["2026-09-18T06:00", 1.5],
    ["2026-09-18T07:00", 1.1],
    ["2026-09-18T08:00", 0.6],
  ]);
  const r = planWork(hours, NOW, WORK);
  const [wed, thu, fri, sat] = r.days;
  expect(Math.round(wed.before)).toBe(31);
  expect(wed.ok[0]).toBeTruthy();
  expect(wed.ok[1]).toBeTruthy();
  expect(thu.ok[0]).toBeTruthy();
  expect(thu.ok[1]).toBeFalsy();
  expect(Math.round(thu.after)).toBe(9);
  expect(fri.ok[0]).toBeFalsy();
  expect(Math.round(fri.before)).toBe(9);
  expect(sat.ok[0] && sat.ok[1]).toBeTruthy();
  expect(r.tasks[0].nextIdx).toBe(0);
  expect(r.tasks[1].nextIdx).toBe(0);
  expect(r.tasks[1].longestIdx).toBe(3);
  expect(r.tonightOk).toEqual([0, 1]);
});

test("work: rain inside the window kills it and is flagged", () => {
  const hours = series([["2026-09-16T19:00", 0.9]]);
  const r = planWork(hours, NOW, WORK);
  expect(r.days[0].during).toBeTruthy();
  expect(r.days[0].ok).toEqual([false, false]);
  expect(r.tonightOk).toEqual([]);
});

test("work: no history rain → before is capped, not zero", () => {
  const r = planWork(series([]), NOW, WORK);
  expect(r.days[0].before).toBe(48);
  expect(r.days[0].after).toBe(48);
});

test('work: today after dusk is "passed", not a window', () => {
  const late = Date.UTC(2026, 8, 16, 20, 0); // 22:00 Oslo
  const r = planWork(series([]), late, WORK);
  expect(r.days[0].passed).toBeTruthy();
  expect(r.days[0].hours).toBe(0);
  expect(r.tasks[0].nextIdx).toBe(1);
});

const WASH = {
  tz: TZ,
  washStart: 18 * 60,
  okRain: 0.5,
  nightMax: 4,
  nightFrom: 22 * 60,
  nightUntil: 6 * 60,
  days: 7,
  leadHours: 2,
};

test("wash: light night rain and light daytime drizzle stay in the streak; heavy daytime rain ends it", () => {
  const hours = series([
    ["2026-09-18T23:00", 0.3], // Fri night — fine
    ["2026-09-19T14:00", 0.4], // Sat daytime drizzle under 0.5 — fine
    ["2026-09-21T15:00", 2.6], // Mon afternoon — ends a Wed wash…
    ["2026-09-22T12:00", 1.4], // …and Tue rain ends a Mon-evening wash after 1 day
  ]);
  const r = planWash(hours, NOW, WASH);
  const s = r.days.map((d) => d.streak);
  expect(s.slice(0, 6)).toEqual([5, 4, 3, 2, 1, 1]);
  expect(r.days[6].openEnded).toBeTruthy();
  expect(r.bestIdx).toBe(0);
  expect(r.days[2].icon).toBe("moon");
  expect(r.days[3].icon).toBe("drop");
  expect(r.days[5].icon).toBe("rain");
  expect(r.todayBreakIdx).toBe(5);
});

test("wash: lowering the daytime threshold flips the Saturday drizzle into a streak-breaker", () => {
  const hours = series([
    ["2026-09-19T14:00", 0.4],
    ["2026-09-21T15:00", 2.6],
  ]);
  const r = planWash(hours, NOW, { ...WASH, okRain: 0.3 });
  expect(r.days.map((d) => d.streak).slice(0, 4)).toEqual([3, 2, 1, 2]);
});

test("wash: heavy rain late tomorrow afternoon → skip today, recommend Friday", () => {
  // Thu 16:00–17:00 heavy rain: within the 2 h lead before an 18:00 wash, so Thursday evening is out.
  const hours = series([
    ["2026-09-17T16:00", 3.2],
    ["2026-09-21T23:00", 0.4],
  ]);
  const r = planWash(hours, NOW, WASH);
  expect(r.days[0].streak).toBe(1);
  expect(r.days[1].streak).toBe(0);
  expect(r.bestIdx).toBe(2);
  expect(r.days[2].streak).toBeGreaterThanOrEqual(5);
  expect(r.todayBreakIdx).toBe(1);
});

test("wash: rain earlier in the afternoon does not forbid an evening wash", () => {
  const hours = series([["2026-09-17T13:00", 3.2]]);
  const r = planWash(hours, NOW, WASH);
  expect(r.days[0].streak).toBe(1);
  expect(r.days[1].streak).toBeGreaterThanOrEqual(5);
  expect(r.bestIdx).toBe(1);
});

test("wash: rain this evening means you cannot wash today at all", () => {
  const hours = series([["2026-09-16T19:00", 1.0]]);
  const r = planWash(hours, NOW, WASH);
  expect(r.days[0].streak).toBe(0);
  expect(r.bestIdx).toBeGreaterThan(0);
});
