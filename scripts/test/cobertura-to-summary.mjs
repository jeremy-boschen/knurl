#!/usr/bin/env node

/**
 * Parse Cobertura XML and generate coverage-summary.json for threshold checking
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

function parseCobertura() {
  const mergedXmlPath = path.join(projectRoot, 'coverage', 'coverage-merged.xml')
  const summaryPath = path.join(projectRoot, 'coverage', 'coverage-summary.json')

  if (!fs.existsSync(mergedXmlPath)) {
    console.log('ℹ Cobertura XML not found, skipping summary generation')
    return
  }

  try {
    const xml = fs.readFileSync(mergedXmlPath, 'utf-8')

    // Extract coverage attribute from root element
    // Example: <coverage line-rate="0.85" branch-rate="0.75" complexity="1.0">
    const coverageMatch = xml.match(/<coverage[^>]*>/)
    if (!coverageMatch) {
      console.warn('⚠ Could not parse Cobertura XML')
      return
    }

    // Parse line-rate, branch-rate, and other metrics
    const lineRateMatch = coverageMatch[0].match(/line-rate="([^"]*)"/)
    const branchRateMatch = coverageMatch[0].match(/branch-rate="([^"]*)"/)

    const lineRate = lineRateMatch ? parseFloat(lineRateMatch[1]) * 100 : 0
    const branchRate = branchRateMatch ? parseFloat(branchRateMatch[1]) * 100 : 0

    // For statements and functions, we approximate from line rate
    // (In real coverage tools these are sometimes tracked separately)
    const summary = {
      total: {
        lines: {
          total: 100,
          covered: Math.round(lineRate),
          skipped: 0,
          pct: Math.round(lineRate * 100) / 100
        },
        statements: {
          total: 100,
          covered: Math.round(lineRate),
          skipped: 0,
          pct: Math.round(lineRate * 100) / 100
        },
        functions: {
          total: 100,
          covered: Math.round(lineRate),
          skipped: 0,
          pct: Math.round(lineRate * 100) / 100
        },
        branches: {
          total: 100,
          covered: Math.round(branchRate),
          skipped: 0,
          pct: Math.round(branchRate * 100) / 100
        }
      }
    }

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2))
    console.log(`✓ Generated coverage summary from Cobertura`)
    console.log(`  Output: ${path.relative(projectRoot, summaryPath)}`)
  } catch (error) {
    console.warn(`⚠ Failed to parse Cobertura XML: ${error.message}`)
  }
}

parseCobertura()
