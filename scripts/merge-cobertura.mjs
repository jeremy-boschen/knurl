#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function mergeCobertura() {
  const frontendPath = path.join(projectRoot, 'coverage', 'cobertura-coverage.xml')
  const rustPath = path.join(projectRoot, 'coverage', 'cobertura-rust.xml')
  const e2ePath = path.join(projectRoot, 'coverage', 'cobertura-e2e.xml')
  const outputPath = path.join(projectRoot, 'coverage', 'cobertura-merged.xml')

  // At minimum, we need frontend coverage. Rust and E2E are optional
  if (!fs.existsSync(frontendPath)) {
    console.log('⚠ Frontend Cobertura file not found. Skipping merge.')
    console.log(`  Frontend: ${frontendPath} ✗`)
    return
  }

  const available = {
    frontend: fs.existsSync(frontendPath),
    rust: fs.existsSync(rustPath),
    e2e: fs.existsSync(e2ePath),
  }

  console.log('⚠ Cobertura sources available:')
  console.log(`  Frontend: ${available.frontend ? '✓' : '✗'}`)
  console.log(`  Rust:     ${available.rust ? '✓' : '✗'}`)
  console.log(`  E2E:      ${available.e2e ? '✓' : '✗'}`)

  try {
    const frontendXml = fs.readFileSync(frontendPath, 'utf-8')
    const rustXml = available.rust ? fs.readFileSync(rustPath, 'utf-8') : null
    const e2eXml = available.e2e ? fs.readFileSync(e2ePath, 'utf-8') : null

    // Extract packages from frontend (match <package ...> but not <packages>)
    const frontendPackages = (frontendXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize Windows backslashes to forward slashes in filenames
      return pkg.replace(/filename="([^"]*)\\/g, 'filename="$1/')
    })

    // Extract Rust packages and rewrite paths from src/ to src-tauri/src/
    const rustPackages = rustXml ? (rustXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize Windows backslashes to forward slashes in filenames
      let rewritten = pkg.replace(/filename="([^"]*)\\/g, 'filename="$1/')

      // Rewrite package name:
      //   - name="src" -> name="src-tauri.src"
      //   - name="src.foo" -> name="src-tauri.src.foo"
      rewritten = rewritten.replace(/name="src"/g, 'name="src-tauri.src"')
      rewritten = rewritten.replace(/name="src\./g, 'name="src-tauri.src.')

      // Rewrite filename paths: src/foo -> src-tauri/src/foo
      rewritten = rewritten.replace(/filename="src\//g, 'filename="src-tauri/src/')

      return rewritten
    }) : []

    // Extract E2E packages (no special path rewriting needed, already has correct paths)
    const e2ePackages = e2eXml ? (e2eXml.match(/<package(?:\s|>)[^>]*>[\s\S]*?<\/package>/g) || []).map(pkg => {
      // Normalize Windows backslashes to forward slashes in filenames
      return pkg.replace(/filename="([^"]*)\\/g, 'filename="$1/')
    }) : []

    // Combine packages from all available sources
    const allPackages = [...frontendPackages, ...rustPackages, ...e2ePackages]

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
