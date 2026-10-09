import { test, expect } from "vitest";
import { planCommute, type CommuteOptions } from "../src/commute";
import { outfitLevel, hourOutfit, dayPlan } from "../src/clothing";
import type { HourPoint } from "../src/types";

const H = 3_600_000;
const OPTS: CommuteOptions = {
  tz: "Europe/Oslo",
  toWork: [7 * 60, 9 * 60],
  home: [16 * 60, 18 * 60],
  midday: [9 * 60, 15 * 60],
  rainFine: 0.2,
  rainOk: 1.0,
  windFine: 6,
  windOk: 10,
  workdays: [1, 2, 3, 4, 5],
  days: 1,
};

/** Monday 21 Sep 2026 (Oslo). Default hour: 10 °C, felt wind 3 m/s, dry. `set` maps hour → overrides. */
function monday(set: Record<number, Partial<HourPoint>> = {}) {
  const start = Date.UTC(2026, 8, 20, 22, 0);
  const hours: HourPoint[] = [];
  for (let h = 0; h < 24; h++)
    hours.push({ t: start + h * H, mm: 0, wind: 3, gust: 5, et0: 0, temp: 10, snow: 0, ...set[h] });
  return planCommute(hours, start + 6 * H, OPTS).days[0]!;
}
/** Steady wind: gust at the ordinary factor, so felt wind == mean. */
const wind = (w: number) => ({ wind: w, gust: w / 0.6 });
const both = (p: Partial<HourPoint>, hs: number[]) => Object.fromEntries(hs.map((h) => [h, p]));

test("outfit level from felt temperature, wind lowers it", () => {
  expect([18, 17.9, 12, 6, 0, -0.1].map((t) => outfitLevel(t, 0))).toEqual([0, 1, 1, 2, 3, 4]);
  expect(outfitLevel(19, 3)).toBe(0);
  expect(outfitLevel(19, 6)).toBe(1);
});

test("hour outfit: rain gear on rain or snow, nothing without a temperature", () => {
  const d = monday({ 7: { mm: 0.3 }, 8: { mm: 0.1, snow: 0.1 }, 16: { temp: null } });
  expect(hourOutfit(d.toWork.cells[0]!)).toEqual({ level: 2, rain: true });
  expect(hourOutfit(d.toWork.cells[1]!)?.rain).toBe(true);
  expect(hourOutfit(d.home.cells[0]!)).toBeNull();
  expect(hourOutfit(d.home.cells[1]!)).toEqual({ level: 2, rain: false });
});

test("day plan: same outfit both ways, coldest temperature per leg", () => {
  const p = dayPlan(monday({ 8: { temp: 7 } }))!;
  expect(p.level).toBe(2);
  expect(p.rain).toEqual([]);
  expect(p.warm).toBeUndefined();
  expect(p.temps).toEqual({ work: 7, home: 10 });
});

test("day plan: legs one level apart wear the colder outfit, further apart add a warm layer", () => {
  // work felt 4 (winter jacket), home felt 9 (jacket): colder outfit, no layer
  expect(dayPlan(monday(both({ temp: 5 }, [7, 8]))!)).toMatchObject({ level: 3 });
  expect(dayPlan(monday(both({ temp: 5 }, [7, 8]))!)!.warm).toBeUndefined();
  // work felt 0 (winter jacket), home felt 19 (summer): one lighter than the cold leg + warm layer to work
  const p = dayPlan(monday({ ...both({ temp: 1 }, [7, 8]), ...both({ temp: 20 }, [16, 17]) }))!;
  expect(p.level).toBe(2);
  expect(p.warm).toBe("work");
});

test("day plan: rain gear per leg", () => {
  expect(dayPlan(monday({ 17: { mm: 1 } }))!.rain).toEqual(["home"]);
  expect(dayPlan(monday({ 7: { mm: 1 }, 17: { mm: 1 } }))!.rain).toEqual(["work", "home"]);
});

test("day plan: wind jacket in the bag only on light-outfit days with one windy leg", () => {
  const warm = both({ temp: 17 }, [7, 8, 16, 17]);
  const windyWork = { ...both({ ...wind(7) }, [7, 8]), ...both({ ...wind(2) }, [16, 17]) };
  const merge = (a: Record<number, Partial<HourPoint>>, b: Record<number, Partial<HourPoint>>) =>
    Object.fromEntries(Object.keys({ ...a, ...b }).map((k) => [k, { ...a[+k], ...b[+k] }]));
  const p = dayPlan(monday(merge(warm, windyWork)))!;
  expect(p.level).toBe(1);
  expect(p.wind).toBe("work");
  // jacket or warmer already covers the wind
  expect(dayPlan(monday(windyWork))!.wind).toBeUndefined();
});

test("day plan: no temperatures, no plan", () => {
  expect(dayPlan(monday(both({ temp: null }, [7, 8, 16, 17])))).toBeNull();
});
