/**
 * Visual config editor. Uses Home Assistant's own <ha-form> so the controls
 * (selects, time pickers, number fields) match the rest of the dashboard editor.
 * Custom `tasks` for work mode are YAML-only; the editor keeps whatever is set.
 */
import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CardConfig, HassLike } from "./types";

type Schema = Array<Record<string, unknown>>;

const COMMON: Schema = [
  {
    name: "mode",
    selector: {
      select: {
        mode: "list",
        options: [
          { value: "work", label: "Outdoor work — dry-ground windows after work" },
          { value: "carwash", label: "Car wash — best evening for a lasting wash" },
        ],
      },
    },
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "title", selector: { text: {} } },
      { name: "subtitle", selector: { text: {} } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "days", selector: { number: { min: 3, max: 10, mode: "box" } } },
      {
        name: "refresh_minutes",
        selector: { number: { min: 10, max: 720, mode: "box", unit_of_measurement: "min" } },
      },
    ],
  },
  {
    type: "expandable",
    name: "",
    title: "Location & data source",
    schema: [
      {
        type: "grid",
        name: "",
        schema: [
          {
            name: "latitude",
            selector: { number: { min: -90, max: 90, step: 0.0001, mode: "box" } },
          },
          {
            name: "longitude",
            selector: { number: { min: -180, max: 180, step: 0.0001, mode: "box" } },
          },
        ],
      },
      {
        name: "model",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              {
                value: "metno_seamless",
                label: "MET Nordic 1 km (Norway, Sweden, Denmark, Finland) — recommended",
              },
              { value: "best_match", label: "Open-Meteo best match (anywhere)" },
              { value: "ecmwf_ifs025", label: "ECMWF IFS 0.25°" },
            ],
          },
        },
      },
      { name: "accent", selector: { text: {} } },
    ],
  },
];

const WORK: Schema = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "weekday_start", selector: { time: {} } },
      { name: "weekend_start", selector: { time: {} } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "window_end",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "dusk", label: "Civil dusk" },
              { value: "sunset", label: "Sunset" },
            ],
          },
        },
      },
      {
        name: "min_window_minutes",
        selector: { number: { min: 0, max: 600, mode: "box", unit_of_measurement: "min" } },
      },
    ],
  },
  {
    name: "rain_threshold",
    selector: {
      number: { min: 0, max: 5, step: 0.1, mode: "slider", unit_of_measurement: "mm/h" },
    },
  },
];

const WASH: Schema = [
  { name: "wash_start", selector: { time: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "ok_rain",
        selector: {
          number: { min: 0, max: 5, step: 0.1, mode: "box", unit_of_measurement: "mm/h" },
        },
      },
      {
        name: "night_max",
        selector: {
          number: { min: 0, max: 20, step: 0.5, mode: "box", unit_of_measurement: "mm/h" },
        },
      },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "night_from", selector: { time: {} } },
      { name: "night_until", selector: { time: {} } },
    ],
  },
  {
    name: "dry_roads_hours",
    selector: { number: { min: 0, max: 12, step: 0.5, mode: "box", unit_of_measurement: "h" } },
  },
];

const LABELS: Record<string, string> = {
  mode: "Card mode",
  title: "Title",
  subtitle: "Subtitle",
  days: "Days to show",
  refresh_minutes: "Refresh every",
  latitude: "Latitude (blank = home)",
  longitude: "Longitude (blank = home)",
  model: "Weather model",
  accent: "Accent colour (CSS)",
  weekday_start: "Weekday window opens",
  weekend_start: "Weekend window opens",
  window_end: "Window closes at",
  min_window_minutes: "Ignore windows shorter than",
  rain_threshold: "Rain that wets the ground",
  wash_start: "Wash time",
  ok_rain: "Harmless daytime rain up to",
  night_max: "Harmless night rain up to",
  night_from: "Night starts",
  night_until: "Night ends",
  dry_roads_hours: "Roads must be dry for",
};

const HELPERS: Record<string, string> = {
  rain_threshold: 'Anything above this counts as rain for "dry before / dry after".',
  ok_rain: "Light drizzle under this will not smudge a clean car, day or night.",
  night_max: "Heavier rain is tolerated overnight, when it does little cosmetic harm.",
  min_window_minutes: "Evenings with less daylight than this are shown but never recommended.",
  model: "MET Nordic is the same model behind Yr; it only covers the Nordics.",
  accent: "Leave blank for the mode default (green for work, blue for car wash).",
  dry_roads_hours:
    "No heavy rain this long before the wash, so you are not driving a clean car on wet roads.",
};

@customElement("outdoor-work-card-editor")
export class OutdoorWorkCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HassLike;
  @state() private _config?: CardConfig;

  static styles = css`
    .note {
      font-size: 12px;
      color: var(--secondary-text-color);
      margin: 8px 2px 0;
      line-height: 1.45;
    }
    code {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 11px;
    }
  `;

  public setConfig(config: CardConfig): void {
    this._config = { ...config };
  }

  private get _schema(): Schema {
    const mode = this._config?.mode === "carwash" ? "carwash" : "work";
    return [...COMMON, ...(mode === "carwash" ? WASH : WORK)];
  }

  private _computeLabel = (s: { name: string }) => LABELS[s.name] ?? s.name;
  private _computeHelper = (s: { name: string }) => HELPERS[s.name] ?? "";

  private _changed(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = { ...ev.detail?.value } as Record<string, unknown>;
    // Drop empty strings so defaults apply.
    for (const k of Object.keys(value)) {
      if (value[k] === "" || value[k] === null) delete value[k];
    }
    const next = {
      ...this._config,
      ...value,
      type: this._config?.type ?? "custom:outdoor-work-card",
    } as CardConfig;
    // Keep only the keys of the active mode + common ones tidy.
    this._config = next;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: next },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const data = { mode: "work", ...this._config } as Record<string, unknown>;
    const isWork = data.mode !== "carwash";
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${data}
        .schema=${this._schema}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._changed}
      ></ha-form>
      ${
        isWork
          ? html`<div class="note">
              Activities default to <code>Mow</code> (24 h dry before) and <code>Paint</code> (24 h
              before, 24 h after). Add or change them in YAML with <code>tasks:</code> — e.g.
              <code>- name: Stain&nbsp;deck, before: 48, after: 12</code>.
            </div>`
          : nothing
      }
      <div class="note">
        The card fetches Open-Meteo directly from the browser — no sensors or helpers needed.
        Location defaults to your home.
      </div>
    `;
  }
}
