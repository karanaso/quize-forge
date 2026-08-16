import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, "src") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          globals: true,
          restoreMocks: true,
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globals: true,
          testTimeout: 30_000,
          hookTimeout: 300_000,
          fileParallelism: false,
          globalSetup: "./tests/integration/setup.ts",
        },
      },
    ],
  },
});
