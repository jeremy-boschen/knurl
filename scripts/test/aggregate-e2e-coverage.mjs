#!/usr/bin/env node

/**
 * Post-test coverage aggregation script
 *
 * This script runs AFTER all E2E tests complete to merge individual coverage files
 * and generate the final coverage report. It should be invoked by the test:e2e script
 * in package.json after WebDriver.io tests finish.
 *
 * Coverage collection happens during tests (in the afterTest hook of wdio.conf.ts),
 * with each test saving its coverage data to a unique file in .nyc_output/.
 * This script aggregates all those files and generates the final report.
 *
 * Usage: node scripts/aggregate-e2e-coverage.mjs
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, copyFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(__dirname, '../..');

function shouldSkipCoverage() {
  const value = process.env.KNURL_SKIP_COVERAGE;
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

async function aggregateCoverage() {
  if (shouldSkipCoverage()) {
    console.log('[coverage] Coverage aggregation skipped (KNURL_SKIP_COVERAGE=1)');
    process.exit(0);
  }

  try {
    const nycOutputDir = path.join(projectRoot, '.nyc_output');

    // Check if coverage directory exists and has files
    if (!existsSync(nycOutputDir)) {
      console.log('[coverage] No coverage data found (.nyc_output directory does not exist)');
      process.exit(0);
    }

    const coverageFiles = readdirSync(nycOutputDir).filter(f => f.startsWith('coverage-') && f.endsWith('.json'));

    if (coverageFiles.length === 0) {
      console.log('[coverage] No coverage data files found in .nyc_output/');
      process.exit(0);
    }

    console.log(`[coverage] Found ${coverageFiles.length} coverage file(s) to aggregate`);
    console.log('[coverage] Merging E2E coverage data...');

    // Merge all individual coverage files into a single coverage.json
    execSync('yarn nyc merge .nyc_output coverage/ui-e2e-coverage.json --temp-dir=.nyc_output', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    console.log('[coverage] Generating E2E coverage report...');

    // Copy merged coverage back to .nyc_output for nyc report to read
    const mergedCoverage = path.join(projectRoot, 'coverage/ui-e2e-coverage.json');
    const nycOutputCoverage = path.join(projectRoot, '.nyc_output/coverage.json');
    if (existsSync(mergedCoverage)) {
      copyFileSync(mergedCoverage, nycOutputCoverage);
    }

    // Generate reports from the merged coverage data (including Cobertura for CI/CD integration)
    execSync('yarn nyc report --reporter=html --reporter=json --reporter=cobertura --temp-dir=.nyc_output --report-dir=coverage/e2e', {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    // Copy cobertura.xml to root coverage dir for merging
    const coberturaSource = path.join(projectRoot, 'coverage/e2e/cobertura-coverage.xml');
    const coberturaTarget = path.join(projectRoot, 'coverage/ui-e2e-coverage.xml');
    if (existsSync(coberturaSource)) {
      copyFileSync(coberturaSource, coberturaTarget);
      console.log('[coverage] ✓ Cobertura XML copied to coverage/ui-e2e-coverage.xml');
    }

    console.log('[coverage] ✓ E2E coverage report generated in coverage/e2e/');
    process.exit(0);
  } catch (error) {
    console.error(
      '[coverage] Error during coverage aggregation:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

aggregateCoverage();
