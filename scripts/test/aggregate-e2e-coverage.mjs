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

    console.log('[coverage] Converting E2E coverage to Cobertura format...');

    // Use the dedicated conversion script to convert Istanbul JSON to Cobertura XML
    // This is more reliable than using nyc report which doesn't handle E2E coverage well
    execSync(`node "${path.join(__dirname, 'convert-e2e-to-cobertura.mjs')}"`, {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    console.log('[coverage] ✓ E2E coverage report generated');
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
