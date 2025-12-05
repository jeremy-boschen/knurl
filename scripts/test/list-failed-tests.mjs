#!/usr/bin/env node

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '../..')

const failures = {
  unit: [],
  e2e: [],
}

// Parse unit test failures (Vitest JSON output)
const unitCoveragePath = path.join(projectRoot, 'coverage', 'test-results.json')
if (fs.existsSync(unitCoveragePath)) {
  try {
    const results = JSON.parse(fs.readFileSync(unitCoveragePath, 'utf-8'))
    if (results.testResults) {
      results.testResults.forEach((file) => {
        if (file.assertionResults) {
          file.assertionResults.forEach((test) => {
            if (test.status === 'failed') {
              failures.unit.push({
                file: path.relative(projectRoot, file.name),
                test: test.fullName || test.title,
                error: test.failureMessages?.[0] || 'Unknown error',
              })
            }
          })
        }
      })
    }
  } catch (error) {
    console.warn(`⚠ Failed to parse unit test results: ${error.message}`)
  }
}

// Parse e2e test failures (WebDriver JSON output)
const testResultsDir = path.join(projectRoot, 'test-results')
if (fs.existsSync(testResultsDir)) {
  try {
    const files = fs.readdirSync(testResultsDir).filter((f) => f.startsWith('results-') && f.endsWith('.json'))
    files.forEach((file) => {
      try {
        const results = JSON.parse(fs.readFileSync(path.join(testResultsDir, file), 'utf-8'))
        const specFile = results.specs?.[0] || 'unknown'

        if (results.suites && Array.isArray(results.suites)) {
          results.suites.forEach((suite) => {
            if (suite.tests && Array.isArray(suite.tests)) {
              suite.tests.forEach((test) => {
                if (test.state === 'failed') {
                  failures.e2e.push({
                    file: specFile,
                    test: `${suite.name} > ${test.name}`,
                    error: test.error?.message || 'Test failed',
                  })
                }
              })
            }
          })
        }
      } catch (error) {
        console.warn(`⚠ Failed to parse E2E results file ${file}: ${error.message}`)
      }
    })
  } catch (error) {
    console.warn(`⚠ Failed to read test results directory: ${error.message}`)
  }
}

// Output results
console.log('\n' + '='.repeat(80))
console.log('FAILED TESTS SUMMARY')
console.log('='.repeat(80))

if (failures.unit.length === 0 && failures.e2e.length === 0) {
  console.log('✓ All tests passed!')
  process.exit(0)
}

if (failures.unit.length > 0) {
  console.log(`\n❌ UNIT TESTS (${failures.unit.length} failed)\n`)
  failures.unit.forEach((failure, index) => {
    console.log(`${index + 1}. ${failure.file}`)
    console.log(`   Test: ${failure.test}`)
    console.log(`   Error: ${failure.error.split('\n')[0]}`)
    console.log()
  })
}

if (failures.e2e.length > 0) {
  console.log(`\n❌ E2E TESTS (${failures.e2e.length} failed)\n`)
  failures.e2e.forEach((failure, index) => {
    console.log(`${index + 1}. ${failure.file}`)
    console.log(`   Test: ${failure.test}`)
    console.log(`   Error: ${failure.error.split('\n')[0]}`)
    console.log()
  })
}

console.log('='.repeat(80))
console.log(`Total: ${failures.unit.length + failures.e2e.length} failed test(s)`)
console.log('='.repeat(80) + '\n')

process.exit(failures.unit.length + failures.e2e.length > 0 ? 1 : 0)
