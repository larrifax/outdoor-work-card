import { test, expect } from "vitest";
import { page } from "vitest/browser";
import { mountThemed } from "./harness";

for (const theme of ["dark", "light"] as const) {
  test(`renders and screenshots all cards in ${theme} mode`, async () => {
    const host = await mountThemed(theme);
    const cards = host.querySelectorAll("outdoor-work-card");
    expect(cards.length).toBe(6);
    // Each card should have rendered its ha-card shell.
    for (const card of cards) {
      expect(card.shadowRoot?.querySelector("ha-card"), "ha-card mounted").toBeTruthy();
    }

    // Design F: footer removed; provenance cluster (timestamp) in the header on every card.
    for (const card of cards) {
      const root = card.shadowRoot!;
      expect(root.querySelector(".foot"), "no footer element").toBeNull();
      expect(root.querySelector(".prov .ts"), "timestamp present").toBeTruthy();
    }

    // Popover forced open on work (idx 0) and carwash (idx 3): config-derived rules.
    const workPop = cards[0]!.shadowRoot!.querySelector("#owc-pop")!;
    expect(workPop, "work popover open").toBeTruthy();
    const workKeys = [...workPop.querySelectorAll(".grid .k")].map((k) => k.textContent?.trim());
    expect(workKeys).toContain("Weekday window");
    expect(workKeys).toContain("Mow"); // default task listed
    expect(workPop.querySelector(".src")?.textContent).toContain("MET Nordic 1 km");

    const washPop = cards[3]!.shadowRoot!.querySelector("#owc-pop")!;
    expect(washPop, "carwash popover open").toBeTruthy();
    const washVals = [...washPop.querySelectorAll(".grid .v")].map((v) => v.textContent?.trim());
    expect(
      washVals.some((v) => v?.includes("0.2 mm/h")),
      "ok_rain in popover",
    ).toBe(true);
    expect(washPop.querySelector(".note")?.textContent).toContain("salted");

    // Dry-by column: ✓ on good days, a waiting task on wet ones, "—" when never dry.
    const cells = (i: number) =>
      [...cards[i]!.shadowRoot!.querySelectorAll(".dryby .num")].map((n) => n.textContent?.trim());
    expect(cells(0)).toContain("✓");
    expect(cells(0).some((c) => /^Paint \d\d:\d\d$/.test(c ?? ""))).toBe(true);
    expect(cells(1)).toContain("Paint —");

    // Design E hero states: wash-tonight card (idx 2) vs a skip card (idx 3).
    const okRoot = cards[2]!.shadowRoot!;
    expect(okRoot.querySelector(".alert"), "no banner when tonight is the pick").toBeNull();
    expect(okRoot.querySelector(".hero.rec"), "ok hero not tinted as recommendation").toBeNull();
    expect(okRoot.querySelector(".hero.ok .cap")?.textContent?.trim()).toBe("Best evening to wash");
    expect(okRoot.querySelector(".hero.ok .tradeoff"), "no trade-off in ok state").toBeNull();

    const skipRoot = cards[3]!.shadowRoot!;
    expect(skipRoot.querySelector(".alert .lbl")?.textContent?.trim()).toBe("Skip today");
    expect(skipRoot.querySelector(".hero.rec .cap")?.textContent?.trim()).toBe("Wash on");
    expect(
      skipRoot.querySelector(".hero.rec .tradeoff strong.gain"),
      "gain is bold + accent",
    ).toBeTruthy();

    // Commute card (idx 5): F today, a flagged midday, effective-wind tiles.
    const cRoot = cards[5]!.shadowRoot!;
    // Row badges hold the grade letter as a text node; the day popover sits inside the badge.
    const letter = (b: Element) =>
      [...b.childNodes]
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent)
        .join("")
        .trim();
    expect([...cRoot.querySelectorAll(".crow > .gbadge")].map(letter)).toEqual([
      "F",
      "B",
      "D",
      "C",
      "A",
    ]);
    expect(cRoot.querySelector(".chero.f .cap")?.textContent?.trim()).toBe("Dangerous to ride");
    // Thu wet midday + Tue snowy midday.
    expect(cRoot.querySelectorAll(".mid.flag").length).toBe(2);
    expect(cRoot.querySelectorAll(".tile.l3").length).toBe(1);
    // Winter: Mon 08 snowy tile (cm), icy badges on Mon 08 and Tue 07/08 without changing grades.
    const tips = [...cRoot.querySelectorAll(".tile .tip")].map((v) => v.textContent ?? "");
    expect(tips.some((x) => /Snow\s*0\.5\s*cm/.test(x))).toBe(true);
    expect(cRoot.querySelectorAll(".tile.icy").length).toBe(3);
    expect(cRoot.querySelector(".tile.icy .tip .hp-icy")?.textContent).toContain("wet earlier");
    // Clothing: hero shows the day plan; every outlook row gets the icon and every badge a day popover.
    expect(cRoot.querySelector(".chero:not(.mini) .cloth")).toBeTruthy();
    expect(cRoot.querySelectorAll(".crow > .gbadge > .tip.dp").length).toBe(5);

    // Every card's visible text + tooltips: refactors must not change what the card says.
    const text = [...cards].map((c) =>
      (c.shadowRoot!.textContent ?? "").replace(/\s+/g, " ").trim(),
    );
    expect(text).toMatchSnapshot();

    await page.screenshot({ element: host, path: `__screenshots__/cards-${theme}.png` });

    // Commute popovers open: today's dangerous 17:00 hour, then Monday's day popover (outlook, warm layer).
    // Hint popovers close each other, so one capture each: the commute card alone, with room above for the popover.
    for (const c of cards) if (c !== cards[5]) (c as HTMLElement).style.display = "none";
    (cards[5] as HTMLElement).style.paddingTop = "300px";
    const open = async (el: Element | undefined, name: string) => {
      const tip = (el as HTMLElement).querySelector<HTMLElement>(":scope > .tip")!;
      tip.showPopover();
      await new Promise((r) => setTimeout(r, 250));
      await page.screenshot({ element: host, path: `__screenshots__/${name}-${theme}.png` });
      tip.hidePopover();
    };
    const tiles = cRoot.querySelectorAll(".crow:first-child .tile");
    await open(tiles[3], "hour-popover");
    await open(cRoot.querySelectorAll(".crow > .gbadge")[3], "day-popover");
  });
}
