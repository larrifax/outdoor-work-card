import { test, expect, beforeAll, afterAll } from "vitest";
import { page } from "vitest/browser";
// Importing entry registers <outdoor-work-card> as a side effect.
import "../src/outdoor-work-card";
import { GOOD, RAINY } from "./fixtures/example";

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
    const body = Math.abs(lat - 59.92) < 0.001 ? RAINY : GOOD;
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
const configs = [
  { type: "custom:outdoor-work-card", mode: "work" },
  {
    type: "custom:outdoor-work-card",
    mode: "work",
    latitude: 59.92,
    title: "Outdoor Work (rainy week)",
  },
  { type: "custom:outdoor-work-card", mode: "carwash" },
  {
    type: "custom:outdoor-work-card",
    mode: "carwash",
    latitude: 59.92,
    title: "Car Wash (rainy week)",
  },
];

// HA-ish theme vars per appearance (mirrors the old harness.html).
const THEMES = {
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

async function mountThemed(theme: keyof typeof THEMES) {
  const host = document.createElement("div");
  host.style.cssText =
    "padding:24px;font-family:Roboto,system-ui,sans-serif;display:grid;grid-template-columns:repeat(2,480px);gap:24px";
  for (const [k, v] of Object.entries(THEMES[theme])) host.style.setProperty(k, v);
  document.body.appendChild(host);

  for (const c of configs) {
    const el = document.createElement("outdoor-work-card") as HTMLElement & {
      setConfig: (c: object) => void;
      hass: unknown;
    };
    el.setConfig(c);
    host.appendChild(el);
    el.hass = hass;
  }
  await customElements.whenDefined("outdoor-work-card");
  // Let the async fetch + render chain settle.
  await new Promise((r) => setTimeout(r, 1500));
  return host;
}

for (const theme of ["dark", "light"] as const) {
  test(`renders and screenshots all cards in ${theme} mode`, async () => {
    const host = await mountThemed(theme);
    const cards = host.querySelectorAll("outdoor-work-card");
    expect(cards.length).toBe(4);
    // Each card should have rendered its ha-card shell.
    for (const card of cards) {
      expect(card.shadowRoot?.querySelector("ha-card"), "ha-card mounted").toBeTruthy();
    }
    await page.screenshot({ element: host, path: `__screenshots__/cards-${theme}.png` });
  });
}
