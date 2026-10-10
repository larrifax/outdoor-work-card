import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { PW_PORT } from "./test/playwright-docker.ts";
import { tap } from "./test/tap.ts";

// Shared by both browser projects.
const browser = {
  enabled: true,
  headless: true,
  viewport: { width: 1040, height: 1900 },
  instances: [{ browser: "chromium" as const }],
};

export default defineConfig({
  // Same NODE_ENV pin as the prod build: bundled deps guard on it and the
  // browser has no process.env, so prod branches must compile in.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  test: {
    // Git worktrees under .claude/worktrees carry their own test files;
    // don't run a sibling branch's suite from this checkout.
    exclude: ["**/node_modules/**", "**/dist/**", ".claude/worktrees/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "browser",
          exclude: [
            "**/node_modules/**",
            "**/dist/**",
            ".claude/worktrees/**",
            "test/**/*.visual.test.ts",
          ],
          browser: {
            ...browser,
            // hasTouch lets the tap command send real touch input; mouse input is unaffected.
            provider: playwright({ contextOptions: { hasTouch: true } }),
            commands: { tap },
          },
        },
      },
      {
        // Pixel baselines need identical fonts/rendering on every host, so Chromium
        // runs in the official Playwright image; globalSetup starts it.
        extends: true,
        test: {
          name: "visual",
          include: ["test/**/*.visual.test.ts"],
          globalSetup: ["test/playwright-docker.ts"],
          browser: {
            ...browser,
            provider: playwright({
              connectOptions: {
                wsEndpoint: `ws://127.0.0.1:${PW_PORT}/`,
                // Route the browser's localhost (Vite server) back through this connection.
                exposeNetwork: "<loopback>",
              },
            }),
            expect: {
              toMatchScreenshot: {
                // Rendering is pinned by the container, so one baseline per name, not per host OS.
                resolveScreenshotPath: ({
                  root,
                  testFileDirectory,
                  screenshotDirectory,
                  arg,
                  ext,
                }) => `${root}/${testFileDirectory}/${screenshotDirectory}/${arg}${ext}`,
              },
            },
          },
        },
      },
    ],
  },
});
