#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Define test suites in order
const suites = [
  'launch',
  'app',
  'collections',
  'auth',
  'request',
  'ui',
  'workspace',
  'env',
];

const CLEANUP_DELAY = 2000; // 2 seconds between suites

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanupProcesses() {
  console.log('[cleanup] Killing any lingering e2e processes...');
  // Kill wdio, tauri-driver, chromedriver, vite dev servers
  spawnSync('sh', ['-c', 'pkill -9 -f "wdio|tauri-driver|chromedriver|msedgedriver|WebKitWebDriver" 2>/dev/null || true'], {
    stdio: 'ignore'
  });
}

async function runSuite(suite) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Running suite: ${suite}`);
  console.log(`${'='.repeat(70)}\n`);

  return new Promise((resolve) => {
    const wdio = spawn('yarn', ['wdio', 'run', './wdio.conf.ts', '--suite', suite], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    wdio.on('exit', (code) => {
      if (code === 0) {
        console.log(`✓ Suite '${suite}' passed`);
      } else {
        console.error(`✗ Suite '${suite}' failed with code ${code}`);
      }
      resolve(code);
    });

    wdio.on('error', (error) => {
      console.error(`✗ Suite '${suite}' error:`, error);
      resolve(1);
    });
  });
}

async function main() {
  console.log('[setup] Starting E2E test suite orchestration');

  // Initial cleanup
  cleanupProcesses();
  console.log(`[setup] Waiting ${CLEANUP_DELAY}ms for processes to terminate...\n`);
  await sleep(CLEANUP_DELAY);

  const results = {};
  let hasFailures = false;

  for (const suite of suites) {
    const exitCode = await runSuite(suite);
    results[suite] = exitCode === 0 ? 'PASS' : 'FAIL';

    if (exitCode !== 0) {
      hasFailures = true;
    }

    // Cleanup between suites
    console.log(`\n[cleanup] Cleaning up after suite '${suite}'`);
    cleanupProcesses();
    console.log(`[cleanup] Waiting ${CLEANUP_DELAY}ms before next suite...\n`);
    await sleep(CLEANUP_DELAY);
  }

  // Final cleanup
  console.log('\n[cleanup] Running final cleanup');
  cleanupProcesses();

  // Print summary
  console.log(`\n${'='.repeat(70)}`);
  console.log('TEST SUITE SUMMARY');
  console.log(`${'='.repeat(70)}`);

  for (const suite of suites) {
    const status = results[suite];
    const symbol = status === 'PASS' ? '✓' : '✗';
    console.log(`${symbol} ${suite.padEnd(15)} ${status}`);
  }

  console.log(`${'='.repeat(70)}\n`);

  if (hasFailures) {
    console.error('Some test suites failed');
    process.exit(1);
  } else {
    console.log('All test suites passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
