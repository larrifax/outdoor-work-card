// Shared setup for the browser tests: frozen clock, offline Open-Meteo, one themed card per test.
import { beforeAll, afterAll, expect, onTestFinished } from "vitest";
import { page } from "vitest/browser";
// Importing entry registers <outdoor-work-card> as a side effect.
import "../src/outdoor-work-card";
import { COMMUTE, GOOD, RAINY, TONIGHT } from "./fixtures/example";

// Minimal <ha-card> so the bundle renders outside Home Assistant.
beforeAll(() => {
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
  // Commute popovers open upward and past the card's right edge; give them room inside the shot.
  const pad = name === "commute" ? "300px 120px 24px 24px" : "24px";
  host.style.cssText = `padding:${pad};width:480px;font-family:Roboto,system-ui,sans-serif`;
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
  return frame;
}
