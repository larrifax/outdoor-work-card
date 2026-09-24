/**
 * Visual config editor. Uses Home Assistant's own <ha-form> so the controls
 * (selects, time pickers, number fields) match the rest of the dashboard editor.
 * Custom `tasks` for work mode are YAML-only; the editor keeps whatever is set.
 */
import { LitElement, html, css, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { CardConfig, HassLike } from "./types";
import { pickLang, strings, dayNames, type EditorStrings, type Lang } from "./i18n";
import { resolve } from "./config";
import { matchPreset, PRESETS, type PresetId } from "./commute";

type Schema = Array<Record<string, unknown>>;

const COMMON = (e: EditorStrings, commute: boolean): Schema => [
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
      // Commute mode always shows five workdays, so "days" is hidden there.
      ...(commute
        ? []
        : [{ name: "days", selector: { number: { min: 3, max: 10, mode: "box" } } }]),
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

const COMMUTE = (e: EditorStrings, lang: Lang): Schema => [
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
    name: "preset",
    selector: {
      select: {
        mode: "dropdown",
        options: [
          { value: "fair", label: e.presetFair },
          { value: "everyday", label: e.presetEveryday },
          { value: "all", label: e.presetAll },
          { value: "custom", label: e.presetCustom },
        ],
      },
    },
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
        // ISO 1 = Mon … 7 = Sun; dayNames is indexed 0 = Sun.
        options: [1, 2, 3, 4, 5, 6, 7].map((v) => ({
          value: v,
          label: dayNames(lang).full[v % 7],
        })),
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

  private get _lang(): Lang {
    return pickLang(this.hass);
  }

  private get _schema(): Schema {
    const e = this._t;
    const mode =
      this._config?.mode === "carwash"
        ? "carwash"
        : this._config?.mode === "commute"
          ? "commute"
          : "work";
    return [
      ...COMMON(e, mode === "commute"),
      ...(mode === "carwash" ? WASH : mode === "commute" ? COMMUTE(e, this._lang) : WORK(e)),
    ];
  }

  private _computeLabel = (s: { name: string }) => this._t.labels[s.name] ?? s.name;
  private _computeHelper = (s: { name: string }) => this._t.helpers[s.name] ?? "";

  private _changed(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = { ...ev.detail?.value } as Record<string, unknown>;
    // Cleared fields: remove the key from the config too, so the default applies.
    const cleared = Object.keys(value).filter((k) => value[k] === "" || value[k] === null);
    // Rider preset is editor-only: a newly picked preset writes its four thresholds;
    // otherwise (threshold edit, or Custom) the value is ignored and recomputed on render.
    const preset = value["preset"] as PresetId | "custom" | undefined;
    delete value["preset"];
    if (preset && preset !== "custom" && preset !== this._preset(this._config)) {
      const p = PRESETS[preset];
      Object.assign(value, {
        rain_fine: p.rainFine,
        rain_ok: p.rainOk,
        wind_fine: p.windFine,
        wind_ok: p.windOk,
      });
    }
    const merged: Record<string, unknown> = { ...this._config, ...value };
    for (const k of cleared) delete merged[k];
    const next = {
      ...merged,
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

  /** Preset matching the effective (config or default) thresholds. */
  private _preset(c: CardConfig | undefined) {
    return matchPreset(resolve(c ?? { type: "" }, this.hass));
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this.hass || !this._config) return nothing;
    const e = this._t;
    const data = {
      mode: "work",
      ...this._config,
      preset: this._preset(this._config),
    } as Record<string, unknown>;
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
