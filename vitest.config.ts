/// <reference types="@vitest/browser/providers/playwright" />
import {defineConfig, mergeConfig} from "vitest/config"
import viteConfig from "./vite.config"
import {playwright} from "@vitest/browser-playwright";

const coverageEnabled = process.env.VITEST_COVERAGE === "true"
const maxWorkers = process.env.VITEST_MAX_WORKERS ? parseInt(process.env.VITEST_MAX_WORKERS, 10) : 16

export default mergeConfig(viteConfig, defineConfig({
  test: {
    pool: "threads",
    fileParallelism: false,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      enabled: coverageEnabled,
      provider: "v8",
      reporter: coverageEnabled ? ["html", "json"] : [],
      reportsDirectory: "coverage",
      // Only consider coverage for source files under src/
      all: false,
      include: [
        "src/**/*.{ts,tsx}",
      ],
      exclude: [
        // Do not count test and story files toward coverage
        "src/test/**",
        "src/**/*.test.*",
        "src/**/__tests__/**",
        "src/**/stories/**",
        "src/**/*.stories.*",
        // Exclude shadcn components
        "src/components/ui/*.tsx",
        // Exclude generated or non-frontend code
        "src-tauri/**",
      ],
      // Minimum coverage thresholds (enforced on pre-push)
      lines: 70,
      functions: 70,
      branches: 65,
      statements: 70,
    },
    poolOptions: {
      threads: {
        maxThreads: maxWorkers,
        minThreads: 1,
      },
    },
    browser: {
      enabled: false,
      provider: playwright(),
      instances: [
        {browser: "chromium"},
      ],
    },
  },
}))
