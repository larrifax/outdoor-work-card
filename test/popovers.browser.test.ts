import { test, expect } from "vitest";
import { commands, page, userEvent, type Locator } from "vitest/browser";
import { mountThemed } from "./harness";

// Every kind of hint-popover trigger, each opened by keyboard, hover, click and touch.
const TRIGGERS: [kind: string, name: string | RegExp][] = [
  ["work dry-by cell", "Thu 17 Dry by"],
  ["wash day", /^Thu 17: /],
  ["wash outlook", "Thu 17 Outlook"],
  ["commute hour tile", "Home 17:00"],
  ["commute grade badge", /^Monday 21: /],
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

for (const [kind, name] of TRIGGERS)
  for (const [how, open] of Object.entries(OPENERS))
    test(`${kind} popover opens on ${how}`, async () => {
      await mountThemed("dark", { info: false });
      // Rows run today first; .first() picks the first card/row with that name.
      const trigger = page.getByRole("button", { name }).first();
      // A closed popover is outside the accessibility tree; includeHidden still finds it.
      const tip = trigger.getByRole("tooltip", { includeHidden: true });
      await expect.element(tip).not.toBeVisible();
      await open(trigger);
      await expect.element(tip).toBeVisible();
    });
