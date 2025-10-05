/// <reference types="@vitest/browser/providers/playwright" />
import { defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config"

const coverageEnabled = process.env.VITEST_COVERAGE === "true"

export default mergeConfig(viteConfig, defineConfig({
  test: {
    pool: "forks",
    fileParallelism: false,
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    threads: {
      maxThreads: 1,
      minThreads: 1,
    },
    coverage: {
      enabled: coverageEnabled,
      provider: "v8",
      reporter: ["text", "html"],
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
    },
    poolOptions: {
      forks: {
        execArgv: ["--max-old-space-size=4096"],
      },
    },
    browser: {
      enabled: false,
      provider: "playwright",
      instances: [
        { browser: "chromium" },
      ],
    },
  },
}))
