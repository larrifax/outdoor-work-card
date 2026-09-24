export type Mode = "work" | "carwash" | "commute";

/** One activity in `work` mode. `before`/`after` are hours of dry ground required. */
export interface TaskConfig {
  name: string;
  before: number;
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
  /** mm/h that counts as "rain" for the ground (default 0.2). */
  rain_threshold?: number;
  /** Activities to evaluate. Default: Mow (24 h before) and Paint (24 h before + 24 h after). */
  tasks?: TaskConfig[];

  // --- carwash mode ----------------------------------------------------
  /** "HH:MM" — when you'd start washing (default 18:00). */
  wash_start?: string;
  /** mm/h that is harmless to a clean car by day (default 0.5). */
  ok_rain?: number;
  /** mm/h tolerated at night (default 4). */
  night_max?: number;
  /** Night runs from this hour… (default 22:00) */
  night_from?: string;
  /** …until this hour (default 06:00). */
  night_until?: string;
  /** Hours before wash time that must be rain-free so the roads are dry (default 2). */
  dry_roads_hours?: number;

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
  /** ISO weekdays to show, 1 = Monday … 7 = Sunday (default [1,2,3,4,5]). */
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
