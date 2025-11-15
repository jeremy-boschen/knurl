import * as path from 'node:path';
import {existsSync, mkdtempSync, mkdirSync, writeFileSync} from 'node:fs';
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
  suites: {
    docs: ['./documentation/e2e/**/*.e2e.ts'],
    collections: ['./test/specs/collections-flow.e2e.ts', './test/specs/collections-management.e2e.ts', './test/specs/large-collections.e2e.ts', './test/specs/collection-storage.e2e.ts', './test/specs/collection-merge.e2e.ts'],
    workspace: ['./test/specs/workspace-restore.e2e.ts', './test/specs/scratch-collection.e2e.ts'],
    auth: ['./test/specs/oauth-flows.e2e.ts', './test/specs/oauth-ui-flows.e2e.ts', './test/specs/auth-strategies.e2e.ts'],
    request: ['./test/specs/request-authoring.e2e.ts', './test/specs/response-analysis.e2e.ts', './test/specs/request-network-errors.e2e.ts', './test/specs/variable-interpolation.e2e.ts', './test/specs/multi-tab-edits.e2e.ts', './test/specs/large-payloads.e2e.ts', './test/specs/request-cancellation.e2e.ts'],
    ui: ['./test/specs/ui-library.e2e.ts'],
    launch: ['./test/specs/launch-hydration.e2e.ts', './test/specs/app.e2e.ts'],
    env: ['./test/specs/environment-management.e2e.ts'],
  },
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
  reporters: ['spec'],
  framework: 'mocha',
  baseUrl: 'http://localhost:1420',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // ensure the rust project is built since we expect this binary to exist for the webdriver sessions
  onPrepare: async () => {
    killProcessesOnPort(1420);
    killProcessesOnPort(4444);
    killProcessesOnPort(MOCK_ENDPOINT_PORT);
    killProcessesByPattern(path.join('src-tauri', 'target', 'debug', 'knurl'));

    // Start mock endpoint server (OAuth, GitHub API, and other test endpoints)
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
    const oauthIssuer = `http://${MOCK_ENDPOINT_HOST}:${MOCK_ENDPOINT_PORT}`;
    process.env.VITE_E2E_OAUTH_ISSUER = oauthIssuer;
    process.env.VITE_E2E_OAUTH_CLIENT_ID = 'test-client';
    process.env.VITE_E2E_OAUTH_CLIENT_SECRET = 'test-secret';
    process.env.VITE_E2E_OAUTH_PUBLIC_CLIENT_ID = 'public-device-client';
    process.env.VITE_E2E_STUB_OAUTH = '0';
    process.env.KNURL_OAUTH_HEADLESS = '1';
    process.env.KNURL_OAUTH_AUTO_DEVICE = '1';

    // Don't set config dir in onPrepare; it will be set per-capability in beforeSession
    // This allows each test suite/capability to have its own config directory

    const manifestPath = path.resolve(__dirname, 'src-tauri', 'Cargo.toml');
    const env = {
      ...process.env,
      CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL ?? '1',
      RUSTFLAGS: [process.env.RUSTFLAGS, '-C opt-level=0', '-C debuginfo=1'].filter(Boolean).join(' ').trim(),
    };

    const buildResult = spawnSync('cargo', ['build', '--manifest-path', manifestPath, '--profile', 'dev'], {
      stdio: 'inherit',
      shell: true,
      env,
    });

    if (buildResult.status !== 0) {
      throw new Error('cargo build failed');
    }

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
    viteProcess = spawn('yarn', ['dev', '--config', 'vite.config.e2e.ts', '--host', '127.0.0.1', '--port', '1420', '--mode', 'e2e'], {
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

    // Start tauri-driver once for all workers (only once in onPrepare, not repeated in beforeSession)
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

    // tauri-driver is now started per-session in beforeSession hook
    console.log('[tauri-driver] Per-session tauri-driver isolation enabled');
  },

  // Create a unique config directory for each session to prevent test pollution
  beforeSession: async (config, capabilities, specs) => {
    // Create a unique config directory for this capability/session
    // This prevents test pollution when multiple suites run in parallel
    const configDir = mkdtempSync(path.join(tmpdir(), 'knurl-e2e-config-'));
    configDirsByCapability.set(process.pid, configDir);

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
    }

    // Start a fresh tauri-driver for this session to prevent session accumulation
    const tauriDriverBinary = path.join(cargoHome, 'bin', 'tauri-driver');
    const tauriDriverArgs = [];
    if (nativeDriverPath) {
      tauriDriverArgs.push('--native-driver', nativeDriverPath);
    }

    const driverEnv = buildEnvWithKeyringDefaults();
    const sessionDriver = spawn(tauriDriverBinary, tauriDriverArgs, {
      stdio: [null, process.stdout, process.stderr],
      env: driverEnv,
    });

    sessionDriver.on('error', (error) => {
      console.error(`[tauri-driver] Session error: ${error}`);
    });

    sessionDriver.on('exit', (code) => {
      if (!exit && code !== 0) {
        console.warn(`[tauri-driver] Session exited with code: ${code}`);
      }
    });

    tauriDriversByCapability.set(process.pid, sessionDriver);
    console.log(`[tauri-driver] Started session driver for PID ${process.pid}`);

    // Wait for driver to be ready
    await new Promise((resolve) => setTimeout(resolve, 500));
  },

  // clean up the per-session tauri-driver process
  afterSession: () => {
    const sessionDriver = tauriDriversByCapability.get(process.pid);
    if (sessionDriver) {
      console.log(`[tauri-driver] Killing session driver for PID ${process.pid}`);
      try {
        sessionDriver.kill('SIGTERM');
        tauriDriversByCapability.delete(process.pid);
      } catch (error) {
        console.warn(`[tauri-driver] Failed to kill session driver: ${error}`);
      }
    }
  },

  before: async () => {
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

    await browser.pause(2000);
  },

  afterTest: async function (test) {
    // Collect coverage from browser (always enabled)
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
      }
    } catch (error) {
      // Silently ignore coverage collection errors; tests should not fail due to coverage
      console.warn(`[coverage] Failed to collect coverage: ${error instanceof Error ? error.message : String(error)}`)
    }
  },

  after: async function () {
    // Merge and generate coverage reports once after all tests complete
    try {
      const { execSync } = await import('child_process')
      const coverageDir = path.join(process.cwd(), '.nyc_output')

      if (existsSync(coverageDir)) {
        console.log('\n[coverage] Merging E2E coverage data...')
        execSync('nyc merge .nyc_output coverage/e2e-coverage.json', {
          cwd: process.cwd(),
          stdio: 'pipe',
        })

        console.log('[coverage] Generating E2E coverage report...')
        execSync('nyc report --reporter=html --reporter=json --reporter=lcov --temp-dir=.nyc_output --report-dir=coverage/e2e', {
          cwd: process.cwd(),
          stdio: 'pipe',
        })

        console.log('[coverage] ✓ E2E coverage report generated in coverage/e2e/')
      }
    } catch (error) {
      console.warn(`[coverage] Failed to generate coverage report: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
};

function closeProcesses() {
  exit = true;
  tauriDriver?.kill();
  viteProcess?.kill();
  mockEndpointProcess?.kill();
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

