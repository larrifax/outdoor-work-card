// Open-Meteo-shaped hourly precipitation fixtures for the screenshot test.
// Two scenarios keyed by latitude: 59.91 = good week, 59.92 = rainy week.
// Clock is frozen to Wed 16 Sep 2026, 16:00 Europe/Oslo (see the browser test).

const H = 3600e3;

/** Late-September ET0: ~0.2 mm/h around midday, a trickle otherwise (~1.7 mm/day). */
const et0 = (t: number) => {
  const h = (new Date(t).getUTCHours() + 2) % 24;
  return h >= 10 && h < 16 ? 0.2 : h >= 8 && h < 18 ? 0.1 : 0.01;
};

function build(rain: [string, number][]) {
  const start = Date.UTC(2026, 8, 9, 0, 0) - 2 * H; // Oslo midnight 9 Sep (7 past days)
  const time: number[] = [];
  const precipitation: number[] = [];
  const et0_fao_evapotranspiration: number[] = [];
  for (let t = start; t < start + 19 * 24 * H; t += H) {
    time.push(t / 1000);
    precipitation.push(0);
    et0_fao_evapotranspiration.push(et0(t));
  }
  for (const [iso, mm] of rain) {
    const i = time.indexOf(Date.parse(iso + "+02:00") / 1000);
    if (i >= 0) precipitation[i] = mm;
  }
  return { hourly: { time, precipitation, et0_fao_evapotranspiration } };
}

export const GOOD = build([
  ["2026-09-15T10:00", 1.2],
  ["2026-09-18T05:00", 0.8],
  ["2026-09-18T06:00", 1.5],
  ["2026-09-18T07:00", 1.1],
  ["2026-09-18T08:00", 0.6],
  ["2026-09-18T23:00", 0.3],
  ["2026-09-19T14:00", 0.4],
  ["2026-09-21T13:00", 2.6],
  ["2026-09-21T14:00", 2.1],
  ["2026-09-21T15:00", 1.4],
  ["2026-09-21T16:00", 0.9],
  ["2026-09-22T12:00", 1.4],
]);

// Wash-tonight scenario (keyed by latitude 59.90): tonight is the pick, a wash
// now stays clean for 5 days, ended by Tuesday's daytime rain. Renders the `ok`
// hero state (no banner, no trade-off line).
export const TONIGHT = build([
  ["2026-09-15T10:00", 1.0],
  ["2026-09-22T14:00", 2.6],
  ["2026-09-22T15:00", 1.8],
]);

export const RAINY = build([
  ["2026-09-16T09:00", 1.1],
  ["2026-09-16T10:00", 2.0],
  ["2026-09-16T11:00", 1.6],
  ["2026-09-16T12:00", 0.8],
  ["2026-09-16T13:00", 0.7],
  ["2026-09-16T14:00", 0.5],
  ["2026-09-17T16:00", 3.2],
  ["2026-09-17T17:00", 1.0],
  ["2026-09-18T19:00", 1.2],
  ["2026-09-18T20:00", 2.4],
  ["2026-09-18T21:00", 1.0],
  ["2026-09-19T00:00", 0.6],
  ["2026-09-19T01:00", 0.4],
  ["2026-09-19T02:00", 0.3],
  ["2026-09-20T14:00", 0.9],
  ["2026-09-20T15:00", 1.3],
  ["2026-09-21T23:00", 0.4],
  ["2026-09-23T04:00", 1.0],
  // A soaking beyond the outlook keeps the last days' ground from drying in the data ("—").
  ["2026-09-25T12:00", 8.0],
]);

// Commute scenario (keyed by latitude 59.93): Wed F (storm gusts home), Thu B
// with a flagged wet midday, Fri D, Mon C, Tue A with gusts that lift the
// effective wind above the mean without leaving "fine".
function commute() {
  const base = build([
    ["2026-09-17T08:00", 0.4],
    ["2026-09-17T11:00", 1.2],
    ["2026-09-17T12:00", 2.4],
    ["2026-09-17T13:00", 0.9],
    ["2026-09-18T07:00", 1.6],
    ["2026-09-18T08:00", 0.6],
    ["2026-09-21T08:00", 0.5],
    ["2026-09-21T16:00", 0.4],
  ]);
  const wind = base.hourly.time.map(() => 3);
  const gusts = base.hourly.time.map(() => 5);
  const set = (iso: string, w: number, g: number) => {
    const i = base.hourly.time.indexOf(Date.parse(iso + "+02:00") / 1000);
    wind[i] = w;
    gusts[i] = g;
  };
  set("2026-09-16T16:00", 9, 18);
  set("2026-09-16T17:00", 12, 26);
  set("2026-09-22T07:00", 4, 9);
  set("2026-09-22T17:00", 5, 9.5);
  return { hourly: { ...base.hourly, wind_speed_10m: wind, wind_gusts_10m: gusts } };
}
export const COMMUTE = commute();
