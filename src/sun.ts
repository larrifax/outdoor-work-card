/**
 * Sunset and civil dusk for an arbitrary local date, so the card can draw
 * the "after work → dark" window for every day of the outlook, not just today.
 * Uses the standard sunrise-equation approximation (accuracy: a few minutes).
 */
import { zonedToUtc } from "./time";

const RAD = Math.PI / 180;

/**
 * UTC ms of the moment the sun's centre passes `zenithDeg` in the evening,
 * or null if it never does (midnight sun / polar night).
 * zenith 90.833 = sunset, 96 = civil dusk.
 */
function eveningEvent(
  localNoonUtcMs: number,
  lat: number,
  lon: number,
  zenithDeg: number,
): number | null {
  const jd = localNoonUtcMs / 86_400_000 + 2_440_587.5;
  const n = Math.round(jd - 2_451_545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (((357.5291 + 0.98560028 * jStar) % 360) + 360) % 360;
  const C =
    1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const lambda = (((M + C + 180 + 102.9372) % 360) + 360) % 360;
  const jTransit =
    2_451_545.0 + jStar + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * lambda * RAD);
  const decl = Math.asin(Math.sin(lambda * RAD) * Math.sin(23.4397 * RAD));
  const cosW =
    (Math.cos(zenithDeg * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) /
    (Math.cos(lat * RAD) * Math.cos(decl));
  if (cosW < -1 || cosW > 1) return null;
  const w = Math.acos(cosW) / RAD; // degrees
  const jSet = jTransit + w / 360;
  return (jSet - 2_440_587.5) * 86_400_000;
}

export interface SunTimes {
  sunset: number | null;
  dusk: number | null;
}

export function sunTimesFor(
  y: number,
  m: number,
  d: number,
  lat: number,
  lon: number,
  tz: string,
): SunTimes {
  const noon = zonedToUtc(y, m, d, 12, 0, tz);
  return {
    sunset: eveningEvent(noon, lat, lon, 90.833),
    dusk: eveningEvent(noon, lat, lon, 96),
  };
}
