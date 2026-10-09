import { test, expect } from "vitest";
import { page, userEvent } from "vitest/browser";
import { mountThemed } from "./harness";

// Pixel baselines; run via `pnpm test:visual` so Chromium comes from the pinned Docker image.
for (const theme of ["dark", "light"] as const) {
  test(`cards look right in ${theme} mode`, async () => {
    const grid = await mountThemed(theme);
    await expect.element(grid).toMatchScreenshot(`cards-${theme}`);

    // Commute popovers: today's dangerous 17:00 hour, then Monday's day popover (outlook, warm layer).
    // The commute card alone, with room above for the popover.
    const commute = grid.element().lastElementChild as HTMLElement;
    const host = grid.element() as HTMLElement;
    host.replaceChildren(commute);
    commute.style.paddingTop = "300px";
    // Rows run today first, so .first() is today's hour.
    const open = async (name: string | RegExp, shot: string) => {
      const target = page.getByRole("button", { name }).first();
      await userEvent.hover(target);
      await expect.element(page.getByRole("tooltip")).toBeVisible();
      await expect.element(grid).toMatchScreenshot(`${shot}-${theme}`);
      await userEvent.unhover(target);
    };
    await open("Home 17:00", "hour-popover");
    await open(/^Monday 21:/, "day-popover");
  });
}
