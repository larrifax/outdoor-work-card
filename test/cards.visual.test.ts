import { test, expect } from "vitest";
import { userEvent, type Locator } from "vitest/browser";
import { CARDS, THEMES, mountCard, type CardName, type Theme } from "./harness";

// Pixel baselines; run via `pnpm test:visual` so Chromium comes from the pinned Docker image.
const cards = Object.keys(CARDS) as CardName[];
const themes = Object.keys(THEMES) as Theme[];

// One test per card and theme, so a diff names only the cards it touches.
for (const name of cards)
  for (const theme of themes)
    test(`${name} card looks right in ${theme} mode`, async () => {
      const frame = await mountCard(name, theme);
      await expect.element(frame).toMatchScreenshot(`${name}-${theme}`);
    });

// Popovers are shot on their own (element only), so card changes outside a popover don't fail these.
// Clicking a "How … judged" button opens a dialog; hovering a trigger opens its hint tooltip.
const click = (name: string) => async (frame: Locator) => {
  await userEvent.click(frame.getByRole("button", { name }));
  return frame.getByRole("dialog");
};
const hover = (name: string | RegExp) => async (frame: Locator) => {
  const trigger = frame.getByRole("button", { name }).first();
  await userEvent.hover(trigger);
  return trigger.getByRole("tooltip");
};
const POPOVERS: [card: CardName, popover: string, open: (frame: Locator) => Promise<Locator>][] = [
  ["work", "info", click("How days are judged")],
  ["carwash", "info", click("How evenings are judged")],
  // Today's dangerous 17:00 hour, then Monday's day popover (outlook, warm layer).
  ["commute", "hour-popover", hover("Home 17:00")],
  ["commute", "day-popover", hover(/^Monday 21: /)],
];

for (const [name, popover, open] of POPOVERS)
  for (const theme of themes)
    test(`${name} ${popover} looks right in ${theme} mode`, async () => {
      const tip = await open(await mountCard(name, theme));
      await expect.element(tip).toBeVisible();
      await expect.element(tip).toMatchScreenshot(`${name}-${popover}-${theme}`);
    });
