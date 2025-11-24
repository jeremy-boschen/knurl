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

function convertE2EToCobertua() {
  const e2eCoveragePath = path.join(projectRoot, 'coverage', 'e2e-coverage.json')
  const outputPath = path.join(projectRoot, 'coverage', 'cobertura-e2e.xml')

  if (!fs.existsSync(e2eCoveragePath)) {
    console.log('⚠ E2E coverage file not found. Skipping conversion.')
    console.log(`  Expected path: ${e2eCoveragePath}`)
    return
  }

  try {
    const e2eCoverage = JSON.parse(fs.readFileSync(e2eCoveragePath, 'utf-8'))
    const map = createCoverageMap(e2eCoverage)

    // Create reporter and configure to only output Cobertura
    const reporter = createReporter()
    reporter.addAll(['cobertura'])

    // Write the report - it will be created in coverage/cobertura.xml
    reporter.write(map)

    // Rename cobertura.xml to cobertura-e2e.xml to match our naming scheme
    const defaultCobertura = path.join(projectRoot, 'coverage', 'cobertura.xml')
    if (fs.existsSync(defaultCobertura)) {
      fs.renameSync(defaultCobertura, outputPath)
      console.log(`✓ Converted E2E coverage to Cobertura format`)
      console.log(`  Output: ${path.relative(projectRoot, outputPath)}`)
    } else {
      console.warn(`⚠ Cobertura output not found at expected path: ${defaultCobertura}`)
    }
  } catch (error) {
    console.error(`✗ Failed to convert E2E coverage: ${error.message}`)
  }
}

convertE2EToCobertua()
