import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

export default defineConfig({
  // Same NODE_ENV pin as the prod build: bundled deps guard on it and the
  // browser has no process.env, so prod branches must compile in.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  test: {
    // Git worktrees under .claude/worktrees carry their own test files;
    // don't run a sibling branch's suite from this checkout.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/worktrees/**"],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      viewport: { width: 1040, height: 1700 },
      instances: [{ browser: "chromium" }],
    },
  },
});
