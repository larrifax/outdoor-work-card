/**
 * Visual config editor. Uses Home Assistant's own <ha-form> so the controls
 * (selects, time pickers, number fields) match the rest of the dashboard editor.
 * Custom `tasks` for work mode are YAML-only; the editor keeps whatever is set.
 */
import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CardConfig, HassLike } from "./types";
import { pickLang, strings, type EditorStrings } from "./i18n";

type Schema = Array<Record<string, unknown>>;

const COMMON = (e: EditorStrings): Schema => [
  {
    name: "mode",
    selector: {
      select: {
        mode: "list",
        options: [
          { value: "work", label: e.modeWork },
          { value: "carwash", label: e.modeWash },
          { value: "commute", label: e.modeCommute },
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
    title: e.locationSource,
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
              { value: "metno_seamless", label: e.modelMetno },
              { value: "best_match", label: e.modelBest },
              { value: "ecmwf_ifs025", label: e.modelEcmwf },
            ],
          },
        },
      },
      { name: "accent", selector: { text: {} } },
    ],
  },
];

const WORK = (e: EditorStrings): Schema => [
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
              { value: "dusk", label: e.winDusk },
              { value: "sunset", label: e.winSunset },
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

const COMMUTE: Schema = [
  {
    type: "grid",
    name: "",
    schema: [
      { name: "to_work_start", selector: { time: {} } },
      { name: "to_work_end", selector: { time: {} } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "home_start", selector: { time: {} } },
      { name: "home_end", selector: { time: {} } },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "rain_fine",
        selector: {
          number: { min: 0, max: 5, step: 0.1, mode: "box", unit_of_measurement: "mm/h" },
        },
      },
      {
        name: "rain_ok",
        selector: {
          number: { min: 0, max: 10, step: 0.1, mode: "box", unit_of_measurement: "mm/h" },
        },
      },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "wind_fine",
        selector: { number: { min: 0, max: 20, step: 1, mode: "box", unit_of_measurement: "m/s" } },
      },
      {
        name: "wind_ok",
        selector: { number: { min: 0, max: 30, step: 1, mode: "box", unit_of_measurement: "m/s" } },
      },
    ],
  },
  {
    name: "workdays",
    selector: {
      select: {
        multiple: true,
        mode: "list",
        options: [
          { value: 1, label: "Monday" },
          { value: 2, label: "Tuesday" },
          { value: 3, label: "Wednesday" },
          { value: 4, label: "Thursday" },
          { value: 5, label: "Friday" },
          { value: 6, label: "Saturday" },
          { value: 7, label: "Sunday" },
        ],
      },
    },
  },
];

@customElement("outdoor-work-card-editor")
export class OutdoorWorkCardEditor extends LitElement {
  @property({ attribute: false }) public hass?: HassLike;
  @state() private _config?: CardConfig;

  static override styles = css`
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

  private get _t() {
    return strings(pickLang(this.hass)).ed;
  }

  private get _schema(): Schema {
    const e = this._t;
    const mode =
      this._config?.mode === "carwash"
        ? "carwash"
        : this._config?.mode === "commute"
          ? "commute"
          : "work";
    return [...COMMON(e), ...(mode === "carwash" ? WASH : mode === "commute" ? COMMUTE : WORK(e))];
  }

  private _computeLabel = (s: { name: string }) => this._t.labels[s.name] ?? s.name;
  private _computeHelper = (s: { name: string }) => this._t.helpers[s.name] ?? "";

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

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const e = this._t;
    const data = { mode: "work", ...this._config } as Record<string, unknown>;
    const isWork = data["mode"] !== "carwash" && data["mode"] !== "commute";
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
              ${e.noteTasks1}<code>Mow</code>${e.noteTasks2}<code>Paint</code>${e.noteTasks3}
            </div>`
          : nothing
      }
      <div class="note">${e.noteFetch}</div>
    `;
  }
}
