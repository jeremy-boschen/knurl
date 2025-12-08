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

// Check what coverage files we have available
const unitCoveragePath = path.join(projectRoot, 'coverage', 'ui-unit-coverage.json')
const e2eCoveragePath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.json')
const rustCoveragePath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.json')
const rustE2eCoveragePath = path.join(projectRoot, 'coverage', 'rust-e2e-coverage.json')

const coverageFiles = [unitCoveragePath, e2eCoveragePath, rustCoveragePath, rustE2eCoveragePath]
const existingFiles = coverageFiles.filter(p => fs.existsSync(p))

if (existingFiles.length > 0) {
  console.log(`✓ Coverage files available:`)
  existingFiles.forEach(p => console.log(`  - ${path.relative(projectRoot, p)}`))
} else {
  const rustLcovPath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.info')
  if (fs.existsSync(rustLcovPath)) {
    console.log(`ℹ Rust coverage available in ${path.relative(projectRoot, rustLcovPath)} (LCOV format, not merged)`)
  }
}

// Mark as having coverage files (for Cobertura merging)
if (existingFiles.length > 0) {
  mergedCount = 1
} else {
  mergedCount = 0
}

// Merge Cobertura XML files (which is the standard for CI)
const uiCoberturaPath = path.join(projectRoot, 'coverage', 'ui-unit-coverage.xml')
const rustCoberturaPath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.xml')
const uiE2eCoberturaPath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.xml')

// Check what Cobertura files we have
const hasFrontendCobertura = fs.existsSync(uiCoberturaPath) || fs.existsSync(uiE2eCoberturaPath)
const hasRustCobertura = fs.existsSync(rustCoberturaPath)

if (hasFrontendCobertura || hasRustCobertura) {
  console.log(`\n📊 Merging Cobertura coverage files...`)
  try {
    execSync(`node "${path.join(__dirname, 'merge-cobertura.mjs')}"`, { stdio: 'inherit' })

    // Generate coverage-summary.json from all Cobertura XML sources for threshold checking
    execSync(`node "${path.join(__dirname, 'generate-coverage-summary.mjs')}"`, { stdio: 'inherit' })
  } catch (error) {
    console.warn(`⚠ Cobertura merge or summary generation failed: ${error.message}`)
  }
} else {
  console.warn(`⚠ No Cobertura files found to merge`)
}
