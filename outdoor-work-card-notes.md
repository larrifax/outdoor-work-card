# Outdoor Work Card — session notes

Everything gathered while designing and building the card that isn't already visible on the design canvas (the four artboards: _Outdoor work — go tonight_, _Outdoor work — rainy week_, _Car wash — wash tonight_, _Car wash — skip today_). Written 17 Sep 2026, Europe/Oslo.

## 1. What the card is for

Two planning questions for a homeowner in a rainy climate, in one Home Assistant Lovelace card with a `mode` switch.

**Outdoor work.** Find evenings after work (from 18:00 on weekdays, from 10:00 on weekends, until it gets dark) when outdoor jobs are feasible. The prerequisite is a period of dry ground _before_ the window; some jobs additionally need it to stay dry _after_ the window. Mowing is the "dry before" archetype; painting house walls is the "dry before and after" archetype. Each day is therefore judged as a **dry runway → work window → dry runway**, and every configured activity gets a yes/no per day.

**Car wash.** Find the evening (washing from 18:00) that leaves the car clean for the most days afterwards. Rain is not binary here: light rain is harmless, overnight rain is judged gently, and heavier daytime rain is what ends the clean streak. The decision variable shown per day is _"clean days you'd get by washing this evening."_

Initial scope was visual mockup only, met.no as the weather source, and "after work until dark" with no hard 22:00 cap. It grew from there into a working card.

## 2. Design principles that emerged

The first car-wash mockup restated the same facts in four places (hero number, progress ribbon, callout chip, table). The review led to a rule that both cards now follow: **state the verdict once in the hero, put every per-day outcome in one table, keep the rule text in the footer, and remove anything that only decorates.** In particular the progress ribbons, "best window" callout boxes and any "drag the slider in Tweaks" meta-text were removed.

The single most useful addition was a **per-day outcome row** — for each candidate evening, what you'd actually get (clean days after a wash; which tasks are feasible). That turns a weather display into a planning table and lets you see e.g. that Saturday is nearly as good as Friday without the card having to say so.

Both mockup pairs became **one component with two data states**, not two designs: verdict, colours and best-day pick all derive from the numbers. That mirrors how the real card works.

Visual system on the canvas: dark HA-like dashboard, IBM Plex Sans with IBM Plex Mono for times and numbers, green accent `#34d399` for work, blue `#38bdf8` for car wash, amber `#f5b942` for "tight/half-way", red `#ef6b6b` for rain that disqualifies. The real card swaps the fixed palette for HA theme variables (section 6).

## 3. The planning model (what the numbers mean)

### Outdoor work mode

The **window** for a day opens at `weekday_start` (Mon–Fri) or `weekend_start` (Sat–Sun) and closes at **civil dusk** by default (sun 6° below the horizon), or sunset, or a fixed time. For today the start is clamped to "now"; once now is past the close the day is shown as _passed_. Windows shorter than `min_window_minutes` (default 45) are shown but never recommended. Mid-September Oslo: dusk ≈ 20:10–20:20 and drifts about 2–3 minutes earlier per day, so weekday windows are ~2h and shrinking; weekends give ~10h.

**Dry before** = hours between the end of the last hour with precipitation above `rain_threshold` (default 0.2 mm/h — any real rain wets the ground) and the window opening. **Dry after** = hours from the window closing to the start of the next such hour. Both capped at 48 h for display ("48 h+"). If no rain exists in the data, the value is "at least the data span", capped.

**Rain during** the (clamped) window disqualifies the day outright and is drawn red.

A task `{name, before, after?}` is OK on a day when the window is usable, dry-before ≥ `before`, and (if `after` is set) dry-after ≥ `after`. Defaults: `Mow` (24 h before) and `Paint` (24 h before, 24 h after); up to four tasks. The hero names each task's **next** OK evening and, if a later day offers more daylight, the **longest**.

Runway bars colour by the strictest configured requirement: green when met, amber at ≥ half, grey below.

### Car wash mode

An hour is _bad_ for a clean car when it is a **night hour** (default 22:00–06:00) with more than `night_max` (default 4 mm/h), or a **day hour** with more than `ok_rain` (default 0.5 mm/h). A day is _tolerated_ when none of its hours are bad.

The **streak from evening s** = 1 (the wash day itself, judged from wash time onward) + the number of consecutive following days that are tolerated. If the streak runs past the end of the evaluated days it is shown as `N+` ("at least N"). The card evaluates three days beyond the displayed range so streaks can extend past the visible week.

**Wet-roads lead** (`dry_roads_hours`, default 2): bad rain within this many hours before wash time rules the evening out, so you are not driving a freshly washed car on wet roads. This came out of testing: rain at 13:00 legitimately does not stop an 18:00 wash, but rain ending at 17:40 should. Days whose disqualifying rain falls entirely before wash time are labelled _earlier_ in the strip (rather than _daytime_) so a recommended "best" evening with a morning shower reads correctly.

The hero recommends the longest streak (earliest on ties) and explains what ends a wash _tonight_ — e.g. "A wash today lasts only 1 day — Thursday's daytime rain (3.2 mm/h) spoils it."

### Judgment calls worth revisiting

Dry-after is counted from the _end_ of the window, the conservative reading (paint applied at 18:00 has had extra hours before dusk). Any rain inside a window kills the whole window; for a 10-hour weekend window a 20-minute shower at 14:00 arguably leaves a usable morning, so a future version could split weekend windows into halves. The longest streak wins even if it's six days away and tonight offers two — proximity isn't weighted.

## 4. Data-source research

**Direct calls to api.met.no from a browser are officially discouraged.** MET requires a `User-Agent` identifying the client; browsers cannot set one, and MET notes Firefox drops it after CORS preflight anyway. Their fallback — an `Origin`/`Referer` with a _publicly reachable domain carrying contact info_ — is not satisfied by a Home Assistant instance on a LAN IP or private hostname. Their stated supported solution is a local CORS proxy that adds the header, plus caching. Rate limiting kicks in above ~20 requests/s. **Frost** (MET's observation API) is unusable from a browser at all, because auth headers aren't permitted in simple CORS requests.

**Open-Meteo** serves MET's own model with browser-friendly terms. `models=metno_seamless` is **MET Nordic** at 1 km (Norway, Sweden, Denmark, Finland — the model behind Yr), natively ~2.5 days, blended into ECMWF for up to 15 days. It supports `past_days` (0–92), returns hourly `precipitation` in mm per hour (= mm/h intensity directly), daily `sunrise`/`sunset`, updates hourly, needs no API key for non-commercial use, and allows CORS. **One request returns both recent rain history and the forecast**, which is what makes a self-contained card possible without a rain gauge. Hourly `timeformat=unixtime` with `timezone=UTC` avoids any browser-vs-home timezone ambiguity.

Consequences the card reflects: beyond ~60 h the hourly detail is the ECMWF blend rather than MET Nordic, so those rows/columns are drawn dimmer; and the "dry before" history is model analysis (radar- and observation-corrected for Norway), which is good for "has the lawn had a day to dry" and only approximate for "did it drizzle at my house at 14:00".

**Home Assistant alternatives considered and rejected for the self-contained goal:** the met.no integration's `weather.get_forecasts` action (hourly forecast only covers the 1-h-resolution span, ~48–60 h, and provides no history); trigger-based template sensors with `response_variable` doing the maths hourly (works, but means helpers + Jinja `namespace()` loops); a last-rain `input_datetime` stamped by an automation (forecast-as-proxy); `history_stats` on a rain gauge (best if you have one — you don't). `sun.sun` exposes only `next_dusk`/`next_setting`, not dusk for arbitrary future days, hence the in-card solar calculation.

## 5. Architecture of the built card

Three layers collapsed into one HACS "plugin" repo, Lit + TypeScript, rollup → a single `dist/outdoor-work-card.js` (~50 KB, Lit bundled, no runtime deps). Home Assistant ≥ 2024.1 in `hacs.json`.

`src/weather.ts` — Open-Meteo client. Cache keyed by lat/lon/model/days so every card on a page shares one fetch; refetch every `refresh_minutes` (default 60, min 10) and on tab visibility; `past_days=3`, `forecast_days=days+4`.

`src/time.ts` — all reasoning in **`hass.config.time_zone`**, not the browser's zone, via `Intl.DateTimeFormat.formatToParts` and a two-pass `zonedToUtc` that survives DST. `parseHM` accepts `HH:MM` and the `HH:MM:SS` that HA's time selector emits.

`src/sun.ts` — sunset (zenith 90.833°) and civil dusk (96°) for any local date via the standard sunrise equation (±2–3 min); returns `null` for midnight sun / polar night, which the work mode treats as "no window".

`src/logic.ts` — pure functions `planWork` and `planWash`, no DOM. This is where the rules in section 3 live and what the unit tests target.

`src/outdoor-work-card.ts` — the `<outdoor-work-card>` element: hero, table/strip, footer, loading and error states, hourly refresh, a 5-minute tick so "tonight" recomputes as time passes, `getCardSize`, `getGridOptions`, `window.customCards` registration.

`src/editor.ts` — `<outdoor-work-card-editor>` built on HA's `<ha-form>` with a mode-dependent schema (select, time, number selectors). Custom `tasks` are YAML-only; the editor preserves them.

`src/styles.ts` — theme-aware. Text colours come from `--primary-text-color` / `--secondary-text-color`; borders and tints are `color-mix()` of the text colour with transparency; accent/amber/red _text_ variants are mixed ~70% toward the theme text colour so they stay legible on light themes while dark themes are essentially unchanged. Bar fills and filled pills use the raw accent.

### Configuration reference

| Option                            | Default             | Notes                                   |
| --------------------------------- | ------------------- | --------------------------------------- |
| `mode`                            | `work`              | `work` or `carwash`                     |
| `title`, `subtitle`               | per mode            |                                         |
| `latitude`, `longitude`           | HA home             |                                         |
| `model`                           | `metno_seamless`    | `best_match` outside the Nordics        |
| `days`                            | 7                   | 3–10                                    |
| `refresh_minutes`                 | 60                  |                                         |
| `accent`                          | green / blue        | CSS colour                              |
| `weekday_start` / `weekend_start` | 18:00 / 10:00       | work                                    |
| `window_end`                      | `dusk`              | `sunset` or `HH:MM`                     |
| `min_window_minutes`              | 45                  |                                         |
| `rain_threshold`                  | 0.2 mm/h            | ground gets wet                         |
| `tasks`                           | Mow 24; Paint 24/24 | list of `{name, before, after?}`, max 4 |
| `wash_start`                      | 18:00               | carwash                                 |
| `ok_rain`                         | 0.5 mm/h            | harmless by day                         |
| `night_max`                       | 4 mm/h              | harmless at night                       |
| `night_from` / `night_until`      | 22:00 / 06:00       |                                         |
| `dry_roads_hours`                 | 2                   | lead before wash                        |

Minimal config is `type: custom:outdoor-work-card` plus `mode`.

## 6. Verification done, and what wasn't

Eleven `node:test` cases run against the bundled logic with a synthetic hourly series and a frozen clock (Wed 16 Sep 2026 16:00 Oslo). They cover day construction across the week, the 18:00→dusk window and 10:00 weekend start, dry-before from history, dry-after from forecast and its effect on paint, rain-in-window, the 48 h cap when no rain exists, the "passed" state after dusk, night-rain and drizzle tolerance, the threshold flipping a drizzle into a streak-breaker, the wet-roads lead, afternoon rain not forbidding an evening wash, and rain this evening blocking a wash entirely.

A Playwright harness (`test/harness.html` + `test/shoot.mjs`) renders four cards — both modes × a good week and a rainy week — with a stubbed `<ha-card>`, mocked `fetch`, and the frozen clock, in dark and light themes. Every row in the screenshots was traced back to the mock data by hand.

Bugs found and fixed along the way: Lit cannot interpolate a whole attribute list into an SVG tag (icons rendered as black blobs — attributes now written out literally); open-ended streaks displayed as an exact number; accent text nearly invisible on light themes.

**Not verified:** the visual editor inside real Home Assistant (`ha-form` only exists in the HA frontend). If the form looks odd on first open, `src/editor.ts` is the file.

## 7. Open items and possible next steps

Confirm the editor renders in HA. Add a GitHub Actions release workflow (build on tag, attach the JS) so HACS can serve versioned releases; replace `YOUR_GITHUB_USER` in the `documentationURL`. Optional `rain_sensor:` input to override model history with a real gauge on the "dry before" side. Norwegian labels. Weekend windows split into halves so a short midday shower doesn't void a whole Saturday. A proximity weight in the car-wash pick so "2 days starting tonight" can beat "4 days starting next Tuesday" when you want to. Optional HA `weather.get_forecasts` source mode for people who'd rather not call a third party (no history, so "dry before" would need a gauge or a stamped timestamp).

## 8. Deliverables produced

`outdoor-work-card.zip` — the full repo (source, build config, tests, README, LICENSE, preview images) without `node_modules`. `outdoor-work-card.js` — the built card alone, for a manual `config/www/` install. `outdoor-work-card-preview.png` — render of both modes against mocked weather. Plus the design canvas with the four artboards this document complements.
