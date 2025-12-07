#!/usr/bin/env node

import coverageLib from 'istanbul-lib-coverage'
import report from 'istanbul-lib-report'
import reports from 'istanbul-reports'
import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { spawn } from 'child_process'

const { createCoverageMap } = coverageLib
const { createContext } = report

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

const map = createCoverageMap({})
let mergedCount = 0

// Helper function to merge coverage data intelligently
// Combines execution counts for overlapping files rather than overwriting
const mergeCoverageData = (baseMap, newCoverage) => {
  Object.entries(newCoverage).forEach(([filePath, newFileData]) => {
    const existingFile = baseMap.fileCoverageFor(filePath)

    if (existingFile && existingFile.data) {
      // File already exists in map - merge execution counts
      const existing = existingFile.data

      // Merge statement counts (s): take max count per statement
      if (newFileData.s && existing.s) {
        Object.keys(newFileData.s).forEach(stmtId => {
          const newCount = newFileData.s[stmtId]
          const existingCount = existing.s[stmtId]
          // Use max count to represent "was this statement executed across all tests"
          if (newCount > 0 || existingCount > 0) {
            existing.s[stmtId] = Math.max(newCount || 0, existingCount || 0)
          }
        })
      }

      // Merge function counts (f): take max count per function
      if (newFileData.f && existing.f) {
        Object.keys(newFileData.f).forEach(fnId => {
          const newCount = newFileData.f[fnId]
          const existingCount = existing.f[fnId]
          if (newCount > 0 || existingCount > 0) {
            existing.f[fnId] = Math.max(newCount || 0, existingCount || 0)
          }
        })
      }

      // Merge branch counts (b): take max count per branch location
      if (newFileData.b && existing.b) {
        Object.keys(newFileData.b).forEach(branchId => {
          if (!existing.b[branchId]) {
            existing.b[branchId] = newFileData.b[branchId]
          } else {
            // Each branch location has an array of coverage counts for each branch path
            const newBranch = newFileData.b[branchId]
            const existingBranch = existing.b[branchId]
            if (Array.isArray(newBranch) && Array.isArray(existingBranch)) {
              existingBranch.forEach((count, idx) => {
                newBranch[idx] = Math.max(count || 0, newBranch[idx] || 0)
              })
            }
          }
        })
      }
    } else {
      // File doesn't exist - add it
      map.addFileCoverage(newFileData)
    }
  })
}

// Load unit test coverage from Vitest output
const unitCoveragePath = path.join(projectRoot, 'coverage', 'ui-unit-coverage.json')
if (fs.existsSync(unitCoveragePath)) {
  try {
    const unitCoverage = JSON.parse(fs.readFileSync(unitCoveragePath, 'utf-8'))
    mergeCoverageData(map, unitCoverage)
    mergedCount++
    console.log(`✓ Loaded unit test coverage from ${path.relative(projectRoot, unitCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load unit test coverage: ${error.message}`)
  }
}

// Load E2E coverage if it exists
const e2eCoveragePath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.json')
if (fs.existsSync(e2eCoveragePath)) {
  try {
    const e2eCoverage = JSON.parse(fs.readFileSync(e2eCoveragePath, 'utf-8'))
    mergeCoverageData(map, e2eCoverage)
    mergedCount++
    console.log(`✓ Merged E2E coverage from ${path.relative(projectRoot, e2eCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load E2E coverage: ${error.message}`)
  }
}

// Note: Rust coverage from cargo-llvm-cov is kept in *.info files separately
// Both frontend (lcov.info) and backend (rust-unit-coverage.info, rust-e2e-coverage.info) LCOV files are available in coverage/
const rustCoveragePath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.json')
const rustE2eCoveragePath = path.join(projectRoot, 'coverage', 'rust-e2e-coverage.json')

if (fs.existsSync(rustCoveragePath)) {
  try {
    const rustCoverage = JSON.parse(fs.readFileSync(rustCoveragePath, 'utf-8'))
    mergeCoverageData(map, rustCoverage)
    mergedCount++
    console.log(`✓ Loaded Rust unit test coverage from ${path.relative(projectRoot, rustCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load Rust unit test coverage: ${error.message}`)
  }
}

// Merge E2E Rust coverage if it exists
if (fs.existsSync(rustE2eCoveragePath)) {
  try {
    const rustE2eCoverage = JSON.parse(fs.readFileSync(rustE2eCoveragePath, 'utf-8'))
    mergeCoverageData(map, rustE2eCoverage)
    mergedCount++
    console.log(`✓ Merged Rust E2E coverage from ${path.relative(projectRoot, rustE2eCoveragePath)}`)
  } catch (error) {
    console.warn(`✗ Failed to load Rust E2E coverage: ${error.message}`)
  }
} else {
  const rustLcovPath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.info')
  if (fs.existsSync(rustLcovPath)) {
    console.log(`ℹ Rust coverage available in ${path.relative(projectRoot, rustLcovPath)} (LCOV format, not merged)`)
  }
}

if (mergedCount === 0) {
  console.warn('⚠ No coverage files found to merge')
  console.warn(`  Expected paths:`)
  console.warn(`  - coverage/ui-unit-coverage.json (frontend unit tests)`)
  console.warn(`  - coverage/ui-e2e-coverage.json (frontend E2E tests)`)
  console.warn(`  - coverage/rust-unit-coverage.json (Rust unit tests)`)
  console.warn(`  - coverage/rust-e2e-coverage.json (Rust E2E tests)`)
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

  const coverageDir = path.join(projectRoot, 'coverage')
  const context = createContext({ coverageMap: normalizedMap, dir: coverageDir })

  requestedReporters.forEach(reportType => {
    reports.create(reportType, {}).execute(context)
  })

  // Rename coverage.json to coverage-merged.json
  const coverageJson = path.join(coverageDir, 'coverage.json')
  const coverageMergedJson = path.join(coverageDir, 'coverage-merged.json')
  if (fs.existsSync(coverageJson) && coverageJson !== coverageMergedJson) {
    fs.renameSync(coverageJson, coverageMergedJson)
  }

  console.log(`\n✓ Generated merged coverage report`)
  console.log(`  Reports: ${requestedReporters.join(', ')}`)
  console.log(`  Reports available in: ${path.relative(projectRoot, path.join(projectRoot, 'coverage'))}`)
  console.log(`  - HTML: coverage/index.html`)
  console.log(`  - LCOV: coverage/lcov.info`)
  console.log(`  - JSON: coverage/coverage-merged.json`)
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
