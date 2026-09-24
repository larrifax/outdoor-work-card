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
import {
  planCommute,
  DANGER_RAIN,
  DANGER_WIND,
  GUST_FACTOR,
  type CommuteResult,
  type CommuteDay,
  type CommuteWindow,
  type HourCell,
} from "./commute";
import { hm, durLabel, hLabel, localParts } from "./time";
import { icons, taskIcon } from "./icons";
import { strings, type Strings, type Seg } from "./i18n";
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
  @state() private _infoOpen = false;

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
    return this._config?.mode === "carwash" ? 7 : this._config?.mode === "commute" ? 9 : 8;
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
    document.removeEventListener("click", this._onDocClick);
    document.removeEventListener("keydown", this._onKey);
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has("hass") && !this._weather && !this._loading) this._maybeLoad(false);
    if (changed.has("_infoOpen")) {
      if (this._infoOpen) {
        document.addEventListener("click", this._onDocClick);
        document.addEventListener("keydown", this._onKey);
      } else {
        document.removeEventListener("click", this._onDocClick);
        document.removeEventListener("keydown", this._onKey);
      }
    }
  }

  private _toggleInfo = (e: Event) => {
    e.stopPropagation();
    this._infoOpen = !this._infoOpen;
  };
  private _closeInfo = () => {
    this._infoOpen = false;
  };
  private _onDocClick = (e: Event) => {
    if (!e.composedPath().includes(this)) this._closeInfo();
  };
  private _onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") this._closeInfo();
  };

  private _onVisible = () => {
    if (document.visibilityState === "visible") this._maybeLoad(false);
  };

  private get _r(): Resolved | undefined {
    return this._config ? resolve(this._config, this.hass) : undefined;
  }

  private _maybeLoad(force: boolean): void {
    const r = this._r;
    if (!r || !this.isConnected) return;
    // Commute mode walks up to three weeks of workdays, so it always fetches the full 16-day horizon.
    const forecastDays = r.mode === "commute" ? 16 : Math.min(16, r.days + 4);
    const key = `${r.lat},${r.lon},${r.model},${forecastDays}`;
    const stale = !this._weather || Date.now() - this._weather.fetchedAt > r.refreshMs;
    if (!force && !stale && key === this._lastKey) return;
    this._lastKey = key;
    this._loading = true;
    getWeather({
      lat: r.lat,
      lon: r.lon,
      model: r.model,
      pastDays: 3,
      forecastDays,
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
    const t = strings(r.lang);
    const hostStyle = { "--owc-accent": r.accent };
    const badge =
      r.mode === "carwash"
        ? icons.car(22)
        : r.mode === "commute"
          ? icons.bike(22)
          : icons.wrench(20);
    const popHead =
      r.mode === "carwash"
        ? t.popHeadWash
        : r.mode === "commute"
          ? t.popHeadCommute
          : t.popHeadWork;

    return html`
      <ha-card style=${styleMap(hostStyle)}>
        <div class="head">
          <div class="badge">${badge}</div>
          <div class="titles">
            <div class="title">${r.title}</div>
            <div class="sub">${r.subtitle}</div>
          </div>
          <div class="prov">
            ${
              this._weather
                ? html`<span class="ts"
                    >${this._loading ? t.updating : hm(this._weather.fetchedAt, r.tz)}</span
                  >`
                : nothing
            }
            <button
              class="qbtn"
              type="button"
              aria-label=${popHead}
              aria-expanded=${this._infoOpen}
              aria-controls="owc-pop"
              @click=${this._toggleInfo}
            >
              ${icons.question(15)}
            </button>
            ${
              this._infoOpen
                ? html`<div id="owc-pop" class="pop" role="dialog" aria-label=${popHead}>
                    ${this._renderRules(r, t)}
                  </div>`
                : nothing
            }
          </div>
        </div>
        ${
          this._error
            ? html`<div class="state err">
                ${icons.alert(16)}
                <div>${t.loadErr} <code>${this._error}</code></div>
              </div>`
            : !this._weather
              ? html`<div class="state">
                  ${icons.info(16)}
                  <div>${t.fetching(r.lat.toFixed(2), r.lon.toFixed(2))}</div>
                </div>`
              : r.mode === "carwash"
                ? this._renderWash(r, t)
                : r.mode === "commute"
                  ? this._renderCommute(r, t)
                  : this._renderWork(r, t)
        }
      </ha-card>
    `;
  }

  // ---- info popover (design F) --------------------------------------------

  private _renderRules(r: Resolved, t: Strings): TemplateResult {
    const model = r.model === "metno_seamless" ? "MET Nordic 1 km" : r.model;
    const mono = (s: string) => html`<span class="mono">${s}</span>`;

    if (r.mode === "commute") return this._renderCommuteRules(r, t, model);

    let head: string;
    let rows: TemplateResult[];
    if (r.mode === "carwash") {
      head = t.popHeadWash;
      rows = [
        this._ruleRow(t.popWashFrom, mono(fmtMin(r.washStart))),
        this._ruleRow(t.popHarmlessDay, mono(t.popUpTo(r.okRain))),
        this._ruleRow(
          t.popHarmlessNight,
          mono(t.popNightVal(r.nightMax, fmtMin(r.nightFrom), fmtMin(r.nightUntil))),
        ),
        this._ruleRow(t.popRoadsDry, mono(t.popHours(r.leadHours))),
      ];
    } else {
      head = t.popHeadWork;
      const end =
        typeof r.windowEnd === "number"
          ? fmtMin(r.windowEnd)
          : r.windowEnd === "sunset"
            ? t.sunset
            : t.dusk;
      rows = [
        this._ruleRow(t.popWeekdayWin, html`${mono(fmtMin(r.weekdayStart))} → ${mono(end)}`),
        this._ruleRow(t.popWeekendWin, html`${mono(fmtMin(r.weekendStart))} → ${mono(end)}`),
        this._ruleRow(t.popIgnoreUnder, mono(t.popMinutes(r.minWindowMinutes))),
        this._ruleRow(t.popCountsRain, mono(t.popAboveRate(r.rainThreshold))),
        ...r.tasks.map((task) =>
          this._ruleRow(
            task.name,
            task.after === undefined
              ? mono(t.popDryBefore(task.before))
              : mono(t.popDryBeforeAfter(task.before, task.after)),
          ),
        ),
      ];
    }

    return html`
      <div class="h">${head}</div>
      <div class="grid">${rows}</div>
      <div class="src">${t.popSrc(model)}</div>
    `;
  }

  private _ruleRow(label: string, value: TemplateResult): TemplateResult {
    return html`<span class="k">${label}</span><span class="v">${value}</span>`;
  }

  // ---- commute popover ----------------------------------------------------

  private _renderCommuteRules(r: Resolved, t: Strings, model: string): TemplateResult {
    return html`
      <div class="h">${t.popCommuteTile}</div>
      <div class="grid">
        <span class="k"
          ><span class="val" style="display:flex;align-items:center;gap:4px"
            >${icons.drop(11)}<span class="mono">0.4</span></span
          ></span
        ><span class="v">${t.popRainUnit}</span>
        <span class="k"
          ><span style="display:flex;align-items:center;gap:4px"
            >${icons.wind(12)}<span class="mono">9</span></span
          ></span
        ><span class="v">${t.popWindUnit}</span>
      </div>
      <div class="note">${t.popTileNote} ${t.popEffWind(Math.round(GUST_FACTOR * 100))}</div>
      <div class="h">${t.popScales}</div>
      <div class="scale">
        <span></span><span class="c0">${t.popFine}</span><span class="c1">${t.popTolerable}</span
        ><span class="c2">${t.popBad}</span><span class="c3">${t.popDanger}</span>
        <span class="k">${icons.drop(11)}${t.popRainLabel}</span
        ><span class="mono">≤ ${r.rainFine}</span><span class="mono">≤ ${r.rainOk}</span
        ><span class="mono">&gt; ${r.rainOk}</span><span class="mono">&gt; ${DANGER_RAIN}</span>
        <span class="k">${icons.wind(12)}${t.popWindLabel}</span
        ><span class="mono">≤ ${r.windFine}</span><span class="mono">≤ ${r.windOk}</span
        ><span class="mono">&gt; ${r.windOk}</span><span class="mono">&gt; ${DANGER_WIND}</span>
      </div>
      <div class="note">${t.popDangerLine(DANGER_RAIN, DANGER_WIND)}</div>
      <div class="h">${t.popDayGrade}</div>
      <div class="grades">
        <span class="gb" style="background:var(--owc-accent)">A</span><span>${t.popGradeA}</span>
        <span class="gb" style="background:var(--owc-accent)">B</span><span>${t.popGradeB}</span>
        <span class="gb" style="background:var(--owc-amber)">C</span><span>${t.popGradeC}</span>
        <span class="gb" style="background:var(--owc-red)">D</span><span>${t.popGradeD}</span>
        <span class="gb" style="background:var(--owc-red)">E</span><span>${t.popGradeE}</span>
        <span class="gb f">F</span><span>${t.popGradeF}</span>
      </div>
      <div class="note">
        ${t.popCommuteNote(
          fmtMin(r.toWork[0]),
          fmtMin(r.toWork[1]),
          fmtMin(r.home[0]),
          fmtMin(r.home[1]),
        )}
        ${t.popMidday} ${t.popWinter}
      </div>
      <div class="src">${t.popSrc(model)}</div>
    `;
  }

  // ---- commute mode -------------------------------------------------------

  private _renderCommute(r: Resolved, t: Strings): TemplateResult {
    const res: CommuteResult = planCommute(this._weather!.hours, Date.now(), {
      tz: r.tz,
      toWork: r.toWork,
      home: r.home,
      midday: r.midday,
      rainFine: r.rainFine,
      rainOk: r.rainOk,
      windFine: r.windFine,
      windOk: r.windOk,
      workdays: r.workdays,
      days: 5,
      names: { short: r.names.short, full: r.names.full },
      today: t.cToday,
      tomorrow: t.cTomorrow,
      phrases: {
        rain: t.cRain,
        lightRain: t.cLightRain,
        strongWind: t.cStrongWind,
        breezy: t.cBreezy,
        cloudburst: t.cCloudburst,
        dangerousGusts: t.cDangerousGusts,
        toWork: t.cToWork,
        home: t.cHome,
        and: t.cAnd,
        sep: t.cSep,
        dryCalm: t.cDryCalm,
        middayFlag: t.cMiddayFlag,
        noData: t.cNoData,
      },
    });
    const first = res.days[0];
    if (!first)
      return html`<div class="state">
        ${icons.info(16)}
        <div>${t.cNoDays}</div>
      </div>`;
    const L = first.light;
    const isF = first.grade === "F";
    const caption = isF ? t.cCaptionF : t.cCaption[L];
    const verdict = isF ? t.cVerdictF : t.cVerdict[L];
    const why = first.reason.charAt(0).toUpperCase() + first.reason.slice(1);

    return html`
      <div class=${classMap({ chero: true, [`l${L}`]: true, f: isF })}>
        <div class=${classMap({ gbadge: true, [`l${L}`]: true, f: isF })}>${first.grade}</div>
        <div>
          <div class="cap">${caption}</div>
          <div class="t">${first.full} · ${verdict}</div>
          <div class="d">${why}</div>
        </div>
      </div>

      <div class="cgrid ccols">
        <span>${t.cColDay}</span><span class="c">${t.cColGrade}</span>
        <span class="c"
          >${t.cColToWork(fmtMin(r.toWork[0]).slice(0, 2), fmtMin(r.toWork[1]).slice(0, 2))}</span
        >
        <span class="c dim">${t.cColMidday}</span>
        <span class="c"
          >${t.cColHome(fmtMin(r.home[0]).slice(0, 2), fmtMin(r.home[1]).slice(0, 2))}</span
        >
      </div>
      <div class="crows">
        ${res.days.map(
          (d) => html`
            ${
              d.newWeek
                ? html`<div class="wk">
                    <div class="ln"></div>
                    <span>${t.cNextWeek}</span>
                    <div class="ln"></div>
                  </div>`
                : nothing
            }
            ${this._commuteRow(d, t)}
          `,
        )}
      </div>
    `;
  }

  private _commuteRow(d: CommuteDay, t: Strings): TemplateResult {
    return html`
      <div class=${classMap({ cgrid: true, crow: true, today: d.isToday, far: d.far })}>
        <div class="cell l">
          <span class="dn">${d.short}</span><span class="dd">${d.dom}</span>
          ${d.far ? html`<span class="nt">${t.cOutlook}</span>` : nothing}
        </div>
        <div
          class=${classMap({
            gbadge: true,
            [`l${d.light}`]: !d.unknown,
            f: !d.unknown && d.grade === "F",
            unknown: d.unknown,
          })}
          title=${d.reason}
        >
          ${d.unknown ? "?" : d.grade}
        </div>
        ${this._tiles(d.toWork, t)}
        <div class=${classMap({ mid: true, flag: d.midday.flag })} title=${d.reason}>
          <span class="val"
            ><span class="ic${d.midday.rain}">${icons.drop(10)}</span
            >${d.midday.mm.toFixed(1)}</span
          >
          <span class="val tot">Σ ${d.midday.total.toFixed(1)}</span>
        </div>
        ${this._tiles(d.home, t)}
      </div>
    `;
  }

  private _tiles(w: CommuteWindow, t: Strings): TemplateResult {
    return html`
      <div class="tiles">
        ${w.cells.map(
          (c: HourCell) => html`
            <div
              class=${classMap({ tile: true, [`l${c.level}`]: true, passed: c.passed, missing: c.missing })}
              tabindex=${c.missing ? nothing : 0}
              style=${styleMap({ "anchor-name": `--owc-h-${c.t}` })}
              @pointerenter=${c.missing ? nothing : this._showTip}
              @pointerleave=${c.missing ? nothing : this._hideTip}
              @focus=${c.missing ? nothing : this._showTip}
              @blur=${c.missing ? nothing : this._hideTip}
            >
              <span class="hh">${c.level === 3 ? icons.alert(9) : nothing}${c.label}</span>
              ${
                c.missing
                  ? html`<span class="val">—</span>`
                  : html`
                      <span class="val"
                        ><span class="ic${c.rain}">${icons.drop(10)}</span>${c.mm.toFixed(1)}</span
                      >
                      <span class="val"
                        ><span class="ic${c.windLevel}">${icons.wind(11)}</span
                        >${Math.round(c.eff)}</span
                      >
                      <span
                        class="tip"
                        popover="hint"
                        style=${styleMap({ "position-anchor": `--owc-h-${c.t}` })}
                        >${t.cTileHint(
                          c.label,
                          c.mm.toFixed(1),
                          String(Math.round(c.eff)),
                          String(Math.round(c.wind)),
                          String(Math.round(c.gust)),
                        )}</span
                      >
                    `
              }
            </div>
          `,
        )}
      </div>
    `;
  }

  // ---- work mode ----------------------------------------------------------

  private _renderWork(r: Resolved, t: Strings): TemplateResult {
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
      names: r.names,
    });
    const anyTonight = res.tonightOk.length > 0;
    const allTonight = res.tonightOk.length === r.tasks.length;
    const heroCls = anyTonight ? "ok" : "warn";
    const today = res.days[0];
    let verdict: string;
    if (allTonight) verdict = t.goTonight;
    else if (anyTonight)
      verdict = t.goTonightOnly(
        res.tonightOk.map((k) => r.tasks[k]!.name.toLowerCase()).join(", "),
      );
    else if (today?.passed) verdict = t.passedToday;
    else verdict = t.notTonight;

    const when = (d: WorkDay) =>
      `${d.isToday ? t.tonight : d.full} · ${hm(d.effStart!, r.tz)}–${hm(d.end!, r.tz)}`;

    return html`
      <div class="hero ${heroCls}">
        <div class="pill"><span class="dot"></span>${verdict}</div>
        ${r.tasks.map((task, k) => {
          const v = res.tasks[k]!;
          const nd = v.nextIdx >= 0 ? res.days[v.nextIdx] : undefined;
          const ld = v.longestIdx >= 0 ? res.days[v.longestIdx] : undefined;
          const need =
            task.after === undefined
              ? t.needBefore(task.before)
              : t.needBeforeAfter(task.before, task.after);
          let detail: string;
          if (!nd) detail = t.noDayMeets;
          else {
            detail = t.dryBeforehand(hLabel(nd.before, CAP, t.hUnit));
            if (task.after !== undefined) detail += t.afterPart(hLabel(nd.after, CAP, t.hUnit));
            detail += t.ofLight(durLabel(nd.hours, t.hUnit));
            if (ld && ld !== nd) detail += t.longestPart(ld.full, durLabel(ld.hours, t.hUnit));
          }
          return html` <div class="task">
            <div class="ico ${nd ? "on" : "off"}">${taskIcon(task.name)(18)}</div>
            <div class="body">
              <div class="k">${task.name} · ${need}</div>
              <div class="v">${nd ? when(nd) : t.noWindowWeek}</div>
              <div class="d">${detail}</div>
            </div>
          </div>`;
        })}
      </div>

      <div class="grid cols">
        <span>${t.colDay}</span><span class="ra">${t.colBefore}</span><span>${t.colWindow}</span
        ><span>${t.colAfter}</span><span class="ra">${t.colGood}</span>
      </div>
      <div class="rows">${res.days.map((d) => this._workRow(d, r, t))}</div>
    `;
  }

  private _workRow(d: WorkDay, r: Resolved, t: Strings): TemplateResult {
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
    const needB = Math.max(...r.tasks.map((task) => task.before));
    const afters = r.tasks.map((task) => task.after).filter((x): x is number => x !== undefined);
    const needA = afters.length ? Math.max(...afters) : 0;
    const anyOk = d.ok.some(Boolean);
    const pct = (h: number, max: number) => `${Math.max(5, Math.min(100, (h / max) * 100))}%`;

    const winColor = d.during ? "var(--owc-red)" : anyOk ? acc : "var(--owc-dim)";
    const winLabel = d.during
      ? t.rowRain
      : d.passed
        ? t.rowPassed
        : d.hours > 0
          ? durLabel(d.hours, t.hUnit)
          : t.rowDark;

    return html` <div class="grid row ${classMap({ today: d.isToday, far: d.far })}">
      <div class="cell l"><span class="dn">${d.short}</span><span class="dd">${d.dom}</span></div>
      <div class="cell r">
        <div
          class="bar before"
          style=${styleMap({ width: pct(d.before, CAP), background: runway(d.before, needB) })}
        ></div>
        <span class="num" style=${styleMap({ color: runwayTxt(d.before, needB) })}
          >${hLabel(d.before, CAP, t.hUnit)}</span
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
          >${hLabel(d.after, CAP, t.hUnit)}</span
        >
      </div>
      <div class="pills">
        ${r.tasks.map((task, k) => html`<span class="tp ${d.ok[k] ? "on" : "off"}">${task.name}</span>`)}
      </div>
    </div>`;
  }

  // ---- car wash mode ------------------------------------------------------

  private _renderWash(r: Resolved, t: Strings): TemplateResult {
    const res: WashResult = planWash(this._weather!.hours, Date.now(), {
      tz: r.tz,
      washStart: r.washStart,
      okRain: r.okRain,
      nightMax: r.nightMax,
      nightFrom: r.nightFrom,
      nightUntil: r.nightUntil,
      days: r.days,
      leadHours: r.leadHours,
      names: r.names,
    });
    const best = res.days[res.bestIdx]!;
    const today = res.days[0]!;
    // `streak` = clean days after the wash day; -1 = the evening can't be washed at all.
    const none = best.streak < 0; // no evening in the outlook works
    const ok = !none && res.bestIdx === 0; // tonight is the pick
    const skip = !ok && !none; // banner + trade-off state
    const heroCls = ok ? "ok" : none ? "bad" : "rec";

    const washStart = fmtMin(r.washStart);
    const waitDays = res.bestIdx; // 0 = tonight
    const gain = best.streak - today.streak; // may be <= 0 only through open-ended rounding
    const describe = (d: WashDay) => t.describe(d.full, d.peakNight, d.peak.toFixed(1));
    const dayAt = (i: number) => (i >= 0 && i < res.days.length ? res.days[i] : undefined);
    const todayBreak = dayAt(res.todayBreakIdx);
    const bestBreak = dayAt(res.bestBreakIdx);

    const caption = ok ? t.capBest : skip ? t.capWashOn : t.capOutlook;
    const dayLabel = ok ? t.tonight : none ? t.dash : best.full;
    const streakLabel = none ? t.nothingClean : t.cleanDays(best.streak, best.openEnded);

    // Alert banner (skip only): why tonight is not the pick.
    let bannerText = "";
    if (skip) {
      bannerText =
        today.streak < 0
          ? t.bannerRain(washStart) // can't wash tonight at all
          : today.streak === 0
            ? todayBreak
              ? t.bannerBrief(describe(todayBreak)) // washable, but nothing lasts the day
              : t.bannerRain(washStart)
            : todayBreak
              ? t.bannerLasts(today.streak, describe(todayBreak))
              : t.bannerLastsNoBreak(today.streak);
    }

    // Context line under the recommended day.
    let contextLine: string;
    if (ok) {
      contextLine = todayBreak
        ? t.whyOkBreak(washStart, describe(todayBreak))
        : t.whyOkNoRain(washStart);
    } else if (none) {
      contextLine = t.whyNone(r.okRain);
    } else {
      contextLine =
        t.ctxSkipFrom(washStart, waitDays) +
        (bestBreak ? t.ctxStaysUntil(describe(bestBreak)) : t.ctxStaysPast);
    }

    // Trade-off line (skip only, below a hairline). undefined = omit.
    let tradeoff: TemplateResult | undefined;
    if (skip) {
      let segs: Seg[] | undefined;
      if (today.streak < 0) segs = t.tradeoffFirst(best.full);
      else if (gain >= 2) segs = t.tradeoffBuys(waitDays, gain, best.openEnded);
      else if (gain === 1) segs = t.tradeoffOnly(waitDays);
      // gain <= 0: omit (rounding of open-ended streaks).
      if (segs)
        tradeoff = html`${segs.map((s) =>
          typeof s === "string" ? s : html`<strong class=${s.gain ? "gain" : ""}>${s.b}</strong>`,
        )}`;
    }

    return html`
      ${
        skip
          ? html`<div class="alert">
              ${icons.alert(15)}
              <div><span class="lbl">${t.bannerLbl}</span> · ${bannerText}</div>
            </div>`
          : nothing
      }

      <div class="hero ${heroCls}">
        <div class="cap">${caption}</div>
        <div class="big">
          <span class="day">${dayLabel}</span><span class="n">${streakLabel}</span>
        </div>
        <div class="why">${contextLine}</div>
        ${
          tradeoff
            ? html`<div class="tradeoff">${icons.arrow(16)}<span>${tradeoff}</span></div>`
            : nothing
        }
      </div>

      <div class="sect">${t.sectAsk}</div>
      <div class="strip d${r.days}">
        ${res.days.map((d, i) => this._washCol(d, i === res.bestIdx && d.streak >= 0, t, i))}
      </div>
    `;
  }

  private _tipTimer?: ReturnType<typeof setTimeout>;
  private _skipTimer?: ReturnType<typeof setTimeout>;
  private _tipSkip = false;

  private _showTip = (e: Event) => {
    const tip = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".tip");
    clearTimeout(this._tipTimer);
    clearTimeout(this._skipTimer);
    this._tipTimer = setTimeout(() => tip?.togglePopover(true), this._tipSkip ? 0 : 600);
  };

  private _hideTip = (e: Event) => {
    clearTimeout(this._tipTimer);
    (e.currentTarget as HTMLElement).querySelector<HTMLElement>(".tip")?.togglePopover(false);
    this._tipSkip = true;
    this._skipTimer = setTimeout(() => (this._tipSkip = false), 300);
  };

  private _washCol(d: WashDay, isBest: boolean, t: Strings, i: number): TemplateResult {
    const tag = d.isToday && isBest ? t.tagTonight : isBest ? t.tagBest : d.isToday ? t.tagNow : "";
    const mm = d.peak <= 0.05 ? t.dry : t.mm(d.peak.toFixed(1));
    const kind =
      d.peak <= 0.05 ? "clear" : d.clearsBeforeWash ? "earlier" : d.peakNight ? "night" : "daytime";
    const when = {
      clear: t.whenClear,
      earlier: t.whenEarlier,
      night: t.whenNight,
      daytime: t.whenDaytime,
    }[kind];
    const out = d.streak < 0 ? t.dash : t.outDays(d.streak, d.openEnded);
    const r = this._r;
    const ev = d.nextRain;
    const tip =
      ev && r
        ? html`${t.outNextRain(
              r.names.full[localParts(ev.at, r.tz).wd]!,
              hm(ev.at, r.tz),
              hm(ev.at + ev.hours * 3_600_000, r.tz),
              ev.hours,
            )}
            <div class="stats">
              <div><span>${t.statTotal}</span><b>${ev.total.toFixed(1)} ${t.unitMm}</b></div>
              <div><span>${t.statPeak}</span><b>${ev.peak.toFixed(1)} ${t.unitRate}</b></div>
            </div>`
        : d.streak < 0
          ? t.outDirty
          : t.outTip(d.streak, d.openEnded);
    return html` <div class="col ${classMap({ best: isBest, far: d.far })}">
      <span class="tag">${tag}</span>
      <div class="date">
        <span class="dn">${d.short}</span>
        <span class="dd">${d.dom}</span>
      </div>
      <div
        class="day"
        tabindex="0"
        style=${styleMap({ "anchor-name": `--owc-day-${i}` })}
        @pointerenter=${this._showTip}
        @pointerleave=${this._hideTip}
        @focus=${this._showTip}
        @blur=${this._hideTip}
      >
        <div class="ic ${d.icon}">${icons[d.icon](d.icon === "drop" ? 16 : 20)}</div>
        <span class="mm ${d.tolerated ? "" : "bad"}">${mm}</span>
        <span class="when">${when}</span>
        <span class="tip" popover="hint" style=${styleMap({ "position-anchor": `--owc-day-${i}` })}
          >${t.washInfo(kind, d.peak.toFixed(1))}</span
        >
      </div>
      <div
        class="out"
        tabindex="0"
        style=${styleMap({ "anchor-name": `--owc-out-${i}` })}
        @pointerenter=${this._showTip}
        @pointerleave=${this._hideTip}
        @focus=${this._showTip}
        @blur=${this._hideTip}
      >
        <span class=${d.streak < 0 ? "none" : ""}>${out}</span>
        <span class="tip" popover="hint" style=${styleMap({ "position-anchor": `--owc-out-${i}` })}
          >${tip}</span
        >
      </div>
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
