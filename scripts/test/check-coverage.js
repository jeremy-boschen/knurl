#!/usr/bin/env node
/**
 * Check coverage thresholds against coverage-final.json
 * Exit with code 1 if thresholds are not met
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const THRESHOLDS = {
  lines: 70,
  functions: 70,
  branches: 65,
  statements: 70,
}

const coveragePath = path.join(__dirname, '../../coverage/coverage-summary.json')
const coberturaMergedPath = path.join(__dirname, '../../coverage/coverage-merged.xml')

if (!fs.existsSync(coveragePath)) {
  // Check if we have Cobertura XML instead (from partial test runs)
  if (fs.existsSync(coberturaMergedPath)) {
    console.log('ℹ Coverage summary not available for full threshold check')
    console.log('  (Only Cobertura XML available from partial test run)')
    console.log(`  For full coverage report, run: yarn test`)
    process.exit(0)
  }

  console.error('❌ Coverage summary not found')
  console.log(`  Expected: ${coveragePath}`)
  console.log(`  Run: yarn test or yarn test:unit`)
  process.exit(1)
}

try {
  const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'))
  
  // coverage-summary.json has a 'total' key with the aggregated stats
  if (!coverage.total) {
    console.error('❌ Invalid coverage summary format: missing "total" property')
    process.exit(1)
  }

  const results = {}
  let allPass = true

  Object.keys(THRESHOLDS).forEach(key => {
    const metric = coverage.total[key]
    if (!metric) {
      console.warn(`⚠ Metric '${key}' not found in coverage summary`)
      return
    }
    
    const pct = metric.pct
    results[key] = pct

    if (pct < THRESHOLDS[key]) {
      allPass = false
    }
  })

  // Print results
  console.log('\n📊 Coverage Report:')
  console.log('─'.repeat(50))

  Object.entries(results).forEach(([key, pct]) => {
    const threshold = THRESHOLDS[key]
    const status = pct >= threshold ? '✓' : '✗'
    const color = pct >= threshold ? '\x1b[32m' : '\x1b[31m'
    const reset = '\x1b[0m'
    console.log(`${status} ${key.padEnd(12)} ${color}${pct}%${reset} (threshold: ${threshold}%)`)
  })

  console.log('─'.repeat(50))

  if (!allPass) {
    console.error('\n❌ Coverage below thresholds!')
    console.error('Run: yarn test to generate full coverage')
    console.error('Then add more tests to improve coverage.\n')
    process.exit(1)
  }

  console.log('\n✓ All coverage thresholds met!\n')
  process.exit(0)
} catch (error) {
  console.error('Error reading coverage:', error.message)
  process.exit(1)
}
