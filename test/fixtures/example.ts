// Open-Meteo-shaped hourly precipitation fixtures for the screenshot test.
// Two scenarios keyed by latitude: 59.91 = good week, 59.92 = rainy week.
// Clock is frozen to Wed 16 Sep 2026, 16:00 Europe/Oslo (see the browser test).

const H = 3600e3;

function build(rain: [string, number][]) {
  const start = Date.UTC(2026, 8, 13, 0, 0) - 2 * H; // Oslo midnight 13 Sep
  const time: number[] = [];
  const precipitation: number[] = [];
  for (let t = start; t < start + 15 * 24 * H; t += H) {
    time.push(t / 1000);
    precipitation.push(0);
  }
  for (const [iso, mm] of rain) {
    const i = time.indexOf(Date.parse(iso + "+02:00") / 1000);
    if (i >= 0) precipitation[i] = mm;
  }
  return { hourly: { time, precipitation } };
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
]);
