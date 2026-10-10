import { test, expect } from "vitest";
import { userEvent } from "vitest/browser";
import { CARDS, mountCard, type CardName } from "./harness";

const text = (el: Element | ShadowRoot) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

// Visible text + tooltips of each card, then of its "How … judged" popover: refactors must not
// change what the cards say. Looks are covered by cards.visual.test.ts; text is the same in both themes.
for (const name of Object.keys(CARDS) as CardName[])
  test(`${name} card text`, async () => {
    const frame = await mountCard(name);
    expect(text(frame.element().firstElementChild!.shadowRoot!)).toMatchSnapshot();
    await userEvent.click(frame.getByRole("button", { name: /^How / }));
    expect(text(frame.getByRole("dialog").element()), "info popover").toMatchSnapshot();
  });
