import { test, expect } from "vitest";
import { mountThemed } from "./harness";

// Visible text + tooltips of every card: refactors must not change what the cards say.
// Looks are covered by cards.visual.test.ts; text is the same in both themes.
test("card text", async () => {
  const host = await mountThemed("dark");
  const text = [...host.querySelectorAll("outdoor-work-card")].map((c) =>
    (c.shadowRoot!.textContent ?? "").replace(/\s+/g, " ").trim(),
  );
  expect(text).toMatchSnapshot();
  host.remove();
});
