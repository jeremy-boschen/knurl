/// <reference types="@vitest/browser/providers/playwright" />
import {defineConfig, mergeConfig} from "vitest/config"
import viteConfig from "./vite.config"
import {playwright} from "@vitest/browser-playwright";

const coverageEnabled = process.env.VITEST_COVERAGE === "true"
const maxWorkers = process.env.VITEST_MAX_WORKERS ? parseInt(process.env.VITEST_MAX_WORKERS, 10) : 16

export default mergeConfig(viteConfig, defineConfig({
  test: {
    pool: "threads",
    fileParallelism: true,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src-ui/test/setup.ts"],
    include: ["src-ui/src/**/*.test.{ts,tsx}"],
    coverage: {
      enabled: coverageEnabled,
      provider: "istanbul",
      reporter: coverageEnabled ? ["html", "json", "cobertura"] : [],
      reportsDirectory: "coverage",
      // Only consider coverage for source files under src-ui/src/
      all: false,
      include: [
        "src-ui/src/**/*.{ts,tsx}",
      ],
      exclude: [
        // Do not count test and story files toward coverage
        "src-ui/test/**",
        "src-ui/src/**/*.test.*",
        "src-ui/src/**/__tests__/**",
        "src-ui/src/**/stories/**",
        "src-ui/src/**/*.stories.*",
        // Exclude shadcn components
        "src-ui/src/components/ui/*.tsx",
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
