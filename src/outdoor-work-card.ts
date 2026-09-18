import { LitElement, html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";

import type { CardConfig, HassLike, WeatherData } from "./types";
import { resolve, type Resolved } from "./config";
import { getWeather } from "./weather";
import {
  planWork,
  planWash,
  type WorkResult,
  type WashResult,
  type WorkDay,
  type WashDay,
} from "./logic";
import { hm, durLabel, hLabel } from "./time";
import { icons, taskIcon } from "./icons";
import { styles } from "./styles";
import "./editor";

const VERSION = "0.1.0";
const CAP = 48;

declare global {
  interface Window {
    customCards?: Array<{
      type: string;
      name: string;
      description: string;
      preview?: boolean;
      documentationURL?: string;
    }>;
  }
}

@customElement("outdoor-work-card")
export class OutdoorWorkCard extends LitElement {
  static override styles = styles;

  @property({ attribute: false }) public hass?: HassLike;

  @state() private _config?: CardConfig;
  @state() private _weather?: WeatherData;
  @state() private _error?: string;
  @state() private _loading = false;
  /** bumps every few minutes so "tonight" recomputes as time passes */
  @state() private _tick = 0;

  private _refreshTimer?: number;
  private _tickTimer?: number;
  private _lastKey = "";

  // ---- HA card API --------------------------------------------------------

  public static getConfigElement(): HTMLElement {
    return document.createElement("outdoor-work-card-editor");
  }

  public static getStubConfig(): Partial<CardConfig> {
    return { mode: "work" };
  }

  public setConfig(config: CardConfig): void {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._error = undefined;
    this._maybeLoad(true);
  }

  public getCardSize(): number {
    return this._config?.mode === "carwash" ? 7 : 8;
  }

  public getGridOptions() {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  // ---- lifecycle ----------------------------------------------------------

  override connectedCallback(): void {
    super.connectedCallback();
    this._tickTimer = window.setInterval(() => (this._tick = (this._tick + 1) % 1e6), 5 * 60_000);
    document.addEventListener("visibilitychange", this._onVisible);
    this._maybeLoad(false);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this._refreshTimer) clearTimeout(this._refreshTimer);
    if (this._tickTimer) clearInterval(this._tickTimer);
    document.removeEventListener("visibilitychange", this._onVisible);
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("hass") && !this._weather && !this._loading) this._maybeLoad(false);
  }

  private _onVisible = () => {
    if (document.visibilityState === "visible") this._maybeLoad(false);
  };

  private get _r(): Resolved | undefined {
    return this._config ? resolve(this._config, this.hass) : undefined;
  }

  private _maybeLoad(force: boolean): void {
    const r = this._r;
    if (!r || !this.isConnected) return;
    const key = `${r.lat},${r.lon},${r.model},${r.days}`;
    const stale = !this._weather || Date.now() - this._weather.fetchedAt > r.refreshMs;
    if (!force && !stale && key === this._lastKey) return;
    this._lastKey = key;
    this._loading = true;
    getWeather({
      lat: r.lat,
      lon: r.lon,
      model: r.model,
      pastDays: 3,
      forecastDays: Math.min(16, r.days + 4),
      maxAgeMs: force ? 0 : r.refreshMs,
    })
      .then((w) => {
        this._weather = w;
        this._error = undefined;
      })
      .catch((e: unknown) => {
        this._error = e instanceof Error ? e.message : String(e);
      })
      .finally(() => {
        this._loading = false;
        if (this._refreshTimer) clearTimeout(this._refreshTimer);
        this._refreshTimer = window.setTimeout(() => this._maybeLoad(false), r.refreshMs + 5_000);
      });
  }

  // ---- render -------------------------------------------------------------

  protected override render(): TemplateResult | typeof nothing {
    const r = this._r;
    if (!r) return nothing;
    void this._tick;
    const hostStyle = { "--owc-accent": r.accent };
    const badge = r.mode === "carwash" ? icons.car(22) : icons.wrench(20);

    return html`
      <ha-card style=${styleMap(hostStyle)}>
        <div class="head">
          <div class="badge">${badge}</div>
          <div class="titles">
            <div class="title">${r.title}</div>
            <div class="sub">${r.subtitle}</div>
          </div>
          ${
            this._weather
              ? html`<div class="updated">
                  ${this._loading ? "updating…" : hm(this._weather.fetchedAt, r.tz)}
                </div>`
              : nothing
          }
        </div>
        ${
          this._error
            ? html`<div class="state err">
                ${icons.alert(16)}
                <div>Couldn't load the forecast: <code>${this._error}</code></div>
              </div>`
            : !this._weather
              ? html`<div class="state">
                  ${icons.info(16)}
                  <div>
                    Fetching forecast and recent rain for ${r.lat.toFixed(2)}, ${r.lon.toFixed(2)}…
                  </div>
                </div>`
              : r.mode === "carwash"
                ? this._renderWash(r)
                : this._renderWork(r)
        }
      </ha-card>
    `;
  }

  // ---- work mode ----------------------------------------------------------

  private _renderWork(r: Resolved): TemplateResult {
    const res: WorkResult = planWork(this._weather!.hours, Date.now(), {
      tz: r.tz,
      lat: r.lat,
      lon: r.lon,
      weekdayStart: r.weekdayStart,
      weekendStart: r.weekendStart,
      windowEnd: r.windowEnd,
      minWindowMinutes: r.minWindowMinutes,
      rainThreshold: r.rainThreshold,
      tasks: r.tasks,
      days: r.days,
      cap: CAP,
    });
    const anyTonight = res.tonightOk.length > 0;
    const allTonight = res.tonightOk.length === r.tasks.length;
    const heroCls = anyTonight ? "ok" : "warn";
    const today = res.days[0];
    let verdict: string;
    if (allTonight) verdict = "Go tonight";
    else if (anyTonight)
      verdict = `Go tonight · ${res.tonightOk.map((k) => r.tasks[k]!.name.toLowerCase()).join(", ")} only`;
    else if (today?.passed) verdict = "Today's window has passed";
    else verdict = "Not tonight";

    const when = (d: WorkDay) =>
      `${d.isToday ? "Tonight" : d.full} · ${hm(d.effStart!, r.tz)}–${hm(d.end!, r.tz)}`;

    return html`
      <div class="hero ${heroCls}">
        <div class="pill"><span class="dot"></span>${verdict}</div>
        ${r.tasks.map((t, k) => {
          const v = res.tasks[k]!;
          const nd = v.nextIdx >= 0 ? res.days[v.nextIdx] : undefined;
          const ld = v.longestIdx >= 0 ? res.days[v.longestIdx] : undefined;
          const need =
            t.after === undefined
              ? `needs ${t.before} h dry before`
              : `needs ${t.before} h before · ${t.after} h after`;
          let detail: string;
          if (!nd) detail = `No day in the outlook meets that.`;
          else {
            detail = `${hLabel(nd.before, CAP)} dry beforehand`;
            if (t.after !== undefined) detail += ` · ${hLabel(nd.after, CAP)} after`;
            detail += ` · ${durLabel(nd.hours)} of light`;
            if (ld && ld !== nd) detail += ` · longest: ${ld.full} (${durLabel(ld.hours)})`;
          }
          return html` <div class="task">
            <div class="ico ${nd ? "on" : "off"}">${taskIcon(t.name)(18)}</div>
            <div class="body">
              <div class="k">${t.name} · ${need}</div>
              <div class="v">${nd ? when(nd) : "No window this week"}</div>
              <div class="d">${detail}</div>
            </div>
          </div>`;
        })}
      </div>

      <div class="grid cols">
        <span>Day</span><span class="ra">Dry before</span><span>Window</span><span>Dry after</span
        ><span class="ra">Good for</span>
      </div>
      <div class="rows">${res.days.map((d) => this._workRow(d, r))}</div>

      <div class="foot">
        ${icons.info(14)}
        <span>
          Windows open ${fmtMin(r.weekdayStart)} on weekdays and ${fmtMin(r.weekendStart)} on
          weekends and run until
          ${typeof r.windowEnd === "number" ? fmtMin(r.windowEnd) : r.windowEnd}.
          ${r.tasks.map((t) => `${t.name}: ${t.before} h dry before${t.after !== undefined ? ` and ${t.after} h after` : ""}`).join("; ")}.
          Rain above ${r.rainThreshold} mm/h counts. Bars cap at ${CAP} h. Data: Open-Meteo
          (${r.model}).
        </span>
      </div>
    `;
  }

  private _workRow(d: WorkDay, r: Resolved): TemplateResult {
    const acc = r.accent;
    const runway = (h: number, need: number) =>
      h >= need ? acc : h >= need / 2 ? "var(--owc-amber)" : "var(--owc-dim)";
    const runwayTxt = (h: number, need: number) =>
      h >= need
        ? "var(--owc-accent-text)"
        : h >= need / 2
          ? "var(--owc-amber-text)"
          : "var(--owc-text-2)";
    // Threshold used for colouring the runway bars = the strictest configured task need.
    const needB = Math.max(...r.tasks.map((t) => t.before));
    const afters = r.tasks.map((t) => t.after).filter((x): x is number => x !== undefined);
    const needA = afters.length ? Math.max(...afters) : 0;
    const anyOk = d.ok.some(Boolean);
    const pct = (h: number, max: number) => `${Math.max(5, Math.min(100, (h / max) * 100))}%`;

    const winColor = d.during ? "var(--owc-red)" : anyOk ? acc : "var(--owc-dim)";
    const winLabel = d.during
      ? "rain"
      : d.passed
        ? "passed"
        : d.hours > 0
          ? durLabel(d.hours)
          : "dark";

    return html` <div class="grid row ${classMap({ today: d.isToday, far: d.far })}">
      <div class="cell l"><span class="dn">${d.short}</span><span class="dd">${d.dom}</span></div>
      <div class="cell r">
        <div
          class="bar before"
          style=${styleMap({ width: pct(d.before, CAP), background: runway(d.before, needB) })}
        ></div>
        <span class="num" style=${styleMap({ color: runwayTxt(d.before, needB) })}
          >${hLabel(d.before, CAP)}</span
        >
      </div>
      <div class="cell l">
        <div class="bar" style=${styleMap({ width: pct(d.hours, 10), background: winColor })}></div>
        <span
          class="num"
          style=${styleMap({ color: d.during ? "var(--owc-red-text)" : "var(--owc-text)" })}
          >${winLabel}</span
        >
      </div>
      <div class="cell l">
        <div
          class="bar after"
          style=${styleMap({ width: pct(d.after, CAP), background: needA ? runway(d.after, needA) : "var(--owc-dim)" })}
        ></div>
        <span
          class="num"
          style=${styleMap({ color: needA ? runwayTxt(d.after, needA) : "var(--owc-text-2)" })}
          >${hLabel(d.after, CAP)}</span
        >
      </div>
      <div class="pills">
        ${r.tasks.map((t, k) => html`<span class="tp ${d.ok[k] ? "on" : "off"}">${t.name}</span>`)}
      </div>
    </div>`;
  }

  // ---- car wash mode ------------------------------------------------------

  private _renderWash(r: Resolved): TemplateResult {
    const res: WashResult = planWash(this._weather!.hours, Date.now(), {
      tz: r.tz,
      washStart: r.washStart,
      okRain: r.okRain,
      nightMax: r.nightMax,
      nightFrom: r.nightFrom,
      nightUntil: r.nightUntil,
      days: r.days,
      leadHours: r.leadHours,
    });
    const best = res.days[res.bestIdx]!;
    const today = res.days[0]!;
    const ok = res.bestIdx === 0 && best.streak > 0;
    const none = best.streak === 0;
    const heroCls = ok ? "ok" : none ? "bad" : "bad";
    const verdict = ok ? "Wash tonight" : none ? "No good evening in sight" : "Skip today";
    const dayLabel = ok ? "Tonight" : none ? "—" : best.full;
    const n = best.streak;
    const streakLabel = none
      ? "nothing stays clean"
      : `${n}${best.openEnded ? "+" : ""} clean ${n === 1 && !best.openEnded ? "day" : "days"}`;

    let why: string;
    const brk = res.todayBreakIdx >= 0 ? (res.days[res.todayBreakIdx] ?? undefined) : undefined;
    const describe = (d: WashDay) =>
      `${d.full}'s ${d.peakNight ? "night" : "daytime"} rain (${d.peak.toFixed(1)} mm/h)`;
    if (ok) {
      why = brk
        ? `Dry from ${fmtMin(r.washStart)} tonight. Stays clean until ${describe(brk)}.`
        : `Dry from ${fmtMin(r.washStart)} tonight, and no spoiling rain in the whole outlook.`;
    } else if (none) {
      why = `Every evening in the outlook is followed by rain above ${r.okRain} mm/h within a day.`;
    } else {
      const head =
        today.streak === 0
          ? `Rain tonight rules out washing today`
          : `A wash today lasts only ${today.streak} ${today.streak === 1 ? "day" : "days"}`;
      why = `${head}${brk ? ` — ${describe(brk)} spoils it.` : "."}`;
    }

    return html`
      <div class="hero ${heroCls}">
        <div class="pill"><span class="dot"></span>${verdict}</div>
        <div class="big">
          <span class="day">${dayLabel}</span><span class="n">${streakLabel}</span>
        </div>
        <div class="why">${why}</div>
      </div>

      <div class="sect">
        <span class="l">Wash which evening?</span
        ><span class="r">bottom row: clean days after</span>
      </div>
      <div class="strip d${r.days}">
        ${res.days.map((d, i) => this._washCol(d, i === res.bestIdx && d.streak > 0))}
      </div>

      <div class="foot">
        ${icons.info(14)}
        <span>
          Washing from ${fmtMin(r.washStart)}. Rain up to ${r.okRain} mm/h is fine; heavier daytime
          rain ends the clean streak. Night (${fmtMin(r.nightFrom)}–${fmtMin(r.nightUntil)})
          tolerates up to ${r.nightMax} mm/h. Data: Open-Meteo (${r.model}).
        </span>
      </div>
    `;
  }

  private _washCol(d: WashDay, isBest: boolean): TemplateResult {
    const tag = d.isToday && isBest ? "Tonight" : isBest ? "Best" : d.isToday ? "Now" : "";
    const mm = d.peak <= 0.05 ? "dry" : `${d.peak.toFixed(1)} mm`;
    const when =
      d.peak <= 0.05 ? "clear" : d.clearsBeforeWash ? "earlier" : d.peakNight ? "night" : "daytime";
    const out = d.streak === 0 ? "—" : `${d.streak}${d.openEnded ? "+" : ""} d`;
    return html` <div class="col ${classMap({ best: isBest, far: d.far })}">
      <span class="tag">${tag}</span>
      <span class="dn">${d.short}</span>
      <span class="dd">${d.dom}</span>
      <div class="ic ${d.icon}">${icons[d.icon](d.icon === "drop" ? 16 : 20)}</div>
      <span class="mm ${d.tolerated ? "" : "bad"}">${mm}</span>
      <span class="when">${when}</span>
      <div class="out"><span class=${d.streak === 0 ? "none" : ""}>${out}</span></div>
    </div>`;
  }
}

function fmtMin(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: "outdoor-work-card",
  name: "Outdoor Work Card",
  description:
    "Dry windows for mowing, painting and other outdoor work — and the best evening to wash the car. Self-contained (Open-Meteo).",
  preview: true,
  documentationURL: "https://github.com/YOUR_GITHUB_USER/outdoor-work-card",
});

// eslint-disable-next-line no-console
console.info(
  `%c OUTDOOR-WORK-CARD %c v${VERSION} `,
  "color:#0d1117;background:#34d399;font-weight:700",
  "color:#34d399;background:#0d1117",
);
