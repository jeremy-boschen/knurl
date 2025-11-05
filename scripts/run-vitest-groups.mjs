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

function parseNonNegativeInt(raw, label) {
  if (raw === undefined) {
    return undefined
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    console.error(`${label} must be a non-negative integer. Received: ${raw}`)
    process.exit(1)
  }
  return value
}

const rawCliArgs = process.argv.slice(2)
const forwardCliArgs = []
const envMaxWorkers = parseNonNegativeInt(process.env.VITEST_MAX_WORKERS, "VITEST_MAX_WORKERS")
let maxWorkers = envMaxWorkers ?? 1

for (let i = 0; i < rawCliArgs.length; i += 1) {
  const arg = rawCliArgs[i]
  if (arg === "--maxWorkers" || arg === "--max-workers") {
    const next = rawCliArgs[i + 1]
    if (next === undefined) {
      console.error(`${arg} requires a value`)
      process.exit(1)
    }
    const parsed = parseNonNegativeInt(next, arg)
    if (parsed === undefined || parsed === 0) {
      console.error(`${arg} must be a positive integer. Received: ${next}`)
      process.exit(1)
    }
    maxWorkers = parsed
    i += 1
    continue
  }
  if (arg.startsWith("--maxWorkers=") || arg.startsWith("--max-workers=")) {
    const [flag, value] = arg.split("=")
    const parsed = parseNonNegativeInt(value, flag)
    if (parsed === undefined || parsed === 0) {
      console.error(`${flag} must be a positive integer. Received: ${value}`)
      process.exit(1)
    }
    maxWorkers = parsed
    continue
  }
  forwardCliArgs.push(arg)
}

if (maxWorkers <= 0) {
  maxWorkers = 1
}

const offset = parseNonNegativeInt(process.env.VITEST_OFFSET, "VITEST_OFFSET") ?? 0
if (offset >= testFiles.length) {
  console.warn(`Offset ${offset} exceeds test file count (${testFiles.length}). Nothing to run.`)
  process.exit(0)
}

const limitEnv = process.env.VITEST_LIMIT
const limitValue = parseNonNegativeInt(limitEnv, "VITEST_LIMIT")
const limit = limitValue === undefined ? testFiles.length - offset : limitValue
const selected = testFiles.slice(offset, Math.min(testFiles.length, offset + limit))

if (selected.length === 0) {
  console.warn(`No test files selected for offset ${offset} limit ${limitEnv ?? "(all)"}`)
  process.exit(0)
}

const chunkSize = parseNonNegativeInt(process.env.VITEST_CHUNK_SIZE, "VITEST_CHUNK_SIZE") ?? 1
if (chunkSize === 0) {
  console.warn("Chunk size of 0 results in no tests being executed. Set VITEST_CHUNK_SIZE >= 1.")
  process.exit(0)
}

console.log(
  `[vitest-groups] selected ${selected.length}/${testFiles.length} tests (offset=${offset}, limit=${
    limitValue ?? "all"
  }, chunkSize=${chunkSize}, maxWorkers=${maxWorkers})`,
)

for (let i = 0; i < selected.length; i += chunkSize) {
  const chunk = selected.slice(i, i + chunkSize)
  const args = [
    vitestBin,
    "run",
    "--pool",
    "threads",
    "--max-workers",
    String(maxWorkers),
    ...forwardCliArgs,
    ...chunk,
  ]
  const selectedIndex = offset + i
  console.log(`[vitest-chunk] running index ${selectedIndex} files ${chunk.join(", ")}`)
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
}
