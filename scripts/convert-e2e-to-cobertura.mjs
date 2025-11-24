#!/usr/bin/env node

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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
    // Create temporary .nyc_output directory with the coverage file
    const nycOutputDir = path.join(projectRoot, '.nyc_output_e2e_temp')
    const tempCoverageFile = path.join(nycOutputDir, 'coverage.json')

    if (!fs.existsSync(nycOutputDir)) {
      fs.mkdirSync(nycOutputDir, { recursive: true })
    }

    // Copy e2e coverage to temp location for nyc to process
    fs.copyFileSync(e2eCoveragePath, tempCoverageFile)

    // Use nyc to generate cobertura report
    execSync(`npx nyc report --reporter=cobertura --temp-dir="${nycOutputDir}" --report-dir="${nycOutputDir}"`, {
      cwd: projectRoot,
      stdio: 'pipe',
    })

    // Move generated cobertura.xml to our expected location
    const generatedCobertura = path.join(nycOutputDir, 'cobertura-coverage.xml')
    if (fs.existsSync(generatedCobertura)) {
      fs.renameSync(generatedCobertura, outputPath)
      console.log(`✓ Converted E2E coverage to Cobertura format`)
      console.log(`  Output: ${path.relative(projectRoot, outputPath)}`)
    } else {
      console.warn(`⚠ Cobertura output not found at expected path: ${generatedCobertura}`)
    }

    // Clean up temp directory
    fs.rmSync(nycOutputDir, { recursive: true, force: true })
  } catch (error) {
    console.error(`✗ Failed to convert E2E coverage: ${error.message}`)
  }
}

convertE2EToCobertua()
