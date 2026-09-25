import { test, expect } from "vitest";
import { resolve } from "../src/config";

const hass = { config: { latitude: 59.91, longitude: 10.75, time_zone: "Europe/Oslo" } };
const wash = (extra: object = {}) =>
  resolve({ type: "custom:outdoor-work-card", mode: "carwash", ...extra }, hass);

test("carwash defaults: 0.2 mm wets roads, 3 h to dry, no parked window; night_max is ignored", () => {
  const r = wash();
  expect(r.okRain).toBe(0.2);
  expect(r.dryRoadsHours).toBe(3);
  expect(r.parked).toBeNull();
  expect(wash({ night_max: 1 })).toEqual(r);
});

test("work tasks: defaults are Mow ≤ 0.3 mm and Paint ≤ 0.1 mm + 24 h after; old `before` falls back to 0.3", () => {
  const def = resolve({ type: "custom:outdoor-work-card" }, hass).tasks;
  expect(def).toEqual([
    { name: "Mow", max_wet: 0.3 },
    { name: "Paint", max_wet: 0.1, after: 24 },
  ]);
  const legacy = resolve(
    { type: "custom:outdoor-work-card", tasks: [{ name: "Weed", before: 6 } as never] },
    hass,
  ).tasks;
  expect(legacy).toEqual([{ name: "Weed", max_wet: 0.3, after: undefined }]);
});

test("carwash parked window needs both valid ends", () => {
  expect(wash({ parked_start: "08:00", parked_end: "16:30" }).parked).toEqual([480, 990]);
  expect(wash({ parked_start: "08:00" }).parked).toBeNull();
  expect(wash({ parked_start: "8am", parked_end: "16:00" }).parked).toBeNull();
});
