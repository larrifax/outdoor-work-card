// Browser command: a real touch tap (touchstart/pointerdown with pointerType "touch") via
// Playwright, which userEvent can't do. Needs a context created with hasTouch.
import type { BrowserCommand } from "vitest/node";

export const tap: BrowserCommand<[selector: string]> = async (ctx, selector) => {
  if (ctx.provider.name !== "playwright") throw new Error("tap needs the playwright provider");
  await ctx.iframe.locator(selector).tap();
};

declare module "vitest/browser" {
  interface BrowserCommands {
    tap: (selector: string) => Promise<void>;
  }
}
