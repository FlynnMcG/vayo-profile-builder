import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Evals call the real model, so they're kept out of `npm test`.
// Run with `npm run eval`.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("./test/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["evals/**/*.eval.ts"],
    setupFiles: ["evals/setup.ts"],
    testTimeout: 120_000,
    // One scenario at a time keeps provider rate limits happy.
    fileParallelism: false,
  },
});
