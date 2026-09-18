/**
 * Open-Meteo client. One request gives the card both the recent past
 * (`past_days`, from the model's archived analyses — good enough to answer
 * "has the ground had a day to dry?" without a rain gauge) and the forecast.
 *
 * Default model `metno_seamless` = MET Nordic 1 km for Norway/Sweden/Denmark/
 * Finland, blended with ECMWF beyond ~2.5 days. Non-commercial use needs no key.
 */
import type { HourPoint, WeatherData } from "./types";

const BASE = "https://api.open-meteo.com/v1/forecast";

interface Entry {
  promise: Promise<WeatherData> | null;
  data: WeatherData | null;
}
/** Shared across every card instance on the page: one fetch per location. */
const cache = new Map<string, Entry>();

export interface WeatherRequest {
  lat: number;
  lon: number;
  model: string;
  pastDays: number;
  forecastDays: number;
  maxAgeMs: number;
}

export function getWeather(req: WeatherRequest): Promise<WeatherData> {
  const key = `${req.lat.toFixed(3)},${req.lon.toFixed(3)},${req.model},${req.pastDays},${req.forecastDays}`;
  let e = cache.get(key);
  if (!e) {
    e = { promise: null, data: null };
    cache.set(key, e);
  }
  if (e.data && Date.now() - e.data.fetchedAt < req.maxAgeMs) return Promise.resolve(e.data);
  if (e.promise) return e.promise;
  const entry = e;
  entry.promise = fetchWeather(req)
    .then((d) => {
      entry.data = d;
      return d;
    })
    .finally(() => {
      entry.promise = null;
    });
  return entry.promise;
}

async function fetchWeather(req: WeatherRequest): Promise<WeatherData> {
  const p = new URLSearchParams({
    latitude: req.lat.toFixed(4),
    longitude: req.lon.toFixed(4),
    hourly: "precipitation",
    models: req.model,
    past_days: String(req.pastDays),
    forecast_days: String(req.forecastDays),
    timeformat: "unixtime",
    timezone: "UTC",
  });
  const res = await fetch(`${BASE}?${p.toString()}`);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.reason || "Open-Meteo error");
  const times: number[] = json.hourly?.time ?? [];
  const mm: (number | null)[] = json.hourly?.precipitation ?? [];
  const now = Date.now();
  const hours: HourPoint[] = times.map((t, i) => {
    const ms = t * 1000;
    return { t: ms, mm: mm[i] ?? 0, past: ms + 3_600_000 <= now };
  });
  return { hours, fetchedAt: now, model: req.model };
}
