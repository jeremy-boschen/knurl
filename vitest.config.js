"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference types="@vitest/browser/providers/playwright" />
var config_1 = require("vitest/config");
var vite_config_1 = require("./vite.config");
exports.default = (0, config_1.mergeConfig)(vite_config_1.default, (0, config_1.defineConfig)({
    test: {
        environment: "jsdom",
        globals: true,
        setupFiles: ["src/test/setup.ts"],
        include: ["src/**/*.test.{ts,tsx}"],
        coverage: {
            provider: "v8",
            reporter: ["text", "html"],
            reportsDirectory: "coverage",
            // Only consider coverage for source files under src/
            all: true,
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
        browser: {
            enabled: false,
            provider: "playwright",
            instances: [
                { browser: "chromium" },
            ],
        },
    },
}));
