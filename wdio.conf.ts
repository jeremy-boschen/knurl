import * as path from 'node:path';
import {existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync, copyFileSync} from 'node:fs';
import {homedir, tmpdir} from 'node:os';
import {spawn, spawnSync} from 'child_process';
import {fileURLToPath} from 'url';

// @ts-ignore
const __dirname = fileURLToPath(new URL('.', import.meta.url));

// keep track of the `tauri-driver` child process
let tauriDriver;
let viteProcess;
let mockEndpointProcess;
let exit = false;
let configDirOverride;
const cargoHome = resolveCargoHome();
const nativeDriverPath = resolveNativeDriverPath();
const configDirsByCapability: Map<number, string> = new Map();

// Mock endpoint server configuration
const MOCK_ENDPOINT_PORT = 3000;
const MOCK_ENDPOINT_HOST = '127.0.0.1';

// Track per-session tauri-driver instances
const tauriDriversByCapability: Map<number, any> = new Map();

/**
 * E2E Test Annotations Guide
 * ===========================
 *
 * Use these annotations in test names to control test behavior:
 *
 * [STATE:PRESERVE]
 *   Description: Retains all config directory files and settings from the previous test
 *   Use case: Tests that need to verify persistent state across multiple operations
 *   Example: it("[STATE:PRESERVE] verifies collection persists after reload", async () => { ... })
 *   Effect: The beforeTest hook will NOT reset/clear the config directory
 *
 * Default Behavior (without [STATE:PRESERVE]):
 *   - Config directory is completely wiped
 *   - Fresh settings.json is copied from test/fixtures/settings.json
 *   - Provides clean slate for each test
 */

// ============================================================================
// State Management Utilities
// ============================================================================

/**
 * Check if a test has the [STATE:PRESERVE] annotation
 */
function shouldPreserveState(testTitle: string): boolean {
  return testTitle.includes('[STATE:PRESERVE]');
}

/**
 * Reset the config directory: wipe all files and restore default settings
 */
function resetConfigDirectory(configDir: string): void {
  try {
    // Remove all files in config directory
    if (existsSync(configDir)) {
      const files = readdirSync(configDir);
      for (const file of files) {
        const filePath = path.join(configDir, file);
        rmSync(filePath, { recursive: true, force: true });
      }
    }

    // Copy fresh settings.json from fixtures
    const fixtureSettingsPath = path.join(__dirname, 'test', 'fixtures', 'settings.json');
    const configSettingsPath = path.join(configDir, 'settings.json');
    if (existsSync(fixtureSettingsPath)) {
      copyFileSync(fixtureSettingsPath, configSettingsPath);
    }
  } catch (error) {
    console.warn(`[resetConfigDirectory] Failed to reset config directory at ${configDir}:`, error);
  }
}

/**
 * Pretty-print test metadata for logging
 */
function formatTestMetadata(test: any): string {
  return [
    `title: "${test.title}"`,
    `fullTitle: "${test.fullTitle}"`,
    `file: "${test.file}"`,
    test.parent ? `parent: "${test.parent}"` : null,
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Pretty-print test result for logging
 */
function formatTestResult(result: any): string {
  const parts = [];
  if (result.duration !== undefined) parts.push(`duration: ${result.duration}ms`);
  if (result.state) parts.push(`state: ${result.state}`);
  if (result.error) parts.push(`error: ${result.error.message}`);
  return parts.length > 0 ? parts.join(' | ') : 'result: passed';
}

function killProcessesOnPort(port: number) {
  try {
    if (process.platform === 'win32') {
      spawnSync('powershell.exe', [
        '-NoLogo',
        '-NoProfile',
        '-Command',
        `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { if ($_ -ne $PID) { Try { Stop-Process -Id $_ -Force -ErrorAction Stop } Catch { } } }`,
      ], {stdio: 'ignore'});
      return;
    }

    const lsofResult = spawnSync('lsof', ['-ti', `tcp:${port}`], {encoding: 'utf8'});
    const output = lsofResult.stdout?.trim();
    if (lsofResult.status === 0 && output) {
      for (const pid of output.split(/\s+/)) {
        if (!pid) {
          continue;
        }
        spawnSync('kill', ['-9', pid], {stdio: 'ignore'});
      }
      return;
    }

    spawnSync('fuser', ['-k', `${port}/tcp`], {stdio: 'ignore'});
  } catch (error) {
    console.warn(`Failed to clean processes on port ${port}:`, error);
  }
}

function killProcessesByPattern(pattern: string) {
  try {
    if (process.platform === 'win32') {
      const script = `
        Get-Process | Where-Object { $_.Path -like "*${pattern.replace(/"/g, '""')}*" } | ForEach-Object {
          Try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } Catch { }
        }
      `;
      spawnSync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', script], { stdio: 'ignore' });
      return;
    }

    const result = spawnSync('pkill', ['-9', '-f', pattern], { stdio: 'ignore' });
    if (result.status === 0) {
      return;
    }
  } catch {
    // ignore
  }
}

function envFlag(value: string | undefined | null): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}


const runningDocs = process.argv.join(' ').includes('--suite docs') || process.argv.join(' ').includes('/documentation/e2e/') || process.argv.join(' ').includes('documentation/e2e');

export const config = {
  host: '127.0.0.1',
  port: 4444,
  logLevel: 'error',
  specs: ['./test/specs/**/*.ts', './documentation/e2e/**/*.e2e.ts'],
  exclude: runningDocs ? ['./test/specs/**/*.ts'] : ['./documentation/e2e/**/*.e2e.ts'],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      'tauri:options': {
        application: 'src-tauri/target/debug/knurl',
        args: ['--window-width=1440', '--window-height=900'],
      },
    },
  ],
  reporters: [
    ['spec', { symbols: { success: '✓', pending: '○', fail: '✕' }, realtimeReporting: false }],
    ['json', { outputDir: './test-results', outputFileFormat: (opts) => `results-${opts.cid}.json` }],
  ],
  framework: 'mocha',
  baseUrl: 'http://localhost:1420',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    reporter: 'spec',
    reporterOptions: {
      enableTimeouts: true,
    },
  },

  // ensure the rust project is built since we expect this binary to exist for the webdriver sessions
  onPrepare: async () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log('[onPrepare] 🔧 Global test preparation (run once for entire test suite)');
    console.log(`  timestamp: ${new Date().toISOString()}`);

    // Kill any existing processes on critical ports
    console.log(`  cleaning up processes on critical ports...`);
    killProcessesOnPort(1420);
    killProcessesOnPort(4444);
    killProcessesOnPort(4445); // WebKitWebDriver port
    killProcessesOnPort(MOCK_ENDPOINT_PORT);
    // Kill lingering processes from previous runs
    console.log(`  killing lingering processes from previous runs...`);
    killProcessesByPattern('vite');
    killProcessesByPattern('esbuild');
    killProcessesByPattern('tauri-driver');
    killProcessesByPattern('WebKitWebDriver');
    killProcessesByPattern(path.join('src-tauri', 'target', 'debug', 'knurl'));
    console.log(`  ✓ Process cleanup complete`);

    // Start mock endpoint server (OAuth, GitHub API, and other test endpoints)
    console.log(`  starting mock endpoint server on port ${MOCK_ENDPOINT_PORT}...`);
    const mockEndpointEnv = {
      ...process.env,
      HOST: MOCK_ENDPOINT_HOST,
      PORT: String(MOCK_ENDPOINT_PORT),
    };

    mockEndpointProcess = spawn('node', ['scripts/mock-endpoint-server.mjs'], {
      cwd: process.cwd(),
      env: mockEndpointEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    mockEndpointProcess.stdout?.on('data', (data) => {
      process.stdout.write(`[mock-endpoints] ${data}`);
    });

    mockEndpointProcess.stderr?.on('data', (data) => {
      process.stderr.write(`[mock-endpoints] ${data}`);
    });

    mockEndpointProcess.on('error', (error) => {
      console.error('[mock-endpoints] Error:', error);
    });

    mockEndpointProcess.on('exit', (code) => {
      if (!exit && (code ?? 0) !== 0) {
        console.warn(`[mock-endpoints] Exited with code: ${code ?? 0}`);
      }
    });

    // Give mock endpoint server time to start, then wait for it to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      await waitForEndpoint(`http://${MOCK_ENDPOINT_HOST}:${MOCK_ENDPOINT_PORT}/.well-known/openid-configuration`);
      console.log(`  ✓ Mock endpoint server ready`);
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : JSON.stringify(error);
      console.warn(`[mock-endpoints] Server startup warning: ${detail}`);
    }

    // OAuth and test configuration
    console.log(`  configuring OAuth environment variables...`);
    const oauthIssuer = `http://${MOCK_ENDPOINT_HOST}:${MOCK_ENDPOINT_PORT}`;
    process.env.VITE_E2E_OAUTH_ISSUER = oauthIssuer;
    process.env.VITE_E2E_OAUTH_CLIENT_ID = 'test-client';
    process.env.VITE_E2E_OAUTH_CLIENT_SECRET = 'test-secret';
    process.env.VITE_E2E_OAUTH_PUBLIC_CLIENT_ID = 'public-device-client';
    process.env.VITE_E2E_STUB_OAUTH = '0';
    process.env.KNURL_OAUTH_HEADLESS = '1';
    process.env.KNURL_OAUTH_AUTO_DEVICE = '1';
    console.log(`  ✓ OAuth configured (issuer: ${oauthIssuer})`);
    console.log(`  ✓ Environment variables set`);
    console.log(`  building Rust backend...`);

    // Don't set config dir in onPrepare; it will be set per-capability in beforeSession
    // This allows each test suite/capability to have its own config directory

    const manifestPath = path.resolve(__dirname, 'src-tauri', 'Cargo.toml');
    const env = {
      ...process.env,
      CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL ?? '1',
      RUSTFLAGS: [process.env.RUSTFLAGS, '-C opt-level=0', '-C debuginfo=1'].filter(Boolean).join(' ').trim(),
    };

    // Build debug profile for E2E tests
    // Note: Using debug profile as release build encounters Tauri macro compilation issue
    // Frontend coverage: via vite.config.e2e.ts Istanbul instrumentation
    // Rust backend coverage: TODO - enable LLVM instrumentation when Tauri macro issue resolved
    const buildResult = spawnSync('cargo', ['build', '--manifest-path', manifestPath, '--profile', 'dev'], {
      stdio: 'inherit',
      shell: true,
      env,
    });

    if (buildResult.status !== 0) {
      throw new Error('cargo build failed');
    }
    console.log(`  ✓ Rust backend built successfully`);

    console.log(`  starting Vite dev server on port 1420...`);
    const viteEnv = {
      ...buildEnvWithKeyringDefaults(),
      BROWSER: 'none',
      VITE_DISABLE_SSL: 'true',
      VITE_E2E_OAUTH_ISSUER: oauthIssuer,
      VITE_E2E_OAUTH_CLIENT_ID: 'test-client',
      VITE_E2E_OAUTH_CLIENT_SECRET: 'test-secret',
      VITE_E2E_OAUTH_PUBLIC_CLIENT_ID: 'public-device-client',
      VITE_E2E_STUB_OAUTH: '0',
    };

    // Always use E2E Vite config with Istanbul instrumentation for coverage collection
    // First generate the knurl icon (from the dev script)
    const iconGeneration = spawnSync('node', ['scripts/generate-knurl-icon.mjs'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'ignore',
    });

    if (iconGeneration.status !== 0) {
      throw new Error('Failed to generate knurl icon');
    }

    // Then start vite with the E2E config directly
    viteProcess = spawn('vite', ['--config', 'vite.config.e2e.ts', '--host', '127.0.0.1', '--port', '1420', '--mode', 'e2e'], {
      cwd: process.cwd(),
      shell: true,
      env: viteEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    viteProcess.stdout?.on('data', (data) => {
      process.stdout.write(`[vite] ${data}`);
    });

    viteProcess.stderr?.on('data', (data) => {
      process.stderr.write(`[vite] ${data}`);
    });

    viteProcess.on('error', (error) => {
      console.error('vite dev server error:', error);
      process.exit(1);
    });

    viteProcess.on('exit', (code) => {
      if (!exit) {
        console.error('vite dev server exited with code:', code);
        process.exit(1);
      }
    });

    await waitForDevServer('http://127.0.0.1:1420');
    console.log(`  ✓ Vite dev server ready`);

    // Start tauri-driver once for all workers (only once in onPrepare)
    console.log(`  starting tauri-driver...`);
    const tauriDriverBinary = path.join(cargoHome, 'bin', process.platform === 'win32' ? 'tauri-driver.exe' : 'tauri-driver');
    if (!existsSync(tauriDriverBinary)) {
      throw new Error(`tauri-driver not found at ${tauriDriverBinary}. Install via "cargo install tauri-driver".`);
    }
    if (!nativeDriverPath) {
      if (process.platform === 'win32') {
        throw new Error(
          'Unable to locate native WebDriver (msedgedriver). Set KNURL_NATIVE_DRIVER or ensure it is on PATH.',
        );
      }
      if (process.platform === 'darwin') {
        throw new Error(
          'Unable to locate native WebDriver (WebKitWebDriver). Set KNURL_NATIVE_DRIVER or ensure it is on PATH.',
        );
      }
      console.warn(
        'Native WebDriver not found; continuing without WebKitWebDriver. WebKit-specific checks are disabled on this platform.',
      );
    }

    // Spawn a single tauri-driver instance for all test workers
    const tauriDriverArgs = [];
    if (nativeDriverPath) {
      tauriDriverArgs.push('--native-driver', nativeDriverPath);
    }

    const driverEnv = buildEnvWithKeyringDefaults();
    tauriDriver = spawn(tauriDriverBinary, tauriDriverArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],  // Capture stdout/stderr to see startup messages
      env: driverEnv,
    });

    let driverStarted = false;

    tauriDriver.stdout?.on('data', (data) => {
      console.log(`[tauri-driver stdout] ${data}`);
    });

    tauriDriver.stderr?.on('data', (data) => {
      console.log(`[tauri-driver stderr] ${data}`);
      // Check if the driver is listening
      if (data.toString().includes('listening') || data.toString().includes('listening')) {
        driverStarted = true;
      }
    });

    tauriDriver.on('error', (error) => {
      console.error('[tauri-driver] Failed to start:', error);
      process.exit(1);
    });

    tauriDriver.on('exit', (code) => {
      if (!exit) {
        console.error('[tauri-driver] exited with code:', code);
        process.exit(1);
      }
    });

    // Wait for tauri-driver to be ready and fully initialized
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log(`  ✓ tauri-driver started and ready`);
    console.log(`[onPrepare] ✓ Global test preparation complete\n`);
  },

  // Create a unique config directory for each session to prevent test pollution
  beforeSession: async (config, capabilities, specs) => {
    console.log(`\n${'='.repeat(80)}`);
    console.log('[beforeSession] 🚀 Session initialization starting');
    console.log(`  capabilities: ${capabilities ? Object.keys(capabilities).join(', ') : 'none'}`);
    console.log(`  specs: ${specs ? specs.length : 0} spec files`);

    // Create a unique config directory for this capability/session
    // This prevents test pollution when multiple suites run in parallel
    const configDir = mkdtempSync(path.join(tmpdir(), 'knurl-e2e-config-'));
    configDirsByCapability.set(process.pid, configDir);
    console.log(`  configDir: ${configDir}`);

    // Copy test settings fixture to disable auto-save during tests
    try {
      const fixtureSettingsPath = path.join(__dirname, 'test', 'fixtures', 'settings.json');
      const configSettingsPath = path.join(configDir, 'settings.json');
      if (existsSync(fixtureSettingsPath)) {
        copyFileSync(fixtureSettingsPath, configSettingsPath);
        console.log(`  ✓ Copied settings.json fixture to config directory`);
      }
    } catch (error) {
      console.warn('[beforeSession] Failed to copy settings fixture:', error);
    }

    // Set the config dir in the capability's tauri options
    if (capabilities && typeof capabilities === 'object' && 'tauri:options' in capabilities) {
      const tauriOptions = capabilities['tauri:options'];
      if (!tauriOptions.args) {
        tauriOptions.args = [];
      }
      const normalizedConfigDir = configDir.replaceAll('\\', '/');
      if (process.platform === 'win32') {
        tauriOptions.args.push(['--config-dir', normalizedConfigDir].join(' '));
      } else {
        tauriOptions.args.push(`--config-dir=${normalizedConfigDir}`);
      }
      console.log(`  ✓ Injected --config-dir into Tauri args`);
    }

    console.log(`[beforeSession] ✓ Session initialization complete\n`);
    // tauri-driver is now shared across all sessions and started in onPrepare
  },

  // Per-test hook: runs before each individual test
  beforeTest: async function (test) {
    const configDir = configDirsByCapability.get(process.pid);
    const preserveState = shouldPreserveState(test.title);

    console.log(`\n[beforeTest] 📋 Starting test: "${test.title}"`);
    console.log(`  ${formatTestMetadata(test)}`);
    console.log(`  state annotation: ${preserveState ? '[STATE:PRESERVE] 💾' : 'reset to defaults'}`);

    if (!preserveState && configDir) {
      console.log(`  resetting config directory...`);
      resetConfigDirectory(configDir);
      console.log(`  ✓ Config directory reset`);
    } else if (preserveState && configDir) {
      console.log(`  ✓ Preserving config directory state from previous test`);
    }
  },

  // Called before each test suite starts
  beforeSuite: async function (suite) {
    console.log(`\n[beforeSuite] 📦 Suite starting: "${suite.title}"`);
    console.log(`  fullTitle: "${suite.fullTitle}"`);
    console.log(`  tests in suite: ${suite.tests ? suite.tests.length : 'unknown'}`);
  },

  // afterSession cleanup is no longer needed as tauri-driver is shared across sessions
  afterSession: () => {
    console.log(`\n[afterSession] 🏁 Session ending`);
    // tauri-driver cleanup is now handled in onShutdown
  },

  before: async () => {
    console.log(`\n[before] 🌐 Per-session setup (run once per session, before first test)`);
    console.log(`  waiting for app to reach startup state 2...`);

    await browser.waitUntil(
      async () => {
        const state = await browser.execute(() => {
          const globalWindow = window as Window & { __KNURL_STARTUP_STATE__?: number };
          return globalWindow.__KNURL_STARTUP_STATE__ ?? 0;
        });
        return state === 2;
      },
      {
        timeout: 60000,
        timeoutMsg: 'Application did not reach startup state 2 within 60s',
      },
    );
    console.log(`  ✓ App startup state reached`);

    // Make config directory available to tests
    const configDir = configDirsByCapability.get(process.pid);
    if (configDir) {
      await browser.execute((dir: string) => {
        const globalWindow = window as any;
        globalWindow.__KNURL_E2E_CONFIG_DIR__ = dir;
      }, configDir);
      console.log(`  ✓ Injected __KNURL_E2E_CONFIG_DIR__ into window`);
    }

    // Enable event history tracking for E2E tests
    await browser.execute(() => {
      const globalWindow = window as Record<string, unknown>;
      globalWindow.__KNURL_ENABLE_EVENT_HISTORY = true;
    });
    console.log(`  ✓ Enabled event history tracking`);

    await browser.pause(2000);
    console.log(`  ✓ Stabilization pause complete`);
    console.log(`[before] ✓ Per-session setup complete\n`);
  },

  // Called after each individual test ends
  afterTest: async function (test, result) {
    console.log(`[afterTest] ✓ Test complete: "${test.title}"`);
    console.log(`  ${formatTestMetadata(test)}`);
    console.log(`  ${formatTestResult(result)}`);

    // Collect coverage from browser (always enabled)
    // Skip if coverage collection is disabled
    if (envFlag(process.env.KNURL_SKIP_COVERAGE)) {
      console.log(`  coverage collection skipped (KNURL_SKIP_COVERAGE=true)`);
      return;
    }

    try {
      const coverage = await browser.execute(() => {
        return (window as any).__coverage__;
      });

      if (coverage) {
        const coverageDir = path.join(process.cwd(), '.nyc_output')
        if (!existsSync(coverageDir)) {
          mkdirSync(coverageDir, { recursive: true })
        }

        const coverageFile = path.join(
          coverageDir,
          `coverage-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.json`
        )
        writeFileSync(coverageFile, JSON.stringify(coverage, null, 2))
        console.log(`  ✓ Coverage data collected and saved`);
      }
    } catch (error) {
      // Silently ignore coverage collection errors; tests should not fail due to coverage
      console.warn(`[coverage] Failed to collect coverage: ${error instanceof Error ? error.message : String(error)}`)
    }
  },

  // Called after each test suite completes
  afterSuite: async function (suite) {
    console.log(`[afterSuite] 📦 Suite complete: "${suite.title}"`);
    console.log(`  fullTitle: "${suite.fullTitle}"`);
  },

  after: async function () {
    // Coverage merge and report generation is now handled by a separate post-test process
    // See scripts/aggregate-e2e-coverage.mjs
    console.log(`[after] 🏁 Post-session cleanup (run once per session, after all tests)`);
    console.log(`[after] ✓ Session cleanup complete\n`);
  },

  onComplete: async () => {
    console.log(`\n${'='.repeat(80)}`);
    console.log('[onComplete] 🛑 Global test completion (run once after all test workers finish)');
    console.log(`  timestamp: ${new Date().toISOString()}`);
    console.log(`  stopping all test infrastructure...`);

    // Explicit cleanup when all tests are complete
    closeProcesses();

    // Clean up ports and lingering processes
    console.log(`  waiting for processes to terminate gracefully...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      console.log(`  killing processes on critical ports...`);
      killProcessesOnPort(1420);
      killProcessesOnPort(4444);
      killProcessesOnPort(4445); // WebKitWebDriver
      killProcessesOnPort(MOCK_ENDPOINT_PORT);
      console.log(`  killing lingering process patterns...`);
      killProcessesByPattern('vite');
      killProcessesByPattern('esbuild');
      killProcessesByPattern('tauri-driver');
      killProcessesByPattern('WebKitWebDriver');
      killProcessesByPattern('knurl');
      console.log(`  ✓ All processes cleaned up`);
    } catch (error) {
      // Ignore errors during cleanup - processes may already be dead
      console.log('[cleanup] Completed with expected process-already-dead errors');
    }

    console.log(`[onComplete] ✓ Global test completion done\n`);
    console.log(`${'='.repeat(80)}\n`);
  },
};

function closeProcesses() {
  exit = true;

  // Kill processes with SIGKILL (-9) for immediate termination
  if (tauriDriver && !tauriDriver.killed) {
    try {
      process.kill(-tauriDriver.pid, 'SIGKILL');
    } catch (e) {
      // Process already dead
    }
  }

  if (viteProcess && !viteProcess.killed) {
    try {
      process.kill(-viteProcess.pid, 'SIGKILL');
    } catch (e) {
      // Process already dead
    }
  }

  if (mockEndpointProcess && !mockEndpointProcess.killed) {
    try {
      process.kill(-mockEndpointProcess.pid, 'SIGKILL');
    } catch (e) {
      // Process already dead
    }
  }
}

function buildEnvWithKeyringDefaults(): NodeJS.ProcessEnv {
  const env = {...process.env};
  const hasDisable = env.KNURL_DISABLE_KEYRING != null;
  const hasExplicitEnable = env.KNURL_USE_KEYRING != null;
  if (process.platform === 'linux' && !hasDisable && !hasExplicitEnable) {
    env.KNURL_DISABLE_KEYRING = '1';
  }
  return env;
}

function onShutdown(fn) {
  const cleanup = () => {
    try {
      fn();
    } finally {
      // process.exit();
    }
  };

  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('SIGHUP', cleanup);
  process.on('SIGBREAK', cleanup);
}

// ensure tauri-driver is closed when our test process exits
onShutdown(() => {
  closeProcesses();
});

async function waitForDevServer(url: string, timeout = 30000, interval = 500) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, {method: 'GET'});
      if (res.ok) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return;
      }
    } catch (error) {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Vite dev server did not become ready at ${url} within ${timeout}ms`);
}

async function waitForEndpoint(url: string, timeout = 30000, interval = 250) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, {method: 'GET'});
      if (res.ok) {
        return;
      }
    } catch (error) {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Endpoint ${url} did not respond within ${timeout}ms`);
}

function resolveCargoHome(): string {
  const fromEnv = process.env.CARGO_HOME;
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv;
  }
  return path.join(process.env.HOME ?? homedir(), '.cargo');
}

function resolveNativeDriverPath(): string | null {
  const override = process.env.KNURL_NATIVE_DRIVER;
  if (override && override.trim().length > 0) {
    return override;
  }

  const candidate =
    process.platform === 'win32'
      ? locateExecutable('msedgedriver.exe')
      : locateExecutable('WebKitWebDriver');

  if (candidate) {
    return candidate;
  }

  if (process.platform !== 'win32') {
    const fallback = '/usr/bin/WebKitWebDriver';
    if (existsSync(fallback)) {
      return fallback;
    }
  }

  return null;
}

function locateExecutable(executable: string): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(command, [executable], {encoding: 'utf8'});
  if (result.status === 0) {
    const line = result.stdout.split(/\r?\n/).find((entry) => entry.trim().length > 0);
    if (line) {
      return line.trim();
    }
  }
  return null;
}

