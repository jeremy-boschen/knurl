#!/usr/bin/env node

import coverageLib from 'istanbul-lib-coverage'
import istanbulApi from 'istanbul-api'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { createCoverageMap } = coverageLib
const { createReporter } = istanbulApi

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const map = createCoverageMap({})
let mergedCount = 0

// Load unit test coverage if it exists
const unitCoveragePath = path.join(projectRoot, 'coverage', 'coverage-final.json')
if (fs.existsSync(unitCoveragePath)) {
  try {
    const unitCoverage = JSON.parse(fs.readFileSync(unitCoveragePath, 'utf-8'))
    map.merge(unitCoverage)
    mergedCount++
    console.log(`✓ Loaded unit test coverage from ${path.relative(projectRoot, unitCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load unit test coverage: ${error.message}`)
  }
}

// Load E2E coverage if it exists
const e2eCoveragePath = path.join(projectRoot, 'coverage', 'e2e-coverage.json')
if (fs.existsSync(e2eCoveragePath)) {
  try {
    const e2eCoverage = JSON.parse(fs.readFileSync(e2eCoveragePath, 'utf-8'))
    map.merge(e2eCoverage)
    mergedCount++
    console.log(`✓ Loaded E2E coverage from ${path.relative(projectRoot, e2eCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load E2E coverage: ${error.message}`)
  }
}

if (mergedCount === 0) {
  console.warn('⚠ No coverage files found to merge')
  console.warn(`  Expected paths:`)
  console.warn(`  - ${path.relative(projectRoot, unitCoveragePath)}`)
  console.warn(`  - ${path.relative(projectRoot, e2eCoveragePath)}`)
  process.exit(0)
}

// Generate merged report
try {
  const reporter = createReporter()
  reporter.addAll(['json', 'lcov', 'text', 'html'])

  const mergedCoveragePath = path.join(projectRoot, 'coverage', 'merged')
  reporter.write(map)

  console.log(`\n✓ Generated merged coverage report`)
  console.log(`  Reports available in: ${path.relative(projectRoot, path.join(projectRoot, 'coverage'))}`)
  console.log(`  - HTML: coverage/index.html`)
  console.log(`  - LCOV: coverage/lcov.info`)
} catch (error) {
  console.error(`✗ Failed to generate merged coverage report: ${error.message}`)
  process.exit(1)
}
