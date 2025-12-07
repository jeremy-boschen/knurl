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

// Note: Istanbul JSON merging from multiple sources is complex due to format differences
// between Vitest and Rust converted coverage. Instead, we rely on Cobertura XML merging
// which is the standard format used for CI integration.
// Individual coverage files are still generated:
// - ui-unit-coverage.json (frontend unit tests)
// - ui-e2e-coverage.json (frontend E2E tests)
// - rust-unit-coverage.json (Rust unit tests, converted from LCOV)
// - rust-e2e-coverage.json (Rust E2E tests, converted from LCOV)

// Check if we have any coverage files generated
const unitCoveragePath = path.join(projectRoot, 'coverage', 'ui-unit-coverage.json')
const e2eCoveragePath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.json')
const rustCoveragePath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.json')
const rustE2eCoveragePath = path.join(projectRoot, 'coverage', 'rust-e2e-coverage.json')

const hasCoverageFiles = [
  unitCoveragePath,
  e2eCoveragePath,
  rustCoveragePath,
  rustE2eCoveragePath
].some(p => fs.existsSync(p))

if (hasCoverageFiles) {
  mergedCount = 1  // Mark as having coverage for Cobertura merging
  console.log(`✓ Coverage files available:`)
  if (fs.existsSync(unitCoveragePath)) console.log(`  - ${path.relative(projectRoot, unitCoveragePath)}`)
  if (fs.existsSync(e2eCoveragePath)) console.log(`  - ${path.relative(projectRoot, e2eCoveragePath)}`)
  if (fs.existsSync(rustCoveragePath)) console.log(`  - ${path.relative(projectRoot, rustCoveragePath)}`)
  if (fs.existsSync(rustE2eCoveragePath)) console.log(`  - ${path.relative(projectRoot, rustE2eCoveragePath)}`)
} else {
  const rustLcovPath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.info')
  if (fs.existsSync(rustLcovPath)) {
    console.log(`ℹ Rust coverage available in ${path.relative(projectRoot, rustLcovPath)} (LCOV format, not merged)`)
  }
}

if (mergedCount === 0) {
  console.warn('⚠ No coverage files found')
  process.exit(0)
}

// Skip Istanbul JSON merging - use Cobertura XML which is the standard for CI
// Try to merge Cobertura files if both frontend and backend exist
const uiCoberturaPath = path.join(projectRoot, 'coverage', 'ui-unit-coverage.xml')
const rustCoberturaPath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.xml')
const uiE2eCoberturaPath = path.join(projectRoot, 'coverage', 'cobertura-e2e.xml')

// Check what Cobertura files we have
const hasFrontendCobertura = fs.existsSync(uiCoberturaPath) || fs.existsSync(uiE2eCoberturaPath)
const hasRustCobertura = fs.existsSync(rustCoberturaPath)

if (hasFrontendCobertura || hasRustCobertura) {
  console.log(`\n📊 Merging Cobertura coverage files...`)
  try {
    execSync(`node "${path.join(__dirname, 'merge-cobertura.mjs')}"`, { stdio: 'inherit' })
  } catch (error) {
    console.warn(`⚠ Cobertura merge failed: ${error.message}`)
  }
} else {
  console.warn(`⚠ No Cobertura files found to merge`)
}
