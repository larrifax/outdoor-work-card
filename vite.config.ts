import { defineConfig } from "vite";

export default defineConfig({
  // Bundled deps guard on process.env.NODE_ENV, which doesn't exist in the
  // browser; pin it so prod branches compile and dev checks drop out.
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    // HA targets modern browsers; this matches its own baseline.
    target: ["chrome111", "edge111", "firefox111", "safari16"],
    minify: true,
    lib: {
      entry: "src/outdoor-work-card.ts",
      formats: ["es"],
      fileName: () => "outdoor-work-card.js",
    },
    rollupOptions: {
      // Single self-contained file so HACS serves one asset (lit bundled in).
      output: { codeSplitting: false },
    },
  },
});
