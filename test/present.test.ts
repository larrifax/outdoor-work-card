import { test, expect } from "vitest";
import { washHero, workHero, runwayBand, dryTime } from "../src/present";
import { strings } from "../src/i18n";
import type { WashDay, WashResult, WorkDay, WorkResult } from "../src/logic";

const TZ = "Europe/Oslo";
const ctx = { t: strings("en"), tz: TZ, short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] };
const at = (iso: string) => Date.parse(iso + "+02:00");

const wd = (full: string, streak: number, over: Partial<WashDay> = {}): WashDay =>
  ({ full, streak, openEnded: false, wetFrom: null, ...over }) as WashDay;
const wash = (days: WashDay[], bestIdx: number, todayBreakIdx = -1, bestBreakIdx = -1) =>
  ({ days, bestIdx, todayBreakIdx, bestBreakIdx }) as WashResult;

test("wash hero: tonight is the pick, no rain in the outlook", () => {
  const h = washHero(wash([wd("Today", 3, { openEnded: true }), wd("Thu", 2)], 0), "18:00", ctx);
  expect(h.state).toBe("ok");
  expect(h.streak).toBe("3+ clean days");
  expect(h.context).toBe("Dry roads from 18:00 tonight, and no wet driving in the whole outlook.");
  expect(h.banner).toBeUndefined();
});

test("wash hero: later evening wins — banner names the break day, trade-off counts the gain", () => {
  const thu = wd("Thursday", 0, { wetFrom: at("2026-09-17T08:00") });
  const h = washHero(wash([wd("Today", 1), thu, wd("Friday", 4)], 2, 1), "18:00", ctx);
  expect(h.state).toBe("rec");
  expect(h.day).toBe("Friday");
  expect(h.banner).toBe("a wash now lasts 1 day — Thursday's wet roads (from 08:00)");
  expect(h.tradeoff).toBeDefined();
});

test("wash hero: nothing works", () => {
  const h = washHero(wash([wd("Today", -1), wd("Thu", -1)], 0), "18:00", ctx);
  expect(h.state).toBe("bad");
  expect(h.streak).toBe("nothing stays clean");
  expect(h.tradeoff).toBeUndefined();
});

test("work hero: verdict ladder", () => {
  const day = { passed: false } as WorkDay;
  const res = (ok: number[], passed = false) =>
    ({
      tonightOk: ok,
      days: [{ ...day, passed }],
      tasks: [
        { nextIdx: -1, longestIdx: -1 },
        { nextIdx: -1, longestIdx: -1 },
      ],
    }) as unknown as WorkResult;
  const tasks = [
    { name: "Mow", max_wet: 0.3 },
    { name: "Paint", max_wet: 0.1, after: 24 },
  ];
  expect(workHero(res([0, 1]), tasks, ctx).verdict).toBe("Go tonight");
  expect(workHero(res([0]), tasks, ctx).verdict).toBe("Go tonight · mow only");
  expect(workHero(res([], true), tasks, ctx).verdict).toBe("Today's window has passed");
  expect(workHero(res([]), tasks, ctx).tasks[1]!.when).toBeNull();
});

test("runway band against the strictest task", () => {
  const tasks = [
    { name: "a", max_wet: 1, after: 12 },
    { name: "b", max_wet: 1, after: 24 },
  ];
  expect(runwayBand(24, tasks)).toBe("full");
  expect(runwayBand(12, tasks)).toBe("half");
  expect(runwayBand(11, tasks)).toBe("short");
  expect(runwayBand(0, [{ name: "a", max_wet: 1 }])).toBe("none");
});

test("dry time: same day shows the clock, a later day adds the weekday", () => {
  const d = { key: "2026-09-16" } as WorkDay;
  expect(dryTime(at("2026-09-16T21:00"), d, ctx)).toBe("21:00");
  expect(dryTime(at("2026-09-18T11:00"), d, ctx)).toBe("Fri 11:00");
  expect(dryTime(null, d, ctx)).toBe("—");
});
