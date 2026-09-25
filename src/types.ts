export type Mode = "work" | "carwash" | "commute";

/** One activity in `work` mode. */
export interface TaskConfig {
  name: string;
  /** Ground wetness limit in mm: the task is OK when wetness at window start is at or below it. */
  max_wet: number;
  /** Hours without rain required after the window. */
  after?: number;
}

export interface CardConfig {
  type: string;
  mode?: Mode;
  title?: string;
  subtitle?: string;

  /** Defaults to the Home Assistant home location. */
  latitude?: number;
  longitude?: number;
  /** Open-Meteo model. `metno_seamless` (MET Nordic 1 km, Scandinavia) or `best_match`. */
  model?: string;
  /** Number of days to show (default 7, max 10). */
  days?: number;
  /** How often to refetch, in minutes (default 60). */
  refresh_minutes?: number;
  /** Accent colour; defaults per mode. */
  accent?: string;

  // --- work mode -------------------------------------------------------
  /** "HH:MM" — when the window opens on Mon–Fri (default 18:00). */
  weekday_start?: string;
  /** "HH:MM" — when the window opens on Sat/Sun (default 10:00). */
  weekend_start?: string;
  /** `dusk` (civil), `sunset`, or a fixed "HH:MM" (default dusk). */
  window_end?: string;
  /** Windows shorter than this are ignored (default 45). */
  min_window_minutes?: number;
  /** mm/h that counts as rain inside the window and for `after` (default 0.2). */
  rain_threshold?: number;
  /** Activities to evaluate. Default: Mow (≤ 0.3 mm wet) and Paint (≤ 0.1 mm wet + 24 h no rain after). */
  tasks?: TaskConfig[];

  // --- carwash mode ----------------------------------------------------
  /** "HH:MM" — when you'd start washing (default 18:00). */
  wash_start?: string;
  /** mm in an hour above which roads turn wet (default 0.2). */
  ok_rain?: number;
  /** @deprecated Ignored since v2.0.0 (wet-roads model). */
  night_max?: number;
  /** Night (no driving, half-speed drying) runs from this hour… (default 22:00) */
  night_from?: string;
  /** …until this hour (default 06:00). */
  night_until?: string;
  /** Rain-free hours until wet roads are dry again (default 3). */
  dry_roads_hours?: number;
  /** Optional "HH:MM" window the car is parked indoors on `workdays`. Both must be set. */
  parked_start?: string;
  parked_end?: string;

  // --- commute mode ----------------------------------------------------
  /** "HH:MM" bounds of the ride to work (default 07:00–09:00). */
  to_work_start?: string;
  to_work_end?: string;
  /** "HH:MM" bounds of the ride home (default 16:00–18:00). */
  home_start?: string;
  home_end?: string;
  /** "HH:MM" bounds of the midday context window (default 09:00–15:00). */
  midday_start?: string;
  midday_end?: string;
  /** Rain (mm/h) that is still "fine" / still "tolerable" for a cyclist (default 0.2 / 0.8). */
  rain_fine?: number;
  rain_ok?: number;
  /** Effective wind (m/s, see commute.ts) that is still "fine" / still "tolerable" (default 6 / 10). */
  wind_fine?: number;
  wind_ok?: number;
  /** ISO weekdays, 1 = Monday … 7 = Sunday (default [1,2,3,4,5]). Commute: days shown. Carwash: days the parked window applies. */
  workdays?: number[];
}

export interface HourPoint {
  /** UTC instant of the start of the hour. */
  t: number;
  /** Precipitation in mm during this hour == mm/h. */
  mm: number;
  /** Mean 10 m wind speed during this hour, m/s. */
  wind: number;
  /** 10 m gust speed during this hour, m/s. Absent → treat as `wind`. */
  gust?: number;
  /** FAO reference evapotranspiration during this hour, mm (0 when missing). */
  et0: number;
  /** True when this hour is in the past (from the archive part of the response). */
  past: boolean;
}

export interface WeatherData {
  hours: HourPoint[];
  fetchedAt: number;
  model: string;
}

/** Minimal slice of the HA `hass` object this card touches. */
export interface HassLike {
  config: {
    latitude: number;
    longitude: number;
    time_zone: string;
    language?: string;
  };
  language?: string;
  locale?: { language?: string };
}
