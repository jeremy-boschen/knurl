#!/usr/bin/env node
import { readdirSync, statSync } from "node:fs"
import { join, extname } from "node:path"
import { spawnSync } from "node:child_process"

const projectRoot = process.cwd()
const vitestBin = join(projectRoot, "node_modules", "vitest", "vitest.mjs")

function collectTests(dir) {
  const entries = readdirSync(dir)
  const results = []
  for (const entry of entries) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") {
        continue
      }
      results.push(...collectTests(full))
      continue
    }
    const ext = extname(entry)
    if (!ext) {
      continue
    }
    if (/\.test\.(ts|tsx)$/i.test(entry)) {
      results.push(full)
    }
  }
  return results
}

const testFiles = collectTests(join(projectRoot, "src")).sort((a, b) => a.localeCompare(b))
if (testFiles.length === 0) {
  console.error("No test files found under src/")
  process.exit(1)
}

const rawCliArgs = process.argv.slice(2)

// When collecting coverage, we need to disable inline coverage reporting
// and only generate the final report after all tests complete
const isCoverageMode = process.env.VITEST_COVERAGE === "true"
const coverageArgs = isCoverageMode ? ["--coverage.reporter=json", "--coverage.reporter=lcov"] : []

const args = [
  vitestBin,
  "run",
  ...coverageArgs,
  ...rawCliArgs,
  ...testFiles,
]

const result = spawnSync(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    VITEST_COVERAGE: process.env.VITEST_COVERAGE ?? "false",
  },
})

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
