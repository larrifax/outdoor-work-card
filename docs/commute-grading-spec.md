# Spec: commute mode — gust-aware wind, danger grade, rider presets, midday home-office flag

Status: ready-for-agent

## Problem Statement

A cyclist uses the commute card to decide how to get to work. Today the grade has three problems.

1. **Wind ignores gusts.** Wind is graded only on the 10 m mean. A day with a mild mean and strong gusts looks "fine". But gusts are what push a rider sideways into traffic, while the mean only makes pedalling harder.
2. **Rain thresholds fit only one kind of rider.** The fixed defaults (0.2 / 1.0 mm/h) are too strict for someone with mudguards and rain gear, and too loose for a fair-weather rider. Changing them means knowing what mm/h means on a bike.
3. **Midday affects the grade in the wrong way.** A bad midday lowers an otherwise perfect day from A to B. That letter tells the rider nothing about the commute. Midday actually matters for another reason. If the commute hours look tolerable but midday is very wet, the rain may shift into a commute window, and a home-office day may be the better call. The card doesn't say this today.

The card also has no way to say "this is dangerous" as opposed to "this is unpleasant".

## Solution

- Each commute hour shows one **effective wind** number built from mean and gusts. Tap or hover a tile to see the mean and gust values behind it.
- A new **dangerous** hour level uses fixed thresholds for storm gusts or cloudburst rain. Any dangerous commute hour gives the day the new grade **F**.
- The grade scale A–F is based on the two commutes only. Midday no longer changes the letter.
- Midday shows peak and total rain. When the commute grade is still A–C but midday is very wet, a **midday flag** suggests considering home office.
- In the visual editor, a **rider preset** selector (Fair-weather / Everyday / All-weather) fills the four threshold fields. The rider can then fine-tune them. The config stores only the four numbers.

## User Stories

1. As a commuter, I want gusts to count in the wind grade, so that a day with a moderate mean but strong gusts is not shown as calm.
2. As a commuter, I want one wind number per hour tile, so that the grid stays as easy to scan as today.
3. As a commuter, I want the effective wind to equal the mean wind in ordinary conditions, so that the number matches what I know from weather apps on normal days.
4. As a commuter, I want to tap an hour tile and see its mean wind, gust speed and rain, so that I can see why an hour is graded as it is.
5. As a commuter on a wall-mounted touch dashboard, I want the tile hint to open on tap, so that I get the details without a mouse.
6. As a keyboard user, I want the tile hint to open on focus, so that the details are reachable without a pointer.
7. As a commuter, I want hours with storm gusts or cloudburst rain marked as dangerous, so that I can tell "unpleasant" apart from "unsafe".
8. As a commuter, I want any dangerous commute hour to give the day grade F, so that danger is never averaged away.
9. As an all-weather commuter, I want the danger thresholds to stay fixed whatever my comfort settings are, so that a lenient preset never hides a storm.
10. As a commuter, I want dangerous tiles to have a distinct red fill and a warning icon, so that they stand out from merely bad hours.
11. As a commuter, I want the reason line to say what makes the day dangerous and on which leg (e.g. "dangerous gusts home"), so that I know whether I can still ride one way.
12. As a commuter, I want grade A to mean both commutes are fine, so that A is a clear "just go".
13. As a commuter, I want grade B to mean one commute is tolerable and the other fine, so that small annoyances can be told apart from two-way ones.
14. As a commuter, I want grade C to mean both commutes are tolerable, so that I know to bring gear both ways.
15. As a commuter, I want grade D to mean one commute is bad, so that I can think about another way home or to work.
16. As a commuter, I want grade E to mean both commutes are bad, so that I know cycling makes no sense that day.
17. As a commuter, I want the midday window to no longer change the letter grade, so that the grade reflects only the rides I actually take.
18. As a commuter, I want the traffic light to stay green for A/B, amber for C and red for D/E/F, with F styled differently, so that the colours stay familiar.
19. As a commuter, I want the midday column to show peak rain and total rain, so that I can tell a short shower apart from a wet day.
20. As a commuter who can work from home, I want a flag when midday is very wet but the commutes still look tolerable, so that I can guard against the rain arriving earlier or later than forecast.
21. As a commuter, I want the midday flag to appear only on A–C days, so that it doesn't repeat what a D/E/F grade already says.
22. As a commuter, I want the flag to show on the midday cell, in the reason line and in the hero when it's the first row, so that I see it wherever I look.
23. As a commuter, I want the flag to fire on one heavy midday hour or on a lot of total midday rain, so that both cloudbursts and long drizzly days count.
24. As a new user, I want a rider preset selector in the editor, so that I can pick sensible thresholds without knowing what mm/h means.
25. As a new user, I want to choose between Fair-weather, Everyday and All-weather, so that I can pick the one that matches my bike and gear.
26. As a user, I want a preset to fill the four threshold fields, so that I can then adjust individual values.
27. As a user who has changed a value, I want the selector to show "Custom", so that I know my thresholds no longer match a preset.
28. As a user whose values match a preset exactly, I want the selector to show that preset, so that reopening the editor shows what I picked.
29. As a YAML user, I want the config to hold only the four threshold numbers, so that no new key is needed and existing configs keep working.
30. As an existing user, I want my current `rain_fine`/`rain_ok`/`wind_fine`/`wind_ok` values to keep their meaning, so that the upgrade doesn't silently change my thresholds. Only `wind_*` now compares against effective wind.
31. As a user with no thresholds set, I want defaults equal to the Everyday preset, so that the card starts out sensible.
32. As a user, I want the info popover to explain effective wind, the danger thresholds, the A–F grade meanings and the midday flag, so that I can understand the card without the README.
33. As a Norwegian (or other supported language) user, I want every new label, reason fragment, preset name and legend line translated, so that the card stays fully localized.
34. As a user reading the README, I want a table with the three presets' values, so that I can copy them into YAML.

## Implementation Decisions

**Weather data**
- The Open-Meteo request adds the `wind_gusts_10m` hourly variable. `metno_seamless` returns it for the full 10-day horizon (checked).
- `HourPoint` gains a `gust` field (m/s, 10 m). A missing value falls back to the mean wind.
- The shared fetch cache key doesn't change. Work and wash mode ignore `gust`.

**Effective wind (commute logic)**
- `eff = max(mean, gust × 0.6)`. The factor is a code constant marked with a `ponytail:` comment. Upgrade path: make it configurable if riders ask.
- Reasoning: inland gust factors run about 1.5–1.7, so in steady wind `gust × 0.6 ≈ mean`. The number rises above the mean only when gusts are unusually strong for the mean.
- `wind_fine` / `wind_ok` compare against `eff`.

**Hour levels**
- `Level` goes from 0–2 to 0–3: 0 fine, 1 tolerable, 2 bad, 3 dangerous.
- Dangerous: `eff > 14` m/s (≈ gusts above 23 m/s, near MET wind-warning level) or rain `> 8` mm/h. Both are fixed code constants, independent of rider thresholds, and marked `ponytail:`.
- Each hour cell exposes mean wind, gust, effective wind, rain, the rain level, the wind level and the combined level. The old `gust` level field on the cell is renamed to avoid confusion with the new gust speed.

**Grade**
- Worst hour per window as today, with level 3 added.
- F if either window has a level-3 hour. Otherwise, with `a`/`b` being the two window levels: A if both are 0. B if one is 1 and the other 0. C if both are 1. D if exactly one is 2. E if both are 2.
- `Grade` becomes `"A" | "B" | "C" | "D" | "E" | "F"`. Traffic light: A/B 0, C 1, D/E/F 2. F gets its own badge style class.
- Midday no longer feeds into the grade.

**Midday summary**
- The fields become peak mm/h, total mm, a rain level, and a `flag` boolean. Mean wind is removed.
- `flag = grade ∈ {A, B, C} && (peak > rainOk || total > 3 × rainOk)`.
- The reason line appends the localized midday-flag fragment when `flag` is set. It replaces the current "rain midday" fragment.

**Reason line**
- Rain words: light rain (1), rain (2), cloudburst/heavy rain (3). Wind words: breezy (1), strong wind (2), dangerous gusts (3). Legs are joined as today.

**Presets**
- Defined once as a constant table shared by the editor and the README values:
  - Fair-weather: rain 0.1 / 0.3 · wind 5 / 8
  - Everyday: rain 0.2 / 0.8 · wind 6 / 10
  - All-weather: rain 0.5 / 2.0 · wind 8 / 12
- The config resolver defaults become the Everyday values. This changes the `rain_ok` default from 1.0 to 0.8.
- No `rider`/`preset` key in the config schema.
- Editor: a single `select` (a built-in `ha-form` selector) in the commute section, above the threshold fields. It has options for the three presets plus Custom. Its displayed value is computed at render time by matching the four current effective values (config or default) against the table. Selecting a preset writes its four values into the config. The select's own key is stripped before `config-changed` is dispatched. Selecting Custom changes nothing.
- A small pure function maps four threshold values to a preset id or `custom`. The editor uses it.

**Card UI**
- The tile wind value shows the rounded `eff`.
- Tiles become focusable and reuse the existing wash-mode hint mechanism: `popover="hint"`, CSS anchor positioning, and the shared show/hide handlers on pointerenter/leave and focus/blur. Tapping works through focus. Hint content: hour, rain mm, effective wind, mean and gust.
- Dangerous tiles: red fill plus a warning icon (added to the icon set if it's missing).
- The midday cell shows peak and total rain (drop icon). When flagged, it gets a red outline.
- Hero: shows F with its distinct style. The reason line includes the midday flag when it's set on the first row.
- Info popover: wind row labelled "effective wind", a danger-threshold line, grade legend A–F with the new meanings, and one midday-flag line.

**i18n**
- New or changed strings in every supported language: dangerous rain and wind fragments, the midday-flag fragment, the F caption/verdict/legend, the new B–E legend meanings, the effective-wind label, the tile hint template, preset option labels and the preset field label/helper.

## Testing Decisions

- Good tests use only public outputs: `planCommute` input hours and options in, grades, levels, flags and reason strings out. They don't test private helpers or intermediate structures.
- **Primary seam: `planCommute`.** It already exists and is already tested. Effective wind, dangerous levels, the A–F grade table, midday totals and the midday flag are all observable through it. Test cases:
  - Effective wind equals the mean when `gust ≈ mean / 0.6`, and rises when the gust is stronger.
  - Each grade A through F is produced by a minimal hour series.
  - F wins over everything, including a D/E day. Danger thresholds apply even with lenient rider thresholds.
  - The midday flag fires on a single peak above `rainOk` and on a total above `3 × rainOk`. It is suppressed on D/E/F. Midday never changes the grade.
  - A missing gust falls back to the mean.
- **Secondary seam: the preset matcher** (pure function). One test: each preset's values map to its id, and a changed value maps to `custom`.
- **Config resolver:** one assertion that the defaults equal the Everyday preset.
- Prior art: the commute and logic test files. They build a synthetic hourly series in Europe/Oslo with a `series()` helper that maps ISO hours to values. That helper grows an optional gust value. The existing browser screenshot test covers visual regressions and needs its baselines updated for the new tile and midday rendering.
- The editor select and the tile hints are not unit-tested. They are checked through screenshots or by hand.

## Out of Scope

- Wind direction (headwind vs tailwind relative to the route).
- Configurable gust factor or danger thresholds.
- Widening commute windows by an hour to absorb timing errors. The midday flag covers that case.
- Snow, ice and slippery roads (separate spec: `docs/commute-winter-spec.md`). Only a popover line saying they aren't assessed is in scope.
- Temperature or visibility.
- An e-bike preset. Users can override the wind values instead.
- A `rider` config key or YAML preset shortcut.
- Changes to work or carwash mode.

## Implementation Notes for the Agent

**Baseline**
- Build on the current working tree. Commute mode itself is not committed yet (the commute module and its test file are untracked, and several other files are modified). Don't reset, stash or check out a clean `main`.
- Work on a new branch off the current state. Commit when done. Don't push or open a PR unless asked.

**Existing tests that must change (not the code)**
- The commute test file has a grade-ladder test that expects B for "midday rain only". It also has a midday test that asserts mean wind and grade B. Both encode the old behaviour. Rewrite them to the new grade table and midday fields. Don't bend the code to keep them passing.
- The test options use `rainOk: 1.0`. Keep explicit values in tests. Only the resolver default changes.
- The browser screenshot test mounts work and carwash cards only, and its weather fixture has no wind or gust data. Add one commute card to it. Give the fixture `wind_speed_10m` and `wind_gusts_10m` series that produce at least a B, a C/D, an F and one midday-flag day within the frozen-clock week. Then regenerate the two screenshot PNGs.

**Caption, verdict and badge for F**
- Hero caption and verdict are currently arrays indexed by traffic light (0–2). F shares light 2 with D/E, but needs its own text. Add separate F caption and verdict strings. Pick F's strings when the grade is F, and fall back to the light-indexed arrays otherwise. The grade badge gets a class for F in addition to the light class.

**Editor preset select: change handling**
- `ha-form` sends the whole data object on every change, including the preset field's current displayed value. Rule in the change handler:
  - If the preset field's value differs from the value computed for the pre-change config, and is not `custom`, overwrite the four threshold keys with that preset's values.
  - Otherwise ignore the preset field. The threshold edit stands, and the displayed preset is recomputed on the next render.
  - Always delete the preset key before dispatching `config-changed`.
- Matching uses the effective values, meaning config values or defaults. So an empty config shows Everyday.

**Wording (English; Norwegian Bokmål `nb` is the only other language and needs equivalents in the same tone)**

| Purpose | English |
|---|---|
| Rain fragment, level 3 | `cloudburst` |
| Wind fragment, level 3 | `dangerous gusts` |
| Midday flag fragment (replaces "rain midday") | ` · heavy rain midday — consider home office` |
| F hero caption | `Dangerous to ride` |
| F hero verdict | `Don't bike` |
| Popover grade A | `both commutes fine` |
| Popover grade B | `one commute tolerable` |
| Popover grade C | `both commutes tolerable` |
| Popover grade D | `one commute bad` |
| Popover grade E | `both commutes bad` |
| Popover grade F | `a commute hour is dangerous` |
| Popover wind unit label | `effective wind, m/s` |
| Popover danger line | `Dangerous: rain above 8 mm/h or effective wind above 14 m/s, whatever your thresholds` |
| Popover effective-wind line | `Effective wind is the mean, or 60% of the gust speed when gusts are unusually strong` |
| Popover winter line | `Snow and ice are not assessed yet` |
| Popover midday line | `Midday doesn't change the grade. A red outline means heavy midday rain — the forecast may be off by an hour or two` |
| Tile hint | `{hh}:00 · {mm} mm · wind {eff} m/s (mean {mean}, gusts {gust})` |
| Editor preset label | `Rider type` |
| Editor preset helper | `Fills the rain and wind thresholds below` |
| Preset options | `Fair-weather`, `Everyday`, `All-weather`, `Custom` |

The existing popover note says midday is "shown for context only". Update it to match the midday line above, or drop the midday part in favour of that line.

**README**
- Document the three presets as a table (the values above). Also note: `wind_*` now compares against effective wind, the new F grade, the midday flag, and the `rain_ok` default change.

**Done when**
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` all pass. `pnpm test` also runs the browser screenshot test through Playwright/Chromium.
- The regenerated screenshots show the commute card with an F day, a flagged midday cell and effective-wind tiles, in both themes. Inspect them visually before committing.

## Further Notes

- Values are 10 m model winds. At rider height the mean is roughly 65% of that in open terrain and less in town. The thresholds are chosen with this in mind and should not be "corrected" to rider-height numbers.
- The `rain_ok` default change (1.0 → 0.8) affects users who never set it. Mention it in the release notes.
- Open-Meteo reports precipitation in 0.1 mm steps, so a threshold of 0.1 in practice means "any measurable rain".
