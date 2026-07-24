import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "e2e",
    environment: "node",
    globals: true,
    globalSetup: ["./tests/e2e/global-setup.ts"],
    setupFiles: ["./tests/e2e/setup.ts"],
    include: ["src/**/*.e2e-spec.ts"],
    exclude: ["node_modules/**", "dist/**", "coverage/**"],
    clearMocks: true,
    restoreMocks: true,
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
  },
});
