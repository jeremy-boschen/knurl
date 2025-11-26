#!/usr/bin/env node

/**
 * Unified Coverage Consolidation Pipeline
 *
 * This script consolidates the multi-layer coverage reporting by calling
 * the appropriate scripts in sequence:
 *
 * 1. merge-coverage.mjs   → Merge frontend (vitest) + backend (cargo) unit coverage
 * 2. aggregate-e2e-coverage.mjs → Aggregate WebDriver.io E2E test coverage
 * 3. check-coverage.js    → Validate coverage against configured thresholds
 *
 * This is typically called by `yarn test` or `yarn test:unit` after
 * unit and/or E2E tests have completed.
 *
 * Usage: node scripts/consolidate-coverage.mjs
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

const scripts = [
  {
    name: 'Merge Unit Coverage',
    script: 'merge-coverage.mjs',
    condition: () => existsSync(path.join(projectRoot, 'coverage', 'coverage-final.json')),
  },
  {
    name: 'Aggregate E2E Coverage',
    script: 'aggregate-e2e-coverage.mjs',
    condition: () => existsSync(path.join(projectRoot, '.nyc_output')),
  },
  {
    name: 'Check Coverage Thresholds',
    script: 'check-coverage.js',
    required: true,
  },
]

console.log('\n' + '='.repeat(60))
console.log('Coverage Consolidation Pipeline')
console.log('='.repeat(60) + '\n')

let hasErrors = false

for (const { name, script, condition, required } of scripts) {
  const shouldRun = condition ? condition() : true

  if (!shouldRun && !required) {
    console.log(`⊘ ${name}: skipped (no coverage data generated)`)
    continue
  }

  try {
    console.log(`→ ${name}...`)
    execSync(`node "${path.join(__dirname, script)}"`, {
      stdio: 'inherit',
      cwd: projectRoot,
    })
    console.log(`✓ ${name}: completed\n`)
  } catch (error) {
    console.error(`✗ ${name}: failed\n`)
    hasErrors = true
    if (required) {
      break
    }
  }
}

console.log('='.repeat(60))
if (hasErrors) {
  console.error('Coverage consolidation failed')
  process.exit(1)
} else {
  console.log('Coverage consolidation complete!')
  console.log('📊 View coverage report: coverage/index.html')
  console.log('='.repeat(60) + '\n')
}
