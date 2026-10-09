/**
 * Clothing advice for commute mode: an outfit level per hour, and one plan per day (a single outfit that works
 * both ways, plus small per-leg modifiers the rider can carry or swap mid-day).
 */
import type { CommuteDay, CommuteWindow, HourCell } from "./commute";

/** 0 summer kit · 1 light jacket · 2 jacket, gloves · 3 winter jacket · 4 full winter. */
export type Outfit = 0 | 1 | 2 | 3 | 4;
export type Leg = "work" | "home";

// ponytail: fixed constants, like the danger thresholds. Upgrade path: make configurable if riders ask.
/** Felt temperature (°C) at or above which each outfit is enough, warmest first: ≥18 summer … ≥0 winter, below full winter. */
export const OUTFIT_MIN = [18, 12, 6, 0] as const;
/** Felt temp = air temp − 1 °C per this many m/s of felt wind. */
export const WIND_PER_DEGREE = 3;
/** Rain gear from this much rain (mm/h), or any snow. */
export const RAIN_GEAR_MM = 0.3;
/** Wind jacket in the bag: one leg at or above this felt wind (m/s)… */
export const WIND_JACKET_HI = 6;
/** …while the other stays below this. */
export const WIND_JACKET_LO = 3;

export const feltTemp = (temp: number, feel: number): number => temp - feel / WIND_PER_DEGREE;

export function outfitLevel(temp: number, feel: number): Outfit {
  const f = feltTemp(temp, feel);
  const i = OUTFIT_MIN.findIndex((min) => f >= min);
  return (i < 0 ? 4 : i) as Outfit;
}

const wet = (c: HourCell): boolean => c.mm >= RAIN_GEAR_MM || c.snow > 0;

/** What this hour alone calls for; null without a temperature. */
export function hourOutfit(c: HourCell): { level: Outfit; rain: boolean } | null {
  if (c.missing || c.temp === null) return null;
  return { level: outfitLevel(c.temp, c.feel), rain: wet(c) };
}

interface LegNeed {
  level: Outfit;
  /** coldest air temperature, °C */
  temp: number;
  rain: boolean;
  /** strongest felt wind, m/s */
  wind: number;
}

/** A leg's needs at its worst hour; null when no hour has a temperature. */
function legNeed(w: CommuteWindow): LegNeed | null {
  const cells = w.cells.filter((c) => !c.missing && c.temp !== null);
  if (!cells.length) return null;
  return {
    level: Math.max(...cells.map((c) => outfitLevel(c.temp!, c.feel))) as Outfit,
    temp: Math.min(...cells.map((c) => c.temp!)),
    rain: cells.some(wet),
    wind: Math.max(...cells.map((c) => c.feel)),
  };
}

export interface DayPlan {
  /** the outfit worn both ways */
  level: Outfit;
  /** legs that need rain gear */
  rain: Leg[];
  /** colder leg needs an extra warm layer (legs more than one outfit apart) */
  warm?: Leg;
  /** carry a wind jacket for this leg */
  wind?: Leg;
  /** coldest temperature per leg, °C (null: no data) */
  temps: Record<Leg, number | null>;
}

/**
 * One outfit for the day. Legs within one level: wear the colder leg's outfit. Further apart: one level lighter
 * than the colder leg, plus a warm layer for that leg (otherwise the warmer leg is far over-dressed).
 */
export function dayPlan(d: CommuteDay): DayPlan | null {
  const need: Record<Leg, LegNeed | null> = { work: legNeed(d.toWork), home: legNeed(d.home) };
  const legs = (["work", "home"] as const).filter((l) => need[l]);
  if (!legs.length) return null;
  const cold = legs.reduce((a, b) => (need[b]!.level > need[a]!.level ? b : a));
  const lo = need[cold]!.level;
  const hi = Math.min(...legs.map((l) => need[l]!.level));
  const gap = lo - hi > 1;
  const level = (gap ? lo - 1 : lo) as Outfit;
  const plan: DayPlan = {
    level,
    rain: legs.filter((l) => need[l]!.rain),
    temps: { work: need.work?.temp ?? null, home: need.home?.temp ?? null },
  };
  if (gap) plan.warm = cold;
  if (legs.length === 2 && level <= 1) {
    const windy = legs.find(
      (l) =>
        need[l]!.wind >= WIND_JACKET_HI &&
        need[l === "work" ? "home" : "work"]!.wind < WIND_JACKET_LO,
    );
    if (windy) plan.wind = windy;
  }
  return plan;
}
