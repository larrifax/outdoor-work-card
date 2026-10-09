import { test, expect } from "vitest";
import { page } from "vitest/browser";
import { mountThemed } from "./harness";

// Pixel baselines; run via `pnpm test:visual` so Chromium comes from the pinned Docker image.
for (const theme of ["dark", "light"] as const) {
  test(`cards look right in ${theme} mode`, async () => {
    const host = await mountThemed(theme);
    const shot = (name: string) =>
      expect.element(page.elementLocator(host)).toMatchScreenshot(`${name}-${theme}`);
    await shot("cards");

    // Commute popovers open: today's dangerous 17:00 hour, then Monday's day popover (outlook, warm layer).
    // Hint popovers close each other, so one capture each: the commute card alone, with room above for the popover.
    const cards = host.querySelectorAll<HTMLElement>("outdoor-work-card");
    for (const c of cards) if (c !== cards[5]) c.style.display = "none";
    cards[5]!.style.paddingTop = "300px";
    const cRoot = cards[5]!.shadowRoot!;
    const open = async (el: Element | undefined, name: string) => {
      const tip = (el as HTMLElement).querySelector<HTMLElement>(":scope > .tip")!;
      tip.showPopover();
      await new Promise((r) => setTimeout(r, 250));
      await shot(name);
      tip.hidePopover();
    };
    await open(cRoot.querySelectorAll(".crow:first-child .tile")[3], "hour-popover");
    await open(cRoot.querySelectorAll(".crow > .gbadge")[3], "day-popover");
    host.remove();
  });
}
