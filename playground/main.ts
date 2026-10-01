// Standalone dev page: the real card with live Open-Meteo data and a fake `hass`.
// Importing the entry registers <outdoor-work-card> as a side effect.
import "../src/outdoor-work-card";

// Minimal <ha-card> so the card renders outside Home Assistant (same trick as the screenshot test).
if (!customElements.get("ha-card")) customElements.define("ha-card", class extends HTMLElement {});

type CardEl = HTMLElement & { setConfig(c: object): void; hass: unknown };

const DEFAULTS = [
  { type: "custom:outdoor-work-card", mode: "commute" },
  { type: "custom:outdoor-work-card", mode: "carwash" },
  { type: "custom:outdoor-work-card", mode: "work" },
];

const load = <T>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private window: no persistence */
  }
};

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const lat = $<HTMLInputElement>("lat");
const lon = $<HTMLInputElement>("lon");
const loc = load("pg-loc", { lat: 59.91, lon: 10.75 });
lat.value = String(loc.lat);
lon.value = String(loc.lon);

const hass = () => ({
  config: {
    latitude: parseFloat(lat.value),
    longitude: parseFloat(lon.value),
    time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  },
  locale: { language: navigator.language },
  states: {},
});

function render() {
  const root = $("cards");
  root.replaceChildren();
  const configs = load<object[]>("pg-configs", DEFAULTS);
  configs.forEach((cfg, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    let card = mount(cfg);
    const box = document.createElement("textarea");
    box.value = JSON.stringify(cfg, null, 2);
    box.addEventListener("input", () => {
      try {
        const next = JSON.parse(box.value);
        box.classList.remove("bad");
        configs[i] = next;
        save("pg-configs", configs);
        // A fresh element so setConfig + refetch behave like a dashboard reload.
        const fresh = mount(next);
        card.replaceWith(fresh);
        card = fresh;
      } catch {
        box.classList.add("bad");
      }
    });
    slot.append(card, box);
    root.append(slot);
  });
}

function mount(cfg: object): CardEl {
  const el = document.createElement("outdoor-work-card") as CardEl;
  try {
    el.setConfig(cfg);
  } catch (e) {
    const err = document.createElement("pre");
    err.textContent = String(e);
    return err as unknown as CardEl;
  }
  el.hass = hass();
  return el;
}

for (const input of [lat, lon])
  input.addEventListener("change", () => {
    save("pg-loc", { lat: parseFloat(lat.value), lon: parseFloat(lon.value) });
    render();
  });
$("theme").addEventListener("click", () => {
  const d = document.documentElement;
  d.dataset.theme = d.dataset.theme === "light" ? "dark" : "light";
  save("pg-theme", d.dataset.theme);
});
$("reset").addEventListener("click", () => {
  save("pg-configs", DEFAULTS);
  render();
});
document.documentElement.dataset.theme = load("pg-theme", "dark");
render();
