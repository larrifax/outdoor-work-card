import { test, expect } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import { CARDS, THEMES, mountCard, type CardName, type Theme } from "./harness";

// Clicking the "How … judged" button opens a dialog; hovering a trigger opens its hint tooltip.
const click = (name: string) => async (frame: Locator) => {
  const btn = frame.getByRole("button", { name });
  await userEvent.click(btn);
  await expect.element(frame.getByRole("dialog")).toBeVisible();
  return () => userEvent.click(btn);
};
const hover = (name: string | RegExp) => async (frame: Locator) => {
  const target = frame.getByRole("button", { name }).first();
  await userEvent.hover(target);
  await expect.element(frame.getByRole("tooltip")).toBeVisible();
  return () => userEvent.unhover(target);
};

// Popover states captured after each card's plain shot, keyed by baseline suffix.
const STATES: Partial<Record<CardName, Record<string, ReturnType<typeof click>>>> = {
  work: { info: click("How days are judged") },
  carwash: { info: click("How evenings are judged") },
  // Today's dangerous 17:00 hour, then Monday's day popover (outlook, warm layer).
  commute: { "hour-popover": hover("Home 17:00"), "day-popover": hover(/^Monday 21: /) },
};

// Pixel baselines, one test per card and theme; run via `pnpm test:visual` so Chromium comes from the pinned Docker image.
for (const name of Object.keys(CARDS) as CardName[])
  for (const theme of Object.keys(THEMES) as Theme[])
    test(`${name} card looks right in ${theme} mode`, async () => {
      const frame = await mountCard(name, theme);
      await expect.element(frame).toMatchScreenshot(`${name}-${theme}`);
      for (const [state, open] of Object.entries(STATES[name] ?? {})) {
        const close = await open(frame);
        await expect.element(frame).toMatchScreenshot(`${name}-${state}-${theme}`);
        await close();
      }
    });
