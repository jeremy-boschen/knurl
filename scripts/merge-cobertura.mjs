#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function mergeCobertura() {
  const frontendPath = path.join(projectRoot, 'coverage', 'cobertura-coverage.xml')
  const rustPath = path.join(projectRoot, 'coverage', 'cobertura-rust.xml')
  const outputPath = path.join(projectRoot, 'coverage', 'cobertura-merged.xml')

  if (!fs.existsSync(frontendPath) || !fs.existsSync(rustPath)) {
    console.log('⚠ Cobertura files not found. Skipping merge.')
    console.log(`  Frontend: ${frontendPath} ${fs.existsSync(frontendPath) ? '✓' : '✗'}`)
    console.log(`  Rust: ${rustPath} ${fs.existsSync(rustPath) ? '✓' : '✗'}`)
    return
  }

  try {
    const frontendXml = fs.readFileSync(frontendPath, 'utf-8')
    const rustXml = fs.readFileSync(rustPath, 'utf-8')

    // Extract packages from both files (basic XML regex)
    const frontendPackages = frontendXml.match(/<package[^>]*>[\s\S]*?<\/package>/g) || []
    const rustPackages = rustXml.match(/<package[^>]*>[\s\S]*?<\/package>/g) || []

    // Combine packages
    const allPackages = [...frontendPackages, ...rustPackages].join('\n')

    // Create merged coverage with combined packages
    const merged = `<?xml version="1.0" ?>
<coverage version="1.9" timestamp="${Date.now()}">
  <packages>
${allPackages.split('\n').map(p => p ? '    ' + p : '').join('\n')}
  </packages>
</coverage>`

    fs.writeFileSync(outputPath, merged)
    console.log(`✓ Merged Cobertura files`)
    console.log(`  Output: ${path.relative(projectRoot, outputPath)}`)
  } catch (error) {
    console.error(`✗ Failed to merge Cobertura files: ${error.message}`)
  }
}

mergeCobertura()
