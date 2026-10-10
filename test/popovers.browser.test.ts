import { test, expect } from "vitest";
import { commands, userEvent, type Locator } from "vitest/browser";
import { mountCard, type CardName } from "./harness";

// Every kind of hint-popover trigger, each opened by keyboard, hover, click and touch.
const TRIGGERS: [kind: string, card: CardName, name: string | RegExp][] = [
  ["work dry-by cell", "work", "Thu 17 Dry by"],
  ["wash day", "carwash", /^Thu 17: /],
  ["wash outlook", "carwash", "Thu 17 Outlook"],
  ["commute hour tile", "commute", "Home 17:00"],
  ["commute grade badge", "commute", /^Monday 21: /],
];

const OPENERS: Record<string, (el: Locator) => Promise<unknown>> = {
  // Tab until focus lands on the trigger, so :focus-visible and focus handlers run as for a real user.
  keyboard: async (el) => {
    for (let i = 0; i < 200 && !el.element().matches(":focus"); i++) await userEvent.tab();
    expect(el.element().matches(":focus"), "reached by Tab").toBe(true);
  },
  hover: (el) => userEvent.hover(el),
  click: (el) => userEvent.click(el),
  touch: (el) => commands.tap(el.selector),
};

for (const [kind, card, name] of TRIGGERS)
  for (const [how, open] of Object.entries(OPENERS))
    test(`${kind} popover opens on ${how}`, async () => {
      const frame = await mountCard(card);
      // Rows run today first; .first() picks today's (or the first) match.
      const trigger = frame.getByRole("button", { name }).first();
      // A closed popover is outside the accessibility tree; includeHidden still finds it.
      const tip = trigger.getByRole("tooltip", { includeHidden: true });
      await expect.element(tip).not.toBeVisible();
      await open(trigger);
      await expect.element(tip).toBeVisible();
    });
