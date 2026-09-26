import { test, expect } from "vitest";
import { parseHourly } from "../src/weather";

test("parseHourly: unix seconds → ms, nulls fall back (gust → wind, temp → null, rest → 0)", () => {
  const t0 = 1_800_000_000;
  const hours = parseHourly(
    {
      hourly: {
        time: [t0, t0 + 3600],
        precipitation: [0.4, null],
        wind_speed_10m: [5, null],
        wind_gusts_10m: [null, 12],
        et0_fao_evapotranspiration: [null, 0.1],
        snowfall: [0.2, null],
        temperature_2m: [null, -1],
      },
    },
    t0 * 1000 + 3600_000,
  );
  expect(hours).toEqual([
    {
      t: t0 * 1000,
      mm: 0.4,
      wind: 5,
      gust: 5,
      et0: 0,
      snow: 0.2,
      temp: null,
      snowDepth: 0,
      past: true,
    },
    {
      t: (t0 + 3600) * 1000,
      mm: 0,
      wind: 0,
      gust: 12,
      et0: 0.1,
      snow: 0,
      temp: -1,
      snowDepth: 0,
      past: false,
    },
  ]);
  expect(parseHourly({}, 0)).toEqual([]);
});
