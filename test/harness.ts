// Shared setup for the browser tests: frozen clock, offline Open-Meteo, one themed card per test.
import { beforeAll, afterAll, expect, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
// Importing entry registers <outdoor-work-card> as a side effect.
import "../src/outdoor-work-card";
import { MONO_FAMILY, loadMonoFont } from "../src/mono-font";
// Roboto as Home Assistant loads it, so screenshots use the font the card gets in HA.
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/600.css";
import "@fontsource/roboto/700.css";
import { COMMUTE, GOOD, RAINY, TONIGHT } from "./fixtures/example";

// Minimal <ha-card> so the bundle renders outside Home Assistant.
beforeAll(async () => {
  // Font faces load lazily; fetch every weight the card uses before the first render.
  const weights = ["400", "500", "600", "700"];
  await Promise.all(weights.map((w) => document.fonts.load(`${w} 16px Roboto`)));
  // load() falls back to the nearest weight, so check each exact weight got a face of its own.
  const loaded = new Set(
    [...document.fonts]
      .filter((f) => f.family === "Roboto" && f.status === "loaded")
      .map((f) => f.weight),
  );
  expect(
    weights.filter((w) => !loaded.has(w)),
    "Roboto weights missing",
  ).toEqual([]);
  // The card bundles its mono font; register and load it now so the first shot doesn't catch the swap.
  loadMonoFont();
  const [mono] = await document.fonts.load(`16px "${MONO_FAMILY}"`);
  expect(mono?.status, "bundled mono font loaded").toBe("loaded");
  if (!customElements.get("ha-card"))
    customElements.define("ha-card", class extends HTMLElement {});
});

// Freeze the clock: Wed 16 Sep 2026, 16:00 Europe/Oslo (14:00Z).
const REAL_NOW = Date.now;
const FAKE_NOW = Date.UTC(2026, 8, 16, 14, 0);
beforeAll(() => {
  Date.now = () => FAKE_NOW;
});
afterAll(() => {
  Date.now = REAL_NOW;
});

// Mock Open-Meteo fetch so the render path runs offline; latitude picks scenario.
const REAL_FETCH = globalThis.fetch;
beforeAll(() => {
  globalThis.fetch = (async (url: string | URL) => {
    const u = new URL(String(url));
    const lat = parseFloat(u.searchParams.get("latitude") ?? "0");
    const body =
      Math.abs(lat - 59.93) < 0.001
        ? COMMUTE
        : Math.abs(lat - 59.92) < 0.001
          ? RAINY
          : Math.abs(lat - 59.9) < 0.001
            ? TONIGHT
            : GOOD;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
});
afterAll(() => {
  globalThis.fetch = REAL_FETCH;
});

const hass = { config: { latitude: 59.91, longitude: 10.75, time_zone: "Europe/Oslo" } };

// Every card the tests render; the key names test cases and screenshot baselines.
export const CARDS = {
  work: { type: "custom:outdoor-work-card", mode: "work" },
  "work-rainy": {
    type: "custom:outdoor-work-card",
    mode: "work",
    latitude: 59.92,
    title: "Outdoor Work (rainy week)",
  },
  "carwash-tonight": {
    type: "custom:outdoor-work-card",
    mode: "carwash",
    latitude: 59.9,
    title: "Car Wash (wash tonight)",
  },
  carwash: { type: "custom:outdoor-work-card", mode: "carwash" },
  "carwash-rainy": {
    type: "custom:outdoor-work-card",
    mode: "carwash",
    latitude: 59.92,
    title: "Car Wash (rainy week)",
  },
  commute: { type: "custom:outdoor-work-card", mode: "commute", latitude: 59.93 },
} as const;
export type CardName = keyof typeof CARDS;

// HA-ish theme vars per appearance (mirrors the old harness.html).
export const THEMES = {
  dark: {
    background: "#0d1117",
    "--primary-text-color": "#e8eaed",
    "--secondary-text-color": "#9aa2ad",
    "--divider-color": "rgba(255,255,255,.08)",
    "--ha-card-background": "#171b24",
    "--ha-card-border-radius": "16px",
  },
  light: {
    background: "#f2f3f5",
    "--primary-text-color": "#1c1c1e",
    "--secondary-text-color": "#5f6570",
    "--divider-color": "rgba(0,0,0,.08)",
    "--ha-card-background": "#ffffff",
    "--ha-card-border-radius": "16px",
  },
} as const;
export type Theme = keyof typeof THEMES;

/** Mounts one themed card and waits until it has rendered its forecast. Returns a locator for its frame. */
export async function mountCard(name: CardName, theme: Theme = "dark") {
  const host = document.createElement("div");
  host.style.cssText = "padding:24px;width:480px;font-family:Roboto,system-ui,sans-serif";
  for (const [k, v] of Object.entries(THEMES[theme])) host.style.setProperty(k, v);
  host.dataset["testid"] = `${name}-${theme}`;
  document.body.appendChild(host);
  onTestFinished(() => host.remove());

  const el = document.createElement("outdoor-work-card") as HTMLElement & {
    setConfig: (c: object) => void;
    hass: unknown;
  };
  el.setConfig(CARDS[name]);
  host.appendChild(el);
  el.hass = hass;

  const frame = page.getByTestId(`${name}-${theme}`);
  // Settled once the card has rendered (info button) and is no longer fetching.
  await expect.element(frame.getByRole("button", { name: /^How / })).toBeVisible();
  await expect.element(frame.getByText(/^Fetching forecast/)).not.toBeInTheDocument();
  // The mouse stays where the previous test left it; park it in the empty padding so nothing shows hover.
  await userEvent.hover(frame, { position: { x: 2, y: 2 } });
  return frame;
}
