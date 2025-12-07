#!/usr/bin/env node

/**
 * Generate coverage-summary.json from Cobertura XML files
 * Properly parses XML using xml2js library
 * Reads: ui-unit-coverage.xml, ui-e2e-coverage.xml (if exists),
 *        rust-unit-coverage.xml, rust-e2e-coverage.xml (if exists)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { parseStringPromise } from 'xml2js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

async function parseCobertura(filePath) {
  if (!fs.existsSync(filePath)) return null

  try {
    const xml = fs.readFileSync(filePath, 'utf-8')
    const parsed = await parseStringPromise(xml)
    return parsed
  } catch (e) {
    console.warn(`⚠ Failed to parse ${path.basename(filePath)}: ${e.message}`)
    return null
  }
}

function extractMetrics(coberturaXml) {
  if (!coberturaXml || !coberturaXml.coverage) return null

  const coverage = coberturaXml.coverage
  const attrs = coverage.$

  if (!attrs) return null

  // Get the root coverage attributes
  const lineRate = parseFloat(attrs['line-rate'] || 0)
  const branchRate = parseFloat(attrs['branch-rate'] || 0)

  return {
    lines: lineRate,
    branches: branchRate,
    statements: lineRate, // Use line-rate as proxy for statements
    functions: lineRate   // Use line-rate as proxy for functions
  }
}

async function main() {
  console.log('📊 Parsing Cobertura coverage from all sources...\n')

  const files = {
    uiUnit: path.join(projectRoot, 'coverage', 'ui-unit-coverage.xml'),
    uiE2e: path.join(projectRoot, 'coverage', 'ui-e2e-coverage.xml'),
    rustUnit: path.join(projectRoot, 'coverage', 'rust-unit-coverage.xml'),
    rustE2e: path.join(projectRoot, 'coverage', 'rust-e2e-coverage.xml')
  }

  // Parse all available files
  const [uiUnit, uiE2e, rustUnit, rustE2e] = await Promise.all([
    parseCobertura(files.uiUnit),
    parseCobertura(files.uiE2e),
    parseCobertura(files.rustUnit),
    parseCobertura(files.rustE2e)
  ])

  console.log('✓ UI Unit:', uiUnit ? 'parsed' : 'missing')
  console.log('✓ UI E2E:', uiE2e ? 'parsed' : 'missing')
  console.log('✓ Rust Unit:', rustUnit ? 'parsed' : 'missing')
  console.log('✓ Rust E2E:', rustE2e ? 'parsed' : 'missing')

  // Extract metrics
  const uiUnitMetrics = extractMetrics(uiUnit)
  const uiE2eMetrics = extractMetrics(uiE2e)
  const rustUnitMetrics = extractMetrics(rustUnit)
  const rustE2eMetrics = extractMetrics(rustE2e)

  console.log('\n📈 Metrics by source:')
  if (uiUnitMetrics) console.log(`  UI Unit: ${(uiUnitMetrics.lines * 100).toFixed(2)}% lines, ${(uiUnitMetrics.branches * 100).toFixed(2)}% branches`)
  if (uiE2eMetrics) console.log(`  UI E2E: ${(uiE2eMetrics.lines * 100).toFixed(2)}% lines, ${(uiE2eMetrics.branches * 100).toFixed(2)}% branches`)
  if (rustUnitMetrics) console.log(`  Rust Unit: ${(rustUnitMetrics.lines * 100).toFixed(2)}% lines, ${(rustUnitMetrics.branches * 100).toFixed(2)}% branches`)
  if (rustE2eMetrics) console.log(`  Rust E2E: ${(rustE2eMetrics.lines * 100).toFixed(2)}% lines, ${(rustE2eMetrics.branches * 100).toFixed(2)}% branches`)

  // Merge all metrics - use max for each type to show "covered across any test"
  const merged = {
    lines: Math.max(
      uiUnitMetrics?.lines || 0,
      uiE2eMetrics?.lines || 0,
      rustUnitMetrics?.lines || 0,
      rustE2eMetrics?.lines || 0
    ),
    statements: Math.max(
      uiUnitMetrics?.statements || 0,
      uiE2eMetrics?.statements || 0,
      rustUnitMetrics?.statements || 0,
      rustE2eMetrics?.statements || 0
    ),
    functions: Math.max(
      uiUnitMetrics?.functions || 0,
      uiE2eMetrics?.functions || 0,
      rustUnitMetrics?.functions || 0,
      rustE2eMetrics?.functions || 0
    ),
    branches: Math.max(
      uiUnitMetrics?.branches || 0,
      uiE2eMetrics?.branches || 0,
      rustUnitMetrics?.branches || 0,
      rustE2eMetrics?.branches || 0
    )
  }

  // Generate coverage-summary.json
  const summary = {
    total: {
      lines: {
        total: 100,
        covered: Math.round(merged.lines * 100),
        skipped: 0,
        pct: Math.round(merged.lines * 10000) / 100
      },
      statements: {
        total: 100,
        covered: Math.round(merged.statements * 100),
        skipped: 0,
        pct: Math.round(merged.statements * 10000) / 100
      },
      functions: {
        total: 100,
        covered: Math.round(merged.functions * 100),
        skipped: 0,
        pct: Math.round(merged.functions * 10000) / 100
      },
      branches: {
        total: 100,
        covered: Math.round(merged.branches * 100),
        skipped: 0,
        pct: Math.round(merged.branches * 10000) / 100
      }
    }
  }

  const summaryPath = path.join(projectRoot, 'coverage', 'coverage-summary.json')
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
  console.log(`\n✓ Generated ${path.relative(projectRoot, summaryPath)}`)
}

main().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
