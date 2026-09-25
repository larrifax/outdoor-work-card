# Spec: winter — commute snowfall grading, slippery-roads marker, carwash road salt

Status: ready-for-agent

Depends on: `docs/commute-grading-spec.md` and, for the road-salt section, `docs/carwash-roads-spec.md`. Implement those first. This one builds on its hour levels 0–3, grade A–F, effective wind, tile hints and midday flag.

## Problem Statement

The commute card treats snow as rain. Open-Meteo's `precipitation` includes snow as water equivalent, so 0.4 mm/h of snowfall (about 0.6 cm/h of snow on the lane) grades like light rain. On a bike that hour is much worse.

The card also can't warn about slippery roads. The dangerous mornings for a commuter still on summer tyres are the ones after a wet evening and a cold night. The air may be +4 °C at 08:00 while the road surface is still icy. Today such a morning gets an A. Once winter tyres are on, those mornings are fine and a warning would only be noise.

## Solution

- Snowfall gets its own scale in cm/h, with fixed thresholds. The hour's precipitation level is the worse of rain and snow, so heavy snow can make a day D/E or F. Tiles show a snowflake and cm when snow dominates, and a drop and mm otherwise.
- A **slippery-roads marker** appears on commute hours where a wet road, a cold night and a still-cool morning coincide. It is informational only: a snowflake badge, a reason-line fragment and a hint line. It never changes the grade.
- The marker only appears while the rider is on **summer tyres**. By default the card guesses this from the recent weather. Riders can instead point the card at a Home Assistant entity they flip when they change tyres.
- The midday flag also fires on bad midday snow.
- The info popover explains snow grading, the marker rule and the tyre setting. The placeholder line "Snow and ice are not assessed yet" from the grading spec is removed.

## User Stories

1. As a commuter, I want snowfall graded on its own scale, so that a snowy hour is not treated as light rain.
2. As a commuter, I want snow thresholds in cm/h, so that the numbers match what I see on the ground.
3. As a commuter, I want heavy snowfall to count as dangerous, so that a snowstorm gives grade F.
4. As an all-weather commuter, I want snow thresholds fixed whatever my rain and wind preset is, so that a lenient preset never hides a snowstorm.
5. As a commuter, I want a sleet hour graded by whichever of its rain and snow is worse, so that mixed precipitation isn't underrated.
6. As a commuter, I want the tile to show a snowflake and cm when snow dominates, so that I can see at a glance why the hour is graded as it is.
7. As a commuter, I want the reason line to name snow ("light snow to work", "heavy snow home"), so that I know what to prepare for.
8. As a commuter, I want the tile hint to show the temperature, so that I can judge snow, sleet and ice risk myself.
9. As a commuter on summer tyres, I want a marker on commute hours where the road may be icy, so that I can decide to take the bus or ride carefully.
10. As a commuter, I want the marker to show when it rained the evening before a night at or below +2 °C, even if it's +4 °C at 08:00, so that the typical black-ice morning is caught.
11. As a commuter, I want the marker not to change the grade, so that a heuristic can't overrule the forecast verdict.
12. As a commuter, I want the reason line to say "icy roads possible to work/home", so that I notice the marker in the hero.
13. As a commuter on winter tyres, I want no slippery-roads markers, so that winter mornings aren't full of warnings I don't need.
14. As a commuter who never configures anything, I want the card to guess whether I'm on summer tyres from recent weather and snow cover, so that the marker works without setup.
15. As a commuter, I want the marker to still show on the first mornings of a cold snap after a warm spell, so that the guess doesn't switch off exactly when the risk is highest.
16. As a Home Assistant user, I want to point the card at an `input_boolean`, `switch` or `binary_sensor` for "winter tyres on", so that the marker follows my real tyre change.
17. As a Home Assistant user, I want to pick that entity in the visual editor, so that I don't need YAML.
18. As a user whose tyre entity is missing or unavailable, I want the card to fall back to its automatic guess, so that the marker keeps working.
19. As a commuter who can work from home, I want the midday flag to fire on bad midday snow as well as rain, so that I'm warned when snow may shift into the ride home.
20. As a commuter, I want the midday cell to show cm when snow dominates midday, so that it reads the same way as the tiles.
21. As a user, I want the info popover to explain the snow scale, the slippery-roads rule and the tyre setting, so that I understand when the badge appears.
22. As a Norwegian user, I want all new strings translated, so that the card stays fully localized.

## Implementation Decisions

**Weather data**

- Add hourly `snowfall` (cm), `temperature_2m` (°C) and `snow_depth` (m) to the Open-Meteo request. `metno_seamless` returns all three for the full horizon with no gaps (checked for Tromsø).
- `HourPoint` gains `snow` (cm/h), `temp` (°C) and `snowDepth` (m). Missing values: `snow` falls back to 0, `snowDepth` to 0, and `temp` to `null`. Temperature-based rules treat `null` as "not cold".
- Past days go from 3 to 7. This is still one shared fetch, and work and carwash mode don't care about the extra history (7 is needed for the tyre guess below).
- Work and carwash mode ignore the new fields.

**Rain vs snow within an hour**

- Snow water (mm) = `snow / 0.7`. This is Open-Meteo's documented conversion: 7 cm snow ≈ 10 mm water.
- Rain (mm) = `max(0, precipitation − snow water)`.
- Rain is graded on the rider's rain thresholds as in the grading spec. Snow is graded on the snow scale. The hour's precipitation level is the worse of the two, and the hour's overall level is the worse of precipitation and wind.
- **Snow dominates** when snow water > 50% of `precipitation`. In that case the tile shows a snowflake and the snowfall in cm with one decimal. Otherwise it shows a drop and mm as today.

**Snow scale (cm/h), fixed and independent of presets**

- 0 fine: no snowfall.
- 1 tolerable: > 0 and ≤ 0.5.
- 2 bad: > 0.5.
- 3 dangerous: > 3.
- These are code constants marked `ponytail:`. Upgrade path: make them configurable if riders ask.

**Slippery-roads marker (`icy`) for a commute hour**

- All three of these must hold:
  1. **Wet road:** total `precipitation` in the 12 h before the hour is > 0.1 mm, or the hour itself has snowfall.
  2. **Cold night:** the minimum `temp` from the last precipitation hour in that 12 h window up to the hour is ≤ +2 °C.
  3. **Not yet thawed:** the hour's own `temp` is ≤ +4 °C.
- The constants (12 h, 0.1 mm, +2 °C, +4 °C) are code constants marked `ponytail:`.
- It's only evaluated when `icyWatch` is true (see the tyre state below). Otherwise it's always false.
- It never changes any level or the grade.
- The cell exposes `icy` and `temp`. The window exposes `icy` if any of its cells is `icy`.

**Tyre state: whether `icyWatch` is on**

- A new `planCommute` option `icyWatch: boolean`. The card computes it, so the logic stays pure.
- **Entity override:** a new config key `winter_tyres_entity`. When it's set and the entity state is `on`, winter tyres are on and `icyWatch` is false. When it's `off`, `icyWatch` is true. When the entity is missing, `unavailable` or `unknown`, the card falls back to the automatic guess.
- **Automatic guess** (a pure function over hours, now and tz): summer tyres, so `icyWatch` true, when:
  - no hour with `temp ≤ 0 °C` in the 5 days ending at local midnight at the start of yesterday, and
  - `snowDepth` at the current hour is 0.

  The window ends before yesterday so that the first night or two of a cold snap still produce warnings. The card needs 7 past days for this.

- `HassLike` gains an optional `states` map (`Record<string, { state: string }>`). The card reads the entity from it on every render. No subscription is needed, because HA pushes a new `hass` object when states change.

**Midday**

- The midday summary also tracks peak snow (cm/h), total snow (cm), and whether snow dominates the midday total.
- The midday flag also fires when peak midday snow is > 0.5 cm/h (snow level ≥ bad). The suppression rule stays: the flag only shows on A–C days.
- The midday cell shows a snowflake and cm when snow dominates midday, and a drop and mm otherwise.

**Reason line**

- Precipitation words per window come from the worse of rain and snow. On a tie, the snow words win.
- Snow words: `light snow` (1), `snow` (2), `heavy snow` (3).
- When a window is `icy`, append the icy fragment for that leg after the weather words.

**Card UI**

- New `snowflake` icon. It's used as the precipitation icon when snow dominates, and as a corner badge on `icy` tiles. Tile colour and level are unchanged by the badge.
- Tile hint adds a temperature line: `{temp} °C`, plus `, wet earlier` when `icy`.
- Info popover: snow scale thresholds, the marker rule, the tyre state source (automatic or entity), and a line saying the marker never changes the grade. Remove the "not assessed yet" line.

**Editor**

- In the commute section, add `winter_tyres_entity` with the built-in `entity` selector, filtered to the `input_boolean`, `switch` and `binary_sensor` domains. It's optional, with a helper text explaining on/off.

**Wording (English; Norwegian Bokmål `nb` needs equivalents in the same tone)**

| Purpose                  | English                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Snow fragment, level 1   | `light snow`                                                                                                         |
| Snow fragment, level 2   | `snow`                                                                                                               |
| Snow fragment, level 3   | `heavy snow`                                                                                                         |
| Icy fragment             | `icy roads possible` (composed with the existing to-work / home templates, e.g. "icy roads possible to work")        |
| Hint temperature         | `{temp} °C`                                                                                                          |
| Hint icy suffix          | `, wet earlier`                                                                                                      |
| Popover snow line        | `Snow, cm/h: fine none · tolerable ≤ 0.5 · bad > 0.5 · dangerous > 3`                                                |
| Popover icy line         | `Snowflake badge: road may be icy on summer tyres (wet road, night ≤ +2 °C, now ≤ +4 °C). Doesn't change the grade.` |
| Popover tyres, automatic | `Summer tyres assumed: no frost in the days before yesterday and no snow on the ground`                              |
| Popover tyres, entity    | `Tyres from {entity}: {on → "winter", off → "summer"}`                                                               |
| Editor label             | `Winter tyres entity`                                                                                                |
| Editor helper            | `On = winter tyres (no icy-road badges). Leave empty to guess from recent weather.`                                  |

## Testing Decisions

- Tests use only public outputs. Same principle and seam as the grading spec: `planCommute` input hours and options in, levels, grades, flags, `icy` and reason strings out.
- The test file's `series()` helper grows optional `snow`, `temp` and `snowDepth` per hour. Default `temp` is +10 °C, so existing tests are unaffected.
- **`planCommute` cases:**
  - 0.3 cm/h snowfall gives a tolerable hour and a snowflake/cm display. 1 cm/h gives bad and D. 4 cm/h gives F even with the All-weather preset.
  - Sleet: an hour with 1.0 mm of which 0.2 cm is snow is graded by the worse of rain (≈0.71 mm) and snow (tolerable). Dominance is decided by the 50% rule.
  - Icy: rain at 20:00, 0 °C at 03:00 and +4 °C at 08:00 give `icy` at 08:00, with the grade unchanged. The same case with +5 °C at 08:00 is not icy. A night minimum of +3 °C is not icy. No precipitation in the prior 12 h is not icy. `icyWatch: false` is never icy.
  - Midday snow above 0.5 cm/h sets the flag on an A–C day. It's suppressed on D/E/F.
  - The reason line contains the snow words and the icy fragment on the right leg.
- **Tyre guess (pure function):** a frosty hour 3 days ago means winter. A frosty hour only last night means still summer. Snow depth > 0 means winter. A mild week with no snow means summer.
- **Entity override:** one card-level check if an existing seam allows it. Otherwise a small pure resolver `(stateString | undefined, autoGuess) → icyWatch`, tested directly.
- **Screenshot test:** extend the commute fixture with a snowy morning and an icy morning, both under summer tyres. Regenerate the PNGs.

## Out of Scope

- Grading snow lying on the ground (`snow_depth`) beyond the tyre guess.
- Freezing-rain detection from `weather_code`.
- Road-surface temperature, actual gritting or salting schedules (salt is inferred from frost, see the road-salt section), and local microclimate.
- Snow handling in work and carwash mode.
- Configurable snow or icy thresholds.
- A separate "studded tyres" rider preset.

## Carwash: road salt

Builds on the carwash wet-roads model. It uses the `temp` and `snowfall` fields this spec adds.

**Problem.** Salted roads spray salty slush at far lower moisture than rain-wet roads do, and salt stays on the road for days after the frost that triggered it. The wet-roads model alone lets a car be washed on a damp, salted morning.

**Rule (pure logic, in the carwash road-state walk)**

- **Salt trigger:** an hour with `temp ≤ +1 °C` and either wet roads or snowfall > 0. It marks the roads as **salted** and resets a wash-off counter to 0.
- **Salt wash-off:** each later hour adds its `precipitation` to the counter. Roads stop being salted once the counter reaches **10 mm**.
- **While salted,** the wet threshold is **0.1 mm** instead of `ok_rain`. Any measurable moisture wets the road. Drying time and night half-speed are unchanged.
- Dry salted roads do **not** make a day dirty (salt dust is out of scope).
- There is no toggle. The rule only fires after frost, so it's inert in warm climates.
- The constants (+1 °C, 10 mm, 0.1 mm) are code constants marked `ponytail:`.
- Missing `temp` (null) never triggers salt.

**Data.** Past days (7, set above) are enough warm-up for most cases. Salt triggered more than 7 days ago with little rain since is missed. Accept this, and note it with a `ponytail:` comment.

**UI**

- A day that is dirty because of salted roads gets hint text `Salted roads wet while you drive from {time}.` instead of the plain wet-roads text.
- The info popover replaces `Road salt is not assessed.` with `After frost, roads count as salted until ~10 mm of rain has washed them — then any moisture counts as wet.`
- Norwegian equivalents in the same tone.

**Tests (through `planWash`)**

- Frost with 0.3 mm, then 0.15 mm the next day: dirty. The same 0.15 mm without earlier frost: clean.
- Salt ends after 10 mm of total rain since the trigger. After that, 0.15 mm is clean again.
- A frost hour on dry roads with no snowfall doesn't trigger salt.
- Salted but dry roads while driving: clean.

## Implementation Notes for the Agent

- Baseline: the grading spec's implementation must be in place first. Work on the branch after it, or on top of it if it isn't merged yet. Don't push or open a PR unless asked.
- Past days go to 7. Check that work and carwash mode's past-rain runway logic still behaves: it looks back from each window, so more history is harmless. Run their tests.
- Only the `metno_seamless` and `best_match` models are documented in config. Both return the new fields.
- **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` all pass. The screenshots show a snowy tile, an icy badge and a snow-flagged midday. Inspect them visually before committing. The README documents `winter_tyres_entity`, the snow scale and the marker rule.
