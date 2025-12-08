#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

function mergeCobertura() {
  const frontendPath = path.join(projectRoot, 'coverage', 'ui-unit-coverage.xml')
  const rustUnitPath = path.join(projectRoot, 'coverage', 'rust-unit-coverage.xml')
  const rustE2ePath = path.join(projectRoot, 'coverage', 'rust-e2e-coverage.xml')
  const e2ePath = path.join(projectRoot, 'coverage', 'ui-e2e-coverage.xml')
  const outputPath = path.join(projectRoot, 'coverage', 'coverage-merged.xml')

  // At minimum, we need frontend coverage. Rust and E2E are optional
  if (!fs.existsSync(frontendPath)) {
    console.log('⚠ Frontend Cobertura file not found. Skipping merge.')
    console.log(`  Frontend: ${frontendPath} ✗`)
    return
  }

  const available = {
    frontend: fs.existsSync(frontendPath),
    rustUnit: fs.existsSync(rustUnitPath),
    rustE2e: fs.existsSync(rustE2ePath),
    e2e: fs.existsSync(e2ePath),
  }

  console.log('ℹ Cobertura sources available:')
  console.log(`  Frontend (UI unit):   ${available.frontend ? '✓' : '✗'}`)
  console.log(`  Rust (unit):          ${available.rustUnit ? '✓' : '✗'}`)
  console.log(`  Rust (E2E):           ${available.rustE2e ? '✓' : '✗'}`)
  console.log(`  E2E (UI):             ${available.e2e ? '✓' : '✗'}`)

  try {
    const frontendXml = fs.readFileSync(frontendPath, 'utf-8')
    const rustUnitXml = available.rustUnit ? fs.readFileSync(rustUnitPath, 'utf-8') : null
    const rustE2eXml = available.rustE2e ? fs.readFileSync(rustE2ePath, 'utf-8') : null
    const e2eXml = available.e2e ? fs.readFileSync(e2ePath, 'utf-8') : null

    // Extract packages from frontend (match <package ...> but not <packages>)
    const frontendPackages = (frontendXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize all Windows backslashes to forward slashes globally
      return pkg.replace(/\\/g, '/')
    })

    // Extract Rust unit test packages and rewrite paths from src/ to src-tauri/src/
    const rustUnitPackages = rustUnitXml ? (rustUnitXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize all Windows backslashes to forward slashes globally
      let rewritten = pkg.replace(/\\/g, '/')

      // Rewrite package name:
      //   - name="src" -> name="src-tauri.src"
      //   - name="src.foo" -> name="src-tauri.src.foo"
      rewritten = rewritten.replace(/name="src"/g, 'name="src-tauri.src"')
      rewritten = rewritten.replace(/name="src\./g, 'name="src-tauri.src.')

      // Rewrite filename paths: src/foo -> src-tauri/src/foo
      rewritten = rewritten.replace(/filename="src\//g, 'filename="src-tauri/src/')

      return rewritten
    }) : []

    // Extract Rust E2E packages and rewrite paths similarly
    const rustE2ePackages = rustE2eXml ? (rustE2eXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize all Windows backslashes to forward slashes globally
      let rewritten = pkg.replace(/\\/g, '/')

      // Rewrite package name:
      rewritten = rewritten.replace(/name="src"/g, 'name="src-tauri.src"')
      rewritten = rewritten.replace(/name="src\./g, 'name="src-tauri.src.')

      // Rewrite filename paths: src/foo -> src-tauri/src/foo
      rewritten = rewritten.replace(/filename="src\//g, 'filename="src-tauri/src/')

      return rewritten
    }) : []

    // Extract UI E2E packages (no special path rewriting needed, already has correct paths)
    const uiE2ePackages = e2eXml ? (e2eXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize all Windows backslashes to forward slashes globally
      return pkg.replace(/\\/g, '/')
    }) : []

    // Combine packages from all available sources
    const allPackages = [...frontendPackages, ...rustUnitPackages, ...rustE2ePackages, ...uiE2ePackages]

    // Create merged coverage with combined packages
    const merged = `<?xml version="1.0" ?>
<coverage version="1.9" timestamp="${Date.now()}">
  <packages>
${allPackages.map(p => '    ' + p).join('\n')}
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
