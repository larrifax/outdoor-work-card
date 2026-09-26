/**
 * Presenters — pure functions turning planner results into the words and states the
 * card shows. No DOM, no lit: the element only lays these out, so the copy rules are
 * testable in node.
 */
import type { TaskConfig } from "./types";
import type { WashResult, WashDay, WorkResult, WorkDay } from "./logic";
import type { Strings, Seg } from "./i18n";
import { hm, durLabel, hLabel, localParts } from "./time";

export const CAP = 48;

export interface Ctx {
  t: Strings;
  tz: string;
  /** Localized short weekday names, 0 = Sun. */
  short: string[];
}

// ---- car wash --------------------------------------------------------------

export interface WashHero {
  /** ok = tonight is the pick, rec = a later evening, bad = nothing works */
  state: "ok" | "rec" | "bad";
  caption: string;
  day: string;
  streak: string;
  /** why tonight is not the pick (rec only) */
  banner?: string;
  context: string;
  /** trade-off line (rec only); omitted when waiting gains nothing */
  tradeoff?: Seg[];
}

export function washHero(res: WashResult, washStart: string, { t, tz }: Ctx): WashHero {
  const best = res.days[res.bestIdx]!;
  const today = res.days[0]!;
  // `streak` = clean days after the wash day; -1 = the evening can't be washed at all.
  const state = best.streak < 0 ? "bad" : res.bestIdx === 0 ? "ok" : "rec";
  const waitDays = res.bestIdx; // 0 = tonight
  const gain = best.streak - today.streak; // may be <= 0 only through open-ended rounding
  // A break day is always dirty, so `wetFrom` is set; "—" guards the type.
  const describe = (d: WashDay) =>
    t.describe(d.full, d.wetFrom === null ? t.dash : hm(d.wetFrom, tz));
  const dayAt = (i: number) => (i >= 0 && i < res.days.length ? res.days[i] : undefined);
  const todayBreak = dayAt(res.todayBreakIdx);
  const bestBreak = dayAt(res.bestBreakIdx);

  const hero: WashHero = {
    state,
    caption: state === "ok" ? t.capBest : state === "rec" ? t.capWashOn : t.capOutlook,
    day: state === "ok" ? t.tonight : state === "bad" ? t.dash : best.full,
    streak: state === "bad" ? t.nothingClean : t.cleanDays(best.streak, best.openEnded),
    context:
      state === "ok"
        ? todayBreak
          ? t.whyOkBreak(washStart, describe(todayBreak))
          : t.whyOkNoRain(washStart)
        : state === "bad"
          ? t.whyNone
          : t.ctxSkipFrom(washStart, waitDays) +
            (bestBreak ? t.ctxStaysUntil(describe(bestBreak)) : t.ctxStaysPast),
  };
  if (state !== "rec") return hero;

  hero.banner =
    today.streak < 0
      ? t.bannerRain(washStart) // can't wash tonight at all
      : today.streak === 0
        ? todayBreak
          ? t.bannerBrief(describe(todayBreak)) // washable, but nothing lasts the day
          : t.bannerRain(washStart)
        : todayBreak
          ? t.bannerLasts(today.streak, describe(todayBreak))
          : t.bannerLastsNoBreak(today.streak);
  if (today.streak < 0) hero.tradeoff = t.tradeoffFirst(best.full);
  else if (gain >= 2) hero.tradeoff = t.tradeoffBuys(waitDays, gain, best.openEnded);
  else if (gain === 1) hero.tradeoff = t.tradeoffOnly(waitDays);
  // gain <= 0: omit (rounding of open-ended streaks).
  return hero;
}

// ---- work ------------------------------------------------------------------

export interface WorkTaskView {
  need: string;
  /** "Tonight · 18:00–20:41", null when no day meets the task */
  when: string | null;
  detail: string;
}

export interface WorkHero {
  ok: boolean;
  verdict: string;
  tasks: WorkTaskView[];
}

export function workHero(res: WorkResult, tasks: TaskConfig[], { t, tz }: Ctx): WorkHero {
  const n = res.tonightOk.length;
  const verdict =
    n === tasks.length
      ? t.goTonight
      : n > 0
        ? t.goTonightOnly(res.tonightOk.map((k) => tasks[k]!.name.toLowerCase()).join(", "))
        : res.days[0]?.passed
          ? t.passedToday
          : t.notTonight;
  return {
    ok: n > 0,
    verdict,
    tasks: tasks.map((task, k) => {
      const v = res.tasks[k]!;
      const nd = v.nextIdx >= 0 ? res.days[v.nextIdx] : undefined;
      const ld = v.longestIdx >= 0 ? res.days[v.longestIdx] : undefined;
      const need =
        task.after === undefined
          ? t.needDry(task.max_wet)
          : t.needDryAfter(task.max_wet, task.after);
      if (!nd) return { need, when: null, detail: t.noDayMeets };
      let detail = t.wetAtOpen(nd.wetAtStart.toFixed(1));
      if (task.after !== undefined) detail += t.afterPart(hLabel(nd.after, CAP, t.hUnit));
      detail += t.ofLight(durLabel(nd.hours, t.hUnit));
      if (ld && ld !== nd) detail += t.longestPart(ld.full, durLabel(ld.hours, t.hUnit));
      const when = `${nd.isToday ? t.tonight : nd.full} · ${hm(nd.effStart!, tz)}–${hm(nd.end!, tz)}`;
      return { need, when, detail };
    }),
  };
}

/** "21:00" on the window's day, "Fri 11:00" later, "—" never. */
export function dryTime(at: number | null, d: WorkDay, { t, tz, short }: Ctx): string {
  if (at === null) return t.dash;
  const p = localParts(at, tz);
  return p.key === d.key ? hm(at, tz) : `${short[p.wd]} ${hm(at, tz)}`;
}

/** Dry-by tooltip: one line per task. */
export function dryByLines(d: WorkDay, tasks: TaskConfig[], ctx: Ctx): string[] {
  const { t } = ctx;
  return tasks.map((task, k) =>
    d.wetAtStart <= task.max_wet
      ? t.dryByOk(task.name)
      : d.dryAt[k] == null
        ? t.dryByNever(task.name)
        : t.dryByLater(task.name, dryTime(d.dryAt[k]!, d, ctx)),
  );
}

/** Dry-after runway against the strictest `after`: full, half-way, short, or no task needs one. */
export function runwayBand(after: number, tasks: TaskConfig[]): "full" | "half" | "short" | "none" {
  const afters = tasks.map((task) => task.after).filter((x): x is number => x !== undefined);
  if (!afters.length) return "none";
  const need = Math.max(...afters);
  return after >= need ? "full" : after >= need / 2 ? "half" : "short";
}

/** Window cell label: rain inside, passed, its length, or too dark. */
export function windowLabel(d: WorkDay, t: Strings): string {
  return d.during
    ? t.rowRain
    : d.passed
      ? t.rowPassed
      : d.hours > 0
        ? durLabel(d.hours, t.hUnit)
        : t.rowDark;
}
