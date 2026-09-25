# Spec: work mode — ground-wetness model

Status: ready-for-agent

Ships in **v2.0.0** together with `docs/carwash-roads-spec.md`. It doesn't depend on the commute specs. The design comparison behind the UI decision is in `docs/design-brief-work-dryness.md`. Alternative B was chosen.

## Problem Statement

Work mode decides when the ground is dry enough to mow or paint by counting **hours since the last rainy hour** (above `rain_threshold`, 0.2 mm). Each task needs a fixed number of hours: Mow 24 h, Paint 24 h before plus 24 h after.

That is wrong in both directions:

- A 0.3 mm shower on a sunny, windy summer day is dry in 2–4 h, but it still blocks mowing for a full day.
- 15 mm of rain on a grey autumn day can leave the ground wet well past 24 h.
- Drizzle just under the threshold never counts, however long it lasts.

The user sees "24 h dry" and trusts it, but the number ignores both how much rain fell and how fast the weather dries it.

## Solution

- Track **ground wetness** in mm. Each hour's precipitation adds to it, and each hour's reference evaporation (Open-Meteo `et0_fao_evapotranspiration`, which already reflects sun, wind, temperature and humidity) removes it.
- Each task has a wetness limit `max_wet` in mm, replacing the `before` hours: Mow 0.3, Paint 0.1. A task is OK when the wetness at window open is at or below its limit.
- Paint's `after` (hours without rain after the window) and the "no rain during the window" rule are unchanged.
- The **Before** column becomes **Dry by**. It shows ✓ when all tasks are dry at window open. Otherwise it shows the strictest not-yet-dry task and the time it will be dry, e.g. "Paint 21:00". A tooltip gives the wetness in mm and each task's dry-by time.
- The hero task lines describe the limit and the wetness at window open instead of hours.

## User Stories

1. As a homeowner, I want a light shower on a sunny day to stop blocking mowing within a few hours, so that I don't lose good evenings.
2. As a homeowner, I want heavy rain to keep the ground wet for longer, so that I'm not told to mow a soggy lawn.
3. As a homeowner, I want drying to be faster on sunny, windy days and slower on grey, still days, so that the verdict matches what I see in the garden.
4. As a homeowner, I want long drizzle to count even when no single hour is heavy, so that a wet day isn't treated as dry.
5. As a homeowner, I want Mow to accept a slightly damp surface and Paint to require bone dry, so that each task gets the right strictness.
6. As a homeowner, I want to set my own wetness limit per task, so that I can tune it to my lawn, mower or paint.
7. As a homeowner, I want Paint still to need 24 h without rain after the window, so that fresh paint isn't washed off.
8. As a homeowner, I want rain during the window still to rule the day out, so that I'm never sent out into rain.
9. As a homeowner, I want the Dry-by column to show ✓ when the ground is ready for every task, so that I can see at a glance that I can go.
10. As a homeowner, I want the column to show which task is still waiting and when it will be dry (e.g. "Paint 21:00"), so that I know whether waiting helps.
11. As a homeowner, I want times beyond today to include the weekday (e.g. "Fri 11:00"), so that I don't mistake tomorrow for tonight.
12. As a homeowner, I want "—" when the ground won't dry within the forecast, so that I don't read a false time.
13. As a homeowner, I want the text green for ✓, amber when the ground dries during the window and grey otherwise, so that the column keeps its traffic-light meaning.
14. As a homeowner, I want to tap a Dry-by cell and see the wetness in mm and every task's dry-by time, so that I can see the detail behind the one line.
15. As a homeowner with three or four tasks, I want the row to stay one line high, so that the card doesn't grow.
16. As a homeowner, I want the hero line per task to state its limit and today's wetness at window open, so that the recommendation explains itself.
17. As a homeowner, I want the info popover to explain the wetness model, so that I understand why the card says "dry" after a shower.
18. As an existing user, I want my config to keep loading after the upgrade, with old `before` values ignored and a sensible default limit applied, so that the dashboard doesn't break.
19. As an existing user, I want the release notes to explain that `before` is replaced by `max_wet`, so that I can update my tasks.
20. As a Norwegian user, I want all new and changed strings translated, so that the card stays fully localized.

## Implementation Decisions

**Weather data**

- Add hourly `et0_fao_evapotranspiration` (mm/h) to the Open-Meteo request. `metno_seamless` returns it for the full horizon (checked in Oslo: about 0.2–0.26 mm/h at midday and about 0 at night in late September, 0.7–2 mm per day).
- `HourPoint` gains `et0` (mm/h). A missing value falls back to 0, so it never dries faster than the data says.
- Past days go to **7** so that the counter has enough warm-up. The winter spec makes the same change. Whichever spec lands first does it.

**Wetness counter (pure logic)**

- Walk the series in order, starting at 0: `w = clamp(w + mm − et0 × DRYING_FACTOR, 0, CAP)`.
- `DRYING_FACTOR = 1.0` and `CAP = 15` mm are code constants marked `ponytail:`. Ceiling: ET0 refers to short grass, not wood or soil. Upgrade path: make the factor per task if users ask.
- Wetness at a moment = the counter value after the last full hour before that moment.

**Task config**

- A `TaskConfig` holds `name`, `max_wet` (mm, 0–5) and optionally `after` (hours, as today).
- Defaults: Mow `{ max_wet: 0.3 }`, Paint `{ max_wet: 0.1, after: 24 }`.
- `before` is removed from the type. The resolver ignores it if present. A task without `max_wet` gets 0.3.
- `rain_threshold` stays. It's used only for "rain during the window" and for the `after` runway.

**Day evaluation**

- `wetAtStart` = wetness at the scheduled window start. Today that's the effective start, `max(start, now)`, the same as the existing window logic.
- Per task: `ok = usable && wetAtStart ≤ max_wet && (after unset || after ≥ task.after)`, where `usable` is unchanged (window exists, not passed, long enough, no rain during it).
- Per task `dryAt`: the first hour boundary at or after the window start where the forecast wetness is ≤ `max_wet`. Null if that never happens within the data. It equals the window start when the ground is already dry.
- The `before` hours field is removed from `WorkDay`. Add `wetAtStart: number` and `dryAt: (number | null)[]` (one per task).
- The `after` runway (hours without rain, capped at 48) is unchanged.
- The task verdicts (next and longest day) and `tonightOk` are unchanged in structure.

**Dry-by cell (row UI)**

- If every task has `wetAtStart ≤ max_wet`: show ✓ in the accent colour.
- Otherwise pick the not-yet-dry task with the **lowest** `max_wet` (ties go to config order). Show `{task} {time}`:
  - `time` is `HH:MM` when `dryAt` is on the same local day, `{short weekday} HH:MM` when it's later, and `—` when it's null.
  - Colour: amber when `dryAt` falls before the window ends, grey otherwise.
- The row height is unchanged. The cell drops the bar and shows text only.
- Tooltip on the cell reuses the existing `popover="hint"` mechanism with focus/tap support, like the wash grid and the commute tiles. Content: `Ground wetness {w} mm at {HH:MM}`, then one line per task: `{task} OK` or `{task} dry from {time}` or `{task} not dry in forecast`.
- Column header: `Dry by`.

**Hero**

- Task subtitle (`need`): `dry ground (≤ {max_wet} mm)`, plus ` · {after} h no rain after` when `after` is set.
- Detail for the next OK day: `{w} mm at window open · {after-hours} dry after · {light} of light`. The after-part appears only when `after` is set. Keep the longest-day part as today.

**Info popover (work)**

- Replace the per-task "dry before" rows with `≤ {max_wet} mm` (plus the after-hours when set).
- Add one line: `Ground wetness: rain adds to it, evaporation (sun, wind, warmth) removes it — about 1–2 mm a day in autumn, 3–5 in summer.`

**Editor**

- Tasks stay YAML-only, as today. Update the editor note text to show `max_wet` in the example.

**Wording (English; Norwegian Bokmål `nb` needs equivalents in the same tone)**

| Purpose            | English                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| Column header      | `Dry by`                                                                  |
| Cell, all dry      | `✓`                                                                       |
| Cell, waiting      | `{task} {time}`                                                           |
| Cell, never        | `{task} —`                                                                |
| Tooltip head       | `Ground wetness {w} mm at {HH:MM}`                                        |
| Tooltip task OK    | `{task} OK`                                                               |
| Tooltip task later | `{task} dry from {time}`                                                  |
| Tooltip task never | `{task} not dry in forecast`                                              |
| Hero need          | `dry ground (≤ {mm} mm)` / `dry ground (≤ {mm} mm) · {h} h no rain after` |
| Hero detail        | `{w} mm at window open`                                                   |
| Popover line       | see above                                                                 |

## Testing Decisions

- Test only through public outputs: `planWork` input hours and options in, `ok`, `wetAtStart`, `dryAt` and the task verdicts out. Prior art: the work tests in the logic test file (Europe/Oslo series builder, frozen `NOW`). The existing work tests encode hour-based runways and **must be rewritten to the new rules, not preserved**.
- The series builder grows an optional `et0` per hour. Default it to a realistic diurnal curve (e.g. 0.2 mm/h from 10–16, 0.05 otherwise) so that the tests read naturally, and let cases override it.
- **Cases:**
  - A 0.3 mm shower at 13:00 on a sunny day is OK for Mow by 18:00 but not immediately after.
  - 10 mm the day before with low ET0 means not OK for Mow at 18:00, and `dryAt` is a later day.
  - Drizzle of 6 × 0.15 mm (under `rain_threshold`) still raises the wetness enough to block Paint.
  - Mow OK and Paint not OK on the same day, from wetness alone.
  - Paint blocked by `after` < 24 h even when the ground is dry.
  - Rain inside the window blocks all tasks.
  - `dryAt` equals the window start when already dry, and null when it never dries within the data.
  - The counter is capped at 15 mm and never goes negative.
- **Resolver:** default tasks have `max_wet` 0.3 / 0.1. A YAML task with `before` and no `max_wet` gets 0.3.
- **Cell selection** (strictest not-yet-dry task, ✓ when all dry): cover it through a small pure helper if the card logic would otherwise be untestable. Otherwise rely on screenshots.
- **Screenshot test:** the work fixture needs an `et0` series. Adjust it so that the good-week and rainy-week cards still show ✓, a "Paint 21:00" style cell and a "—" cell. Regenerate the PNGs.

## Out of Scope

- Per-task drying factors or different surfaces (wood vs grass).
- Temperature, humidity and dew conditions for paint.
- Dew on grass for mowing.
- Soil-moisture data from Open-Meteo.
- Editing tasks in the visual editor.
- Changes to carwash and commute mode.

## Implementation Notes for the Agent

- Baseline: the current working tree. Work on its own branch, or on the carwash v2.0.0 branch if that exists and isn't merged. Don't push or open a PR unless asked.
- v2.0.0 release notes must mention: `before` replaced by `max_wet`, the new defaults, and the Dry-by column.
- Consumers of the removed `before` field: the hero detail, the row bar and its colour helpers, and the popover rows. Typecheck will find them.
- **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` all pass. The screenshots show ✓, a waiting-task cell and a "—" cell in both themes. Inspect them visually before committing. The README documents `max_wet` and the model.
