import { test, expect } from "vitest";
import { planWork, planWash, buildDays, dryByCell } from "../src/logic";
import type { HourPoint } from "../src/types";

const TZ = "Europe/Oslo";
const H = 3_600_000;
// Wednesday 16 Sep 2026, 16:00 Oslo (14:00Z)
const NOW = Date.UTC(2026, 8, 16, 14, 0);
const OSLO = { lat: 59.91, lon: 10.75 };

/** Default sunny-ish ET0: 0.2 mm/h from 10:00 to 16:00 Oslo, 0.05 otherwise. */
const diurnal = (t: number) => {
  const h = (new Date(t).getUTCHours() + 2) % 24;
  return h >= 10 && h < 16 ? 0.2 : 0.05;
};

/**
 * Build an hourly series from `pastDays` back to `days` forward, with rain given as
 * [isoLocalOslo, mm] pairs. `et0` overrides the default diurnal evaporation curve.
 */
function series(
  rain: [string, number][],
  {
    pastDays = 3,
    days = 9,
    et0 = diurnal,
  }: { pastDays?: number; days?: number; et0?: (t: number) => number } = {},
): HourPoint[] {
  const start = Date.UTC(2026, 8, 16 - pastDays, 0, 0) - 2 * H; // local midnight Oslo = 22:00Z prev day
  const hours: HourPoint[] = [];
  for (let t = start; t < start + (pastDays + days) * 24 * H; t += H) {
    hours.push({ t, mm: 0, wind: 0, et0: et0(t), past: t + H <= NOW });
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
    { name: "Mow", max_wet: 0.3 },
    { name: "Paint", max_wet: 0.1, after: 24 },
  ],
};
const at = (iso: string) => Date.parse(iso + "+02:00");

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

test("work: a 0.3 mm shower at 13:00 on a sunny day dries off for mowing by 18:00", () => {
  const r = planWork(series([["2026-09-16T13:00", 0.3]]), NOW, WORK);
  const wed = r.days[0];
  // 0.3 in the 13:00 hour, then 0.2 + 0.2 evaporate by 16:00 → 0 by 18:00.
  expect(wed.wetAtStart).toBe(0);
  expect(wed.ok).toEqual([true, true]);
  expect(wed.dryAt).toEqual([wed.start, wed.start]);
});

test("work: right after the shower the ground is still too wet for Paint, dry an hour later", () => {
  // Thursday window opening at 14:00; no evaporation while it rains.
  const rainingHour = at("2026-09-17T13:00");
  const et0 = (t: number) => (t === rainingHour ? 0 : diurnal(t));
  const r = planWork(series([["2026-09-17T13:00", 0.3]], { et0 }), NOW, {
    ...WORK,
    weekdayStart: 14 * 60,
  });
  const thu = r.days[1];
  expect(thu.wetAtStart).toBeCloseTo(0.3);
  expect(thu.ok).toEqual([true, false]);
  expect(thu.dryAt).toEqual([at("2026-09-17T14:00"), at("2026-09-17T15:00")]);
});

test("work: 10 mm the day before is still too wet at 18:00 and dries on a later day", () => {
  const r = planWork(series([["2026-09-15T08:00", 10]]), NOW, WORK);
  const wed = r.days[0];
  expect(wed.wetAtStart).toBeGreaterThan(0.3);
  expect(wed.ok).toEqual([false, false]);
  expect(wed.dryAt[0]).not.toBeNull();
  expect(wed.dryAt[0]!).toBeGreaterThanOrEqual(at("2026-09-17T00:00"));
});

test("work: 10 mm on a grey morning is still soaked at 18:00 and never dries in the forecast", () => {
  const grey = () => 0.02; // ~0.5 mm/day: nowhere near drying 10 mm within the 9-day series
  const r = planWork(series([["2026-09-16T08:00", 10]], { et0: grey }), NOW, WORK);
  const wed = r.days[0];
  expect(wed.wetAtStart).toBeCloseTo(9.8); // 10 − 10 h × 0.02
  expect(wed.ok).toEqual([false, false]);
  expect(wed.dryAt).toEqual([null, null]);
});

test("work: drizzle under the rain threshold still wets the ground — enough to block Paint, not Mow", () => {
  // 0.15 mm/h 12:00–18:00 Thu: evaporation (0.2) wins until 16:00, then +0.1 twice → 0.2 mm.
  const drizzle: [string, number][] = [12, 13, 14, 15, 16, 17].map((h) => [
    `2026-09-17T${h}:00`,
    0.15,
  ]);
  const r = planWork(series(drizzle), NOW, WORK);
  const thu = r.days[1];
  expect(thu.during).toBe(false);
  expect(thu.wetAtStart).toBeCloseTo(0.2);
  expect(thu.ok).toEqual([true, false]);
  expect(thu.dryAt[0]).toBe(thu.start);
  expect(thu.dryAt[1]).toBeGreaterThan(thu.start!);
});

test("work: Paint needs 24 h without rain after the window even on dry ground", () => {
  const r = planWork(series([["2026-09-18T10:00", 1.0]]), NOW, WORK);
  const thu = r.days[1];
  expect(thu.wetAtStart).toBe(0);
  expect(thu.ok).toEqual([true, false]);
});

test("work Dry-by cell: ✓ when every task is dry, else the strictest waiting task with its time", () => {
  const dry = planWork(series([]), NOW, WORK).days[0];
  expect(dryByCell(dry, WORK.tasks)).toEqual({ all: true });

  // Thu drizzle: Mow dry, Paint waiting → Paint, dry after the window has started.
  const drizzle: [string, number][] = [12, 13, 14, 15, 16, 17].map((h) => [
    `2026-09-17T${h}:00`,
    0.15,
  ]);
  const thu = planWork(series(drizzle), NOW, WORK).days[1];
  const cell = dryByCell(thu, WORK.tasks);
  expect(cell).toMatchObject({ all: false, task: 1, at: thu.dryAt[1] });

  // Soaked with nothing drying in the forecast → no time, not amber.
  const soaked = planWork(series([["2026-09-16T08:00", 10]], { et0: () => 0.02 }), NOW, WORK)
    .days[0];
  expect(dryByCell(soaked, WORK.tasks)).toEqual({ all: false, task: 1, at: null, soon: false });

  // Ties go to config order.
  const tie = [
    { name: "A", max_wet: 0.1 },
    { name: "B", max_wet: 0.1 },
  ];
  const d = planWork(series([["2026-09-16T17:00", 1.0]]), NOW, { ...WORK, tasks: tie }).days[0];
  expect(dryByCell(d, tie)).toMatchObject({ all: false, task: 0 });
});

test("work Dry-by cell is amber when the ground dries before the window closes", () => {
  // 0.4 mm at 17:00 on a sunny day with strong evening drying → Paint dry at ~19:00, before dusk.
  const strong = (t: number) => ((new Date(t).getUTCHours() + 2) % 24 >= 17 ? 0.2 : 0.05);
  const d = planWork(series([["2026-09-16T17:00", 0.4]], { et0: strong }), NOW, WORK).days[0];
  const cell = dryByCell(d, WORK.tasks);
  expect(cell).toEqual({ all: false, task: 1, at: at("2026-09-16T19:00"), soon: true });
});

test("work: wetness is capped at 15 mm and never goes negative", () => {
  const r = planWork(series([["2026-09-16T17:00", 40]]), NOW, WORK);
  expect(r.days[0].wetAtStart).toBe(15);
  expect(r.days[0].dryAt[0]).toBeGreaterThan(at("2026-09-22T00:00"));

  // Days of evaporation with no rain leave the counter at 0, not below.
  const dry = planWork(series([]), NOW, WORK);
  expect(dry.days.map((d) => d.wetAtStart)).toEqual(dry.days.map(() => 0));
});

test("work: rain inside the window kills it and is flagged", () => {
  const hours = series([["2026-09-16T19:00", 0.9]]);
  const r = planWork(hours, NOW, WORK);
  expect(r.days[0].during).toBeTruthy();
  expect(r.days[0].ok).toEqual([false, false]);
  expect(r.tonightOk).toEqual([]);
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
  okRain: 0.2,
  dryRoadsHours: 3,
  nightFrom: 22 * 60,
  nightUntil: 6 * 60,
  parked: null,
  workdays: [1, 2, 3, 4, 5],
  days: 7,
};

test("wash: 0.2 mm in an hour leaves roads dry; 0.3 mm wets them", () => {
  const dry = planWash(series([["2026-09-17T12:00", 0.2]]), NOW, WASH);
  expect(dry.days[1].icon).toBe("moon");
  expect(dry.days[1].clean).toBe(true);
  expect(dry.days[0].openEnded).toBe(true);

  const wet = planWash(series([["2026-09-17T12:00", 0.3]]), NOW, WASH);
  expect(wet.days[1].icon).toBe("rain");
  expect(wet.days[1].clean).toBe(false);
  expect(wet.days[0].streak).toBe(0);
  expect(wet.days[0].openEnded).toBe(false);
});

test("wash: six hours of 0.3 mm drizzle keep roads wet through the stretch and until 3 h of drying", () => {
  const drizzle: [string, number][] = [10, 11, 12, 13, 14, 15].map((h) => [
    `2026-09-17T${h}:00`,
    0.3,
  ]);
  const r = planWash(series(drizzle), NOW, WASH);
  const thu = r.days[1];
  expect(thu.clean).toBe(false);
  expect(thu.wetFrom).toBe(at("2026-09-17T10:00"));
  expect(thu.dryAt).toBe(at("2026-09-17T18:00"));
  // Evening from 18:00 is dry again, so Thursday is still washable.
  expect(thu.eveningClean).toBe(true);
});

test("wash: roads dry at half speed overnight — 02:00 rain is still wet at 06:00, 01:00 rain is not", () => {
  const late = planWash(series([["2026-09-17T02:00", 1.0]]), NOW, WASH);
  expect(late.days[1].icon).toBe("rain");
  expect(late.days[1].wetFrom).toBe(at("2026-09-17T06:00"));
  expect(late.days[0].streak).toBe(0);

  const early = planWash(series([["2026-09-17T01:00", 1.0]]), NOW, WASH);
  expect(early.days[1].icon).toBe("moon");
  expect(early.days[1].clean).toBe(true);
  expect(early.days[1].dryAt).toBe(at("2026-09-17T06:00"));
});

test("wash: a parked window on workdays hides midday wet roads; Saturday and no-window stay dirty", () => {
  const parked = { ...WASH, parked: [8 * 60, 15 * 60] as [number, number] };
  const thu = planWash(series([["2026-09-17T11:00", 1.0]]), NOW, parked);
  expect(thu.days[1].clean).toBe(true);
  expect(thu.days[1].icon).toBe("moon");

  const sat = planWash(series([["2026-09-19T11:00", 1.0]]), NOW, parked);
  expect(sat.days[3].clean).toBe(false);

  const plain = planWash(series([["2026-09-17T11:00", 1.0]]), NOW, WASH);
  expect(plain.days[1].clean).toBe(false);
});

test("wash: rain at 16:00 leaves roads wet at an 18:00 wash; rain at 13:00 has dried off", () => {
  const late = planWash(series([["2026-09-17T16:00", 3.2]]), NOW, WASH);
  expect(late.days[1].streak).toBe(-1);
  expect(late.days[1].eveningClean).toBe(false);

  const early = planWash(series([["2026-09-17T13:00", 3.2]]), NOW, WASH);
  expect(early.days[1].streak).toBeGreaterThanOrEqual(4);
  expect(early.days[0].streak).toBe(0);
  expect(early.bestIdx).toBe(1);
});

test("wash: streaks, best evening and break days over a week", () => {
  const hours = series([
    ["2026-09-18T23:00", 0.3], // Fri night — dries before morning
    ["2026-09-19T14:00", 0.2], // Sat — too little to wet roads
    ["2026-09-21T15:00", 2.6], // Mon afternoon — ends a Wed wash…
    ["2026-09-22T12:00", 1.4], // …and Tue ends a Mon-evening wash
  ]);
  const r = planWash(hours, NOW, WASH);
  expect(r.days.map((d) => d.streak).slice(0, 6)).toEqual([4, 3, 2, 1, 0, 0]);
  expect(r.days[6].openEnded).toBe(true);
  expect(r.bestIdx).toBe(0);
  expect(r.days[2].icon).toBe("moon");
  expect(r.days[3].icon).toBe("moon");
  expect(r.days[4].icon).toBe("sun");
  expect(r.days[5].icon).toBe("rain");
  expect(r.todayBreakIdx).toBe(5);
  expect(r.bestBreakIdx).toBe(5);
});

test("wash: tonight wet → recommend the first clean evening, with its break day", () => {
  const tail: [string, number][] = [];
  for (let d = 19; d <= 28; d++) tail.push([`2026-09-${d}T14:00`, 2.6]);
  const r = planWash(series([["2026-09-16T19:00", 1.0], ...tail], { days: 15 }), NOW, WASH);
  expect(r.days[0].streak).toBe(-1);
  expect(r.bestIdx).toBe(1);
  expect(r.days[1].streak).toBe(1);
  expect(r.bestBreakIdx).toBe(3);
  expect(r.days[r.bestBreakIdx].short).toBe("Sat");
});

test("wash: next dirty stretch reports start, end, length and the rain that wet the roads", () => {
  const r = planWash(series([["2026-09-21T15:00", 2.6]]), NOW, WASH);
  expect(r.days[0].nextRain).toEqual({
    at: at("2026-09-21T15:00"),
    end: at("2026-09-21T18:00"),
    hours: 3,
    peak: 2.6,
    total: 2.6,
  });

  // Night rain still drying when driving starts: the stretch reports the rain behind it.
  const n = planWash(
    series([
      ["2026-09-18T02:00", 1.5],
      ["2026-09-18T03:00", 1.0],
    ]),
    NOW,
    WASH,
  );
  expect(n.days[0].nextRain).toEqual({
    at: at("2026-09-18T06:00"),
    end: at("2026-09-18T07:00"),
    hours: 1,
    peak: 1.5,
    total: 2.5,
  });
});

// ---------------------------------------------------------------------------
// Road salt
// ---------------------------------------------------------------------------

/** `series` plus frost hours (0 °C) and snowfall (cm); other hours have no temperature. */
function salty(rain: [string, number][], frost: string[], snow: [string, number][] = []) {
  const hours = series(rain);
  const find = (iso: string) => hours.find((h) => h.t === at(iso + ":00"))!;
  for (const iso of frost) find(iso).temp = 0;
  for (const [iso, cm] of snow) find(iso).snow = cm;
  return hours;
}

test("wash: after frost on wet roads, 0.15 mm the next day wets them; without frost it doesn't", () => {
  const rain: [string, number][] = [
    ["2026-09-17T05:00", 0.3],
    ["2026-09-18T12:00", 0.15],
  ];
  const fri = planWash(salty(rain, ["2026-09-17T05"]), NOW, WASH).days[2];
  expect(fri.clean).toBe(false);
  expect(fri.wetFrom).toBe(at("2026-09-18T12:00"));
  expect(fri.salted).toBe(true);
  const plain = planWash(series(rain), NOW, WASH).days[2];
  expect(plain.clean).toBe(true);
  expect(plain.salted).toBe(false);
});

test("wash: salt washes off after 10 mm of rain since the trigger", () => {
  const rain = (last: number): [string, number][] => [
    ["2026-09-17T05:00", 0.3],
    ["2026-09-17T23:00", 6],
    ["2026-09-18T00:00", last],
    ["2026-09-20T12:00", 0.15],
  ];
  expect(planWash(salty(rain(4), ["2026-09-17T05"]), NOW, WASH).days[4].clean).toBe(true);
  expect(planWash(salty(rain(3.5), ["2026-09-17T05"]), NOW, WASH).days[4].clean).toBe(false);
});

test("wash: frost on dry roads doesn't salt; frost with snowfall does", () => {
  const later: [string, number][] = [["2026-09-18T12:00", 0.15]];
  expect(planWash(salty(later, ["2026-09-17T05"]), NOW, WASH).days[2].clean).toBe(true);
  const snowed = planWash(salty(later, ["2026-09-17T05"], [["2026-09-17T05", 0.05]]), NOW, WASH);
  expect(snowed.days[2].clean).toBe(false);
});

test("wash: salted but dry roads while driving stay clean", () => {
  // Night-time trigger; roads are dry again by 06:00 and no more moisture follows.
  const r = planWash(salty([["2026-09-17T01:00", 0.3]], ["2026-09-17T01"]), NOW, WASH);
  expect(r.days[1].clean).toBe(true);
  expect(r.days[2].clean).toBe(true);
});
