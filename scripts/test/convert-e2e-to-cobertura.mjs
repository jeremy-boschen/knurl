#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import coverageLib from 'istanbul-lib-coverage'
import report from 'istanbul-lib-report'
import reports from 'istanbul-reports'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

function convertE2EToCobertua() {
  const e2eCoveragePath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.json')
  const outputPath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.xml')

  if (!fs.existsSync(e2eCoveragePath)) {
    console.log('⚠ E2E coverage file not found. Skipping conversion.')
    console.log(`  Expected path: ${e2eCoveragePath}`)
    return
  }

  try {
    // Read the Istanbul JSON coverage file
    const rawCoverage = JSON.parse(fs.readFileSync(e2eCoveragePath, 'utf-8'))

    // Create coverage map from raw coverage data
    const { createCoverageMap } = coverageLib
    const map = createCoverageMap(rawCoverage)

    // Create output directory if it doesn't exist
    const reportDir = path.dirname(outputPath)
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true })
    }

    // Create context and generate Cobertura report
    const { createContext } = report
    const ctx = createContext({
      dir: reportDir,
      coverageMap: map,
    })

    // Generate cobertura reporter
    const CoberturaReporter = reports.create('cobertura')
    CoberturaReporter.execute(ctx)

    // The reporter should have created cobertura-coverage.xml in the report dir
    const generatedFile = path.join(reportDir, 'cobertura-coverage.xml')
    if (fs.existsSync(generatedFile) && generatedFile !== outputPath) {
      fs.renameSync(generatedFile, outputPath)
    }

    console.log(`✓ Converted E2E coverage to Cobertura format`)
    console.log(`  Output: ${path.relative(projectRoot, outputPath)}`)
  } catch (error) {
    console.error(`✗ Failed to convert E2E coverage: ${error.message}`)
    console.error(error.stack)
  }
}

convertE2EToCobertua()
