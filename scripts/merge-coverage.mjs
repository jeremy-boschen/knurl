#!/usr/bin/env node

import coverageLib from 'istanbul-lib-coverage'
import istanbulApi from 'istanbul-api'
import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

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

// Note: Rust coverage from cargo-llvm-cov is kept in rust-lcov.info file separately
// Both frontend (lcov.info) and backend (rust-lcov.info) LCOV files are available in coverage/
const rustCoveragePath = path.join(projectRoot, 'coverage', 'rust-coverage.json')
if (fs.existsSync(rustCoveragePath)) {
  try {
    const rustCoverage = JSON.parse(fs.readFileSync(rustCoveragePath, 'utf-8'))
    map.merge(rustCoverage)
    mergedCount++
    console.log(`✓ Loaded Rust coverage from ${path.relative(projectRoot, rustCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load Rust coverage: ${error.message}`)
  }
} else {
  const rustLcovPath = path.join(projectRoot, 'coverage', 'rust-lcov.info')
  if (fs.existsSync(rustLcovPath)) {
    console.log(`ℹ Rust coverage available in ${path.relative(projectRoot, rustLcovPath)} (LCOV format, not merged)`)
  }
}

if (mergedCount === 0) {
  console.warn('⚠ No coverage files found to merge')
  console.warn(`  Expected paths:`)
  console.warn(`  - ${path.relative(projectRoot, unitCoveragePath)}`)
  console.warn(`  - ${path.relative(projectRoot, e2eCoveragePath)}`)
  console.warn(`  - ${path.relative(projectRoot, rustCoveragePath)}`)
  process.exit(0)
}

// Normalize all paths in the map to forward slashes to ensure consistent sorting
// istanbul-lib-coverage doesn't expose a direct way to mutate keys, 
// so we have to iterate and rebuild if necessary, or trust that the reporter handles it if keys match.
// However, standard reporters sort based on the file path string. 
// If we have mixed separators, sorting is broken.
const files = map.files();
files.forEach(file => {
  const fc = map.fileCoverageFor(file);
  const normalizedPath = file.split(path.sep).join('/');
  
  // If path changed (was backslash), update it
  if (file !== normalizedPath) {
    fc.data.path = normalizedPath;
    // We can't easily remove/add keys to the map instance without private access or creating a new map.
    // But for reporting, often the 'path' property in data is used. 
    // Let's try to force it.
  }
});
// To be safe, let's create a NEW map with normalized keys
const normalizedMap = createCoverageMap({});
files.forEach(file => {
  const fc = map.fileCoverageFor(file);
  const data = JSON.parse(JSON.stringify(fc.data)); // Deep copy
  data.path = data.path.split(path.sep).join('/'); // Normalize path property
  normalizedMap.addFileCoverage(data); // Add with normalized path
});

// Generate merged reports
try {
  // Determine reporters from env or default
  const requestedReporters = process.env.COVERAGE_REPORTERS 
    ? process.env.COVERAGE_REPORTERS.split(',').map(r => r.trim())
    : ['json', 'json-summary', 'lcov', 'text', 'text-summary', 'html']

  const reporter = createReporter()
  reporter.addAll(requestedReporters)

  const mergedCoveragePath = path.join(projectRoot, 'coverage', 'merged')
  reporter.write(normalizedMap)

  console.log(`\n✓ Generated merged coverage report`)
  console.log(`  Reports: ${requestedReporters.join(', ')}`)
  console.log(`  Reports available in: ${path.relative(projectRoot, path.join(projectRoot, 'coverage'))}`)
  console.log(`  - HTML: coverage/index.html`)
  console.log(`  - LCOV: coverage/lcov.info`)
  console.log(`  - JSON Summary: coverage/coverage-summary.json`)

  // Try to merge Cobertura files if both exist
  const coberturaMergePath = path.join(projectRoot, 'coverage', 'cobertura-coverage.xml')
  const coberturaRustPath = path.join(projectRoot, 'coverage', 'cobertura-rust.xml')
  if (fs.existsSync(coberturaMergePath) && fs.existsSync(coberturaRustPath)) {
    console.log(`\n📊 Attempting to merge Cobertura files...`)
    try {
      execSync(`node "${path.join(__dirname, 'merge-cobertura.mjs')}"`, { stdio: 'inherit' })
    } catch (error) {
      console.warn(`⚠ Cobertura merge skipped: ${error.message}`)
    }
  }
} catch (error) {
  console.error(`✗ Failed to generate merged coverage report: ${error.message}`)
  process.exit(1)
}
