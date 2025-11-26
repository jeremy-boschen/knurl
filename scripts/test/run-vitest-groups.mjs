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

const testFiles = collectTests(join(projectRoot, "src-ui", "src")).sort((a, b) => a.localeCompare(b))
if (testFiles.length === 0) {
  console.error("No test files found under src-ui/src/")
  process.exit(1)
}

const rawCliArgs = process.argv.slice(2)

// Coverage configuration is defined in vitest.config.ts
// This script just runs vitest with the collected test files
const args = [
  vitestBin,
  "run",
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
