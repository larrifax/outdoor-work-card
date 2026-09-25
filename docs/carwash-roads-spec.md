# Spec: carwash mode — wet-roads model (v2.0.0)

Status: ready-for-agent

Independent of the commute specs. Ships as v2.0.0.

## Problem Statement

Carwash mode is meant for a driver who parks indoors at home, often at work too, and drives most days. For that driver, rain on the parked car is harmless. What gets the car dirty is **driving on wet roads**: spray throws road grime onto the paint, and that keeps happening after the rain has stopped.

Today's model judges the wrong thing:

- It grades rain **falling**. It checks each hour's peak mm/h against `ok_rain` (0.5) by day and `night_max` (4) at night.
- `ok_rain` 0.5 mm/h is steady light rain. That already soaks the roads, because roads are wet from about 0.1–0.2 mm.
- Six hours of 0.4 mm/h drizzle (2.4 mm) counts as harmless, yet soaks the roads just as well as one 2.4 mm hour.
- Heavy night rain up to 4 mm/h counts as harmless, but nothing checks whether the roads are still wet when you drive to work next morning.
- Rain at noon on a workday spoils the day, even when the car stands in a garage at work and the roads dry before the drive home.
- Drying time exists only before the wash (`dry_roads_hours` 2) and nowhere else.

## Solution

Replace the rain-falling model with a **wet-roads** model:

- Roads turn **wet** when an hour has more than `ok_rain` mm (new default 0.2).
- Roads are **dry** again after `dry_roads_hours` rain-free hours (new default 3). Drying runs at half speed during the night window.
- **Driving hours** are every hour outside the night window, except an optional **parked** window on workdays, which covers the car indoors at work.
- A day is **dirty** when any driving hour has wet roads. On the wash day, only hours from the wash time on count.
- The streak, recommendation, break-day and next-rain logic stay the same, now fed by this dirty/clean day status.
- `night_max` is ignored.
- Icons, hints and the info popover are updated to talk about roads instead of rain on the car.
- The info popover says road salt is not assessed. Salt is handled in the winter spec.

## User Stories

1. As a driver who parks indoors, I want rain on the parked car ignored, so that only rain that actually dirties my car counts.
2. As a driver, I want wet roads while I'm driving to count as dirtying the car, so that spray after a shower is taken into account.
3. As a driver, I want light rain (above 0.2 mm in an hour) to make roads wet, so that the threshold matches when roads actually get wet.
4. As a driver, I want many hours of drizzle to keep the roads wet, so that a long drizzly day is not treated as harmless.
5. As a driver, I want roads to count as dry again after a few rain-free hours, so that a morning shower doesn't spoil a dry afternoon drive.
6. As a driver, I want roads to dry more slowly at night, so that evening rain still counts when I drive early next morning.
7. As a driver, I want night rain that has dried off before I drive to be harmless, so that a clear morning after a rainy night isn't marked dirty.
8. As a driver who runs errands after work, I want every hour outside the night window to count as possible driving, so that shopping trips count.
9. As a driver who parks indoors at work, I want to set an optional parked window on workdays, so that midday rain that dries before I drive home doesn't count.
10. As a driver, I want roads to keep drying during my parked window, so that the drive home is judged on the road state at that time.
11. As a driver who parks outdoors at work, I want no parked window by default, so that midday rain counts for me.
12. As a driver with a non-standard week, I want to choose which weekdays the parked window applies to, so that it matches my work days.
13. As a driver, I want the wash day judged only from the wash time on, so that rain earlier in the day doesn't block an evening wash once the roads have dried.
14. As a driver, I want the wash evening ruled out when the roads are still wet at wash time, so that I don't wash and drive straight into spray.
15. As a driver, I want the streak to count clean days after the wash until the first dirty one, so that I see how long the wash lasts.
16. As a driver, I want a sun icon when no rain is forecast, so that clear days stand out.
17. As a driver, I want a moon icon when it rains but the roads are dry whenever I drive, so that I know the rain is harmless for me.
18. As a driver, I want a rain icon when I would drive on wet roads, so that dirty days stand out.
19. As a driver, I want the day hint to explain when the roads are wet or when they dry, so that I understand the icon.
20. As a driver, I want the next-rain hint to show when the roads are wet while I'm driving, so that I know what ends the streak.
21. As a driver, I want the info popover to explain wet threshold, drying time, night half-speed, parked window and that road salt isn't assessed, so that I can trust the recommendation.
22. As an existing user, I want my old config to keep loading, so that the upgrade doesn't break my dashboard.
23. As an existing user, I want the release notes to say that defaults and meanings changed, so that I understand why recommendations shifted.
24. As a Norwegian user, I want all new and changed strings translated, so that the card stays fully localized.
25. As a user of the visual editor, I want the parked window and its weekdays in the carwash section, and `night_max` gone, so that the editor matches the model.

## Implementation Decisions

**Config**

- `ok_rain` keeps its key. New meaning: mm in an hour above which roads turn wet. New default **0.2**, range 0–5.
- `dry_roads_hours` keeps its key. New meaning: rain-free hours until wet roads are dry. New default **3**, range 0–24.
- `night_from` / `night_until` keep their defaults, 22:00 / 06:00. New meaning: no driving happens, and drying runs at half speed.
- New optional `parked_start` / `parked_end` ("HH:MM"). Both must be set to take effect. There is no default.
- `workdays` (already exists for commute mode; ISO days, default Mon–Fri) also sets the days the parked window applies to in carwash mode.
- `night_max` is still accepted, but ignored and removed from the editor.
- Parsing follows the existing resolver conventions: clamped numbers, `HH:MM` parsing and fallbacks.

**Road state (pure logic)**

- Walk the hourly series in order and keep a drying counter:
  - An hour with `mm > okRain` makes the road wet, with remaining drying = `dryRoadsHours`.
  - Otherwise, when the road is wet, drying decreases by 1 (0.5 if the hour lies in the night window), and the road becomes dry when drying reaches ≤ 0.
- Each hour gets `wet: boolean`, where wet covers the hour itself.
- The state before the first data hour is dry. The fetch already includes 3 past days, which is plenty of warm-up.
- The half-speed factor is a code constant marked `ponytail:`. Ceiling: it ignores temperature, sun and wind. Upgrade path: temperature-aware drying once the winter spec adds `temp`.

**Driving hours**

- `driving(h)` = not in the night window, and not (the parked window is set, the day is a workday, and the hour is in the parked window).
- Night and parked windows use half-open ranges, `[from, until)`, like today's night check. Night windows that wrap past midnight keep working as today.

**Day status**

- `dirty(day)` = any hour in the day that is driving and wet.
- Wash-day status: `eveningClean` = no driving + wet hour from `evening` (wash time, or now if later, today) to the end of the day. It replaces `eveningTolerated`. The old lead-hours rule is gone, because the drying counter covers it. Rain at 16:00 with `dry_roads_hours` 3 leaves the roads wet at 18:00, so the evening is ruled out.
- `tolerated` becomes `clean` = not `dirty`. `hasData` handling stays the same.
- The streak, `bestIdx`, `todayBreakIdx` and `bestBreakIdx` algorithms keep their current structure over the new flags.
- `nextRain` becomes the first **dirty stretch** after the wash evening: consecutive driving hours with wet roads. It exposes the start, the end of the last hour in the stretch, its length in hours, and the peak and total mm of the rain hours that caused the wetness. Include rain hours from the stretch start back to the rain that made the road wet, so that a stretch that starts dry-but-drying still reports its rain.
- Removed from the result: `peakNight`, `clearsBeforeWash`, and the `leadHours` option. `peak` stays for display.
- New per-day fields: `wetFrom` / `dryAt` (UTC ms or null). These are the first driving hour with wet roads, and the time roads are dry again, for the hint.

**Icons**

- `sun`: no hour with rain above 0.05 mm in the day.
- `moon`: rain fell, but no driving hour has wet roads. On the wash day this means from the wash time on.
- `rain`: dirty.
- `drop` is no longer produced for wash days. Leave the icon itself in the icon set if other modes use it.

**Hints and popover**

- Day hint by kind: clear, `dryBeforeDrive` (rain, roads dry before you drive), or `wetWhileDriving` (with the time roads are wet from). Hint kinds `earlier` / `night` / `daytime` are replaced.
- Next-rain hint: "Roads wet while driving {day} {from}–{to}", keeping the total/peak stats.
- Popover rows: wet threshold, drying time, night window with half speed, parked window (only when set, with its days), and a line saying road salt isn't assessed. The harmless-day/night rows are removed.
- Day subtitle/describe text in the hero trade-off follows the new kinds. For example "Monday's wet roads (from 07:00)" replaces "Monday's daytime rain (2.6 mm/h)".

**Editor (carwash section)**

- Fields: `wash_start`, `ok_rain` (step 0.1, mm), `dry_roads_hours`, `night_from` / `night_until`, `parked_start` / `parked_end` (time), and `workdays` (the same multi-select as commute).
- Remove `night_max`.
- Update the helpers to describe the new meanings.

**Wording (English; Norwegian Bokmål `nb` needs equivalents in the same tone)**

| Purpose                            | English                                                                                                                                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Day kind, clear                    | `No rain forecast — roads stay dry.`                                                                                                                                                          |
| Day kind, dry before drive         | `Rain, but roads are dry again before you drive.`                                                                                                                                             |
| Day kind, wet while driving        | `Roads wet while you drive from {time}.`                                                                                                                                                      |
| Day short label: clear / dry / wet | `clear` / `dries off` / `wet roads`                                                                                                                                                           |
| Next dirty stretch                 | `Roads wet while driving {day} {from}–{to} ({hours} h)`                                                                                                                                       |
| Out tip                            | `{n}+ days until you'd drive on wet roads`                                                                                                                                                    |
| Out dirty                          | `Roads wet at or after wash time`                                                                                                                                                             |
| Describe (hero trade-off)          | `{day}'s wet roads (from {time})`                                                                                                                                                             |
| Popover: wet threshold             | `Roads wet above` → `{mm} mm/h`                                                                                                                                                               |
| Popover: drying                    | `Dry again after` → `{h} h without rain`                                                                                                                                                      |
| Popover: night                     | `Night (no driving, half-speed drying)` → `{from}–{until}`                                                                                                                                    |
| Popover: parked                    | `Parked indoors` → `{from}–{until} on {days}`                                                                                                                                                 |
| Popover: salt                      | `Road salt is not assessed.`                                                                                                                                                                  |
| Editor labels                      | `Wet-road threshold`, `Dry again after (hours)`, `Parked from`, `Parked until`, `Parked on`                                                                                                   |
| Editor helpers                     | ok_rain: `Rain per hour that makes roads wet`. dry_roads_hours: `Rain-free hours until roads are dry (half speed at night)`. parked: `Optional: hours your car is parked indoors on workdays` |

## Testing Decisions

- Test only through public outputs: `planWash` input hours and options in, day flags, icons, streaks, best/break indices and next dirty stretch out.
- Prior art: the wash tests in the logic test file use a series builder in Europe/Oslo and a frozen `NOW`. Several of them encode the old model (moon/drop icons, lead-hours, tolerated night rain) and must be **rewritten to the new rules, not preserved**. The browser screenshot fixture's rainy and tonight scenarios may need adjusting so that the recommendation, skip banner and trade-off states still appear. Regenerate the PNGs.
- **Cases:**
  - 0.2 mm in an hour doesn't make roads wet. 0.3 does.
  - Drizzle: 6 × 0.3 mm makes roads wet through the stretch and for 3 h after it.
  - Half-speed night drying changes the outcome: rain in the 02:00 hour with 3 h drying leaves the roads wet at 06:00, which is a driving hour, so the day is dirty. At full speed they would be dry by 06:00.
  - Night rain that dries before 06:00 gives a moon and a clean day.
  - A parked window on a workday: rain at 11:00, dry by 14:00, drive from 15:00 gives a clean day. The same case on a Saturday is dirty. Without a parked window it's dirty.
  - Wash day: rain at 16:00 with wash at 18:00 and 3 h drying rules out the evening (`streak` -1). Rain at 13:00 allows it.
  - Streak, best and break indices on a multi-day series.
  - The next dirty stretch reports start, length and the causing rain's peak/total.
- **Resolver:** one assertion for the new defaults (0.2, 3, no parked window), and one that `night_max` in config has no effect.

## Out of Scope

- Road salt, snow and temperature-aware drying. The winter spec (`docs/commute-winter-spec.md`, section "Carwash: road salt") adds the salt rule.
- Outdoor parking (rain on the parked car).
- Per-day driving schedules beyond the single parked window.
- Changes to work and commute mode.

## Implementation Notes for the Agent

- Baseline: the current working tree (commute mode is uncommitted). Work on its own branch. Don't push or open a PR unless asked.
- Bump `package.json` to **2.0.0**. Add release notes to the README (or the changelog if one exists) that list:
  - the `ok_rain` meaning and default change (0.5 → 0.2),
  - the `dry_roads_hours` meaning and default change (2 → 3),
  - that `night_max` is ignored,
  - the new `parked_*` keys and `workdays` in carwash mode.
- The existing hero, trade-off and skip-banner flows consume `tolerated`, `eveningTolerated`, `peakNight` and `clearsBeforeWash`. Update all consumers. Typecheck will find them once the fields are removed.
- **Done when:** `pnpm typecheck`, `pnpm lint`, `pnpm format:check` and `pnpm test` all pass. The screenshots still show the wash-tonight card and the skip/recommend card with the new icons. Inspect them visually before committing.
