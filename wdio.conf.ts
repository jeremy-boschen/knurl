/** biome-ignore-all lint/suspicious/noExplicitAny: OK */
import type { ChildProcessByStdio } from "node:child_process"
import { spawn, spawnSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { homedir, tmpdir } from "node:os"
import * as path from "node:path"
import type { Readable } from "node:stream"
import { fileURLToPath } from "node:url"

declare global {
  // eslint-disable-next-line no-var
  var browser: WebdriverIO.Browser
}

const __dirname = fileURLToPath(new URL(".", import.meta.url))

// ============================================================================
// Global State
// ============================================================================

let tauriDriver: ChildProcessByStdio<null, Readable, Readable>
let viteProcess: ChildProcessByStdio<null, Readable, Readable>
let mockEndpointProcess: ChildProcessByStdio<null, Readable, Readable>
let exit = false
const cargoHome = resolveCargoHome()
const nativeDriverPath = resolveNativeDriverPath()
const configDirsByCapability: Map<number, string> = new Map()

// Mock endpoint server configuration
const MOCK_ENDPOINT_PORT = 3000
const MOCK_ENDPOINT_HOST = "127.0.0.1"

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
  return testTitle.includes("[STATE:PRESERVE]")
}

/**
 * Reset the config directory: wipe all files and restore default settings
 */
function resetConfigDirectory(configDir: string): void {
  try {
    // Remove all files in config directory
    if (existsSync(configDir)) {
      const files = readdirSync(configDir)
      for (const file of files) {
        const filePath = path.join(configDir, file)
        rmSync(filePath, { recursive: true, force: true })
      }
    }

    // Copy fresh settings.json from fixtures
    const fixtureSettingsPath = path.join(__dirname, "test", "fixtures", "settings.json")
    const configSettingsPath = path.join(configDir, "settings.json")
    if (existsSync(fixtureSettingsPath)) {
      copyFileSync(fixtureSettingsPath, configSettingsPath)
    }
  } catch (error) {
    console.warn(`[resetConfigDirectory] Failed to reset config directory at ${configDir}:`, error)
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
    .join(" | ")
}

/**
 * Pretty-print test result for logging
 */
function formatTestResult(result: any): string {
  const parts = []
  if (result.duration !== undefined) {
    parts.push(`duration: ${result.duration}ms`)
  }
  if (result.state) {
    parts.push(`state: ${result.state}`)
  }
  if (result.error) {
    parts.push(`error: ${result.error.message}`)
  }
  return parts.length > 0 ? parts.join(" | ") : "result: passed"
}

// ============================================================================
// Process Management
// ============================================================================

function killProcessesOnPort(port: number) {
  try {
    if (process.platform === "win32") {
      spawnSync(
        "powershell.exe",
        [
          "-NoLogo",
          "-NoProfile",
          "-Command",
          `Get-NetTCPConnection -LocalPort ${port} -State Listen | Select-Object -ExpandProperty OwningProcess | ForEach-Object { if ($_ -ne $PID) { Try { Stop-Process -Id $_ -Force -ErrorAction Stop } Catch { } } }`,
        ],
        { stdio: "ignore" },
      )
      return
    }

    const lsofResult = spawnSync("lsof", ["-ti", `tcp:${port}`], { encoding: "utf8" })
    const output = lsofResult.stdout?.trim()
    if (lsofResult.status === 0 && output) {
      for (const pid of output.split(/\s+/)) {
        if (!pid) {
          continue
        }
        spawnSync("kill", ["-9", pid], { stdio: "ignore" })
      }
      return
    }

    spawnSync("fuser", ["-k", `${port}/tcp`], { stdio: "ignore" })
  } catch (error) {
    console.warn(`Failed to clean processes on port ${port}:`, error)
  }
}

function killProcessesByPattern(pattern: string) {
  try {
    if (process.platform === "win32") {
      const script = `
        Get-Process | Where-Object { $_.Path -like "*${pattern.replace(/"/g, '""')}*" } | ForEach-Object {
          Try { Stop-Process -Id $_.Id -Force -ErrorAction Stop } Catch { }
        }
      `
      spawnSync("powershell.exe", ["-NoLogo", "-NoProfile", "-Command", script], { stdio: "ignore" })
      return
    }

    const result = spawnSync("pkill", ["-9", "-f", pattern], { stdio: "ignore" })
    if (result.status === 0) {
      return
    }
  } catch {
    // ignore
  }
}

function closeProcesses() {
  exit = true

  // Kill processes with SIGKILL (-9) for immediate termination
  // Negative PID kills the process group (process + all children)
  // Ensures no orphaned child processes remain after shutdown
  if (tauriDriver && !tauriDriver.killed && tauriDriver.pid) {
    try {
      process.kill(-tauriDriver.pid, "SIGKILL")
    } catch (_e) {
      // Process already dead
    }
  }

  if (viteProcess && !viteProcess.killed && viteProcess.pid) {
    try {
      process.kill(-viteProcess.pid, "SIGKILL")
    } catch (_e) {
      // Process already dead
    }
  }

  if (mockEndpointProcess && !mockEndpointProcess.killed && mockEndpointProcess.pid) {
    try {
      process.kill(-mockEndpointProcess.pid, "SIGKILL")
    } catch (_e) {
      // Process already dead
    }
  }
}

// ============================================================================
// Environment & Resolution Utilities
// ============================================================================

function envFlag(value: string | undefined | null): boolean {
  if (typeof value !== "string") {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === "1" || normalized === "true" || normalized === "yes"
}

function buildEnvWithKeyringDefaults(): NodeJS.ProcessEnv {
  const env = { ...process.env }
  const hasDisable = env.KNURL_DISABLE_KEYRING != null
  const hasExplicitEnable = env.KNURL_USE_KEYRING != null
  if (process.platform === "linux" && !hasDisable && !hasExplicitEnable) {
    env.KNURL_DISABLE_KEYRING = "1"
  }
  return env
}

function resolveCargoHome(): string {
  const fromEnv = process.env.CARGO_HOME
  if (fromEnv && fromEnv.trim().length > 0) {
    return fromEnv
  }
  return path.join(process.env.HOME ?? homedir(), ".cargo")
}

function resolveNativeDriverPath(): string | null {
  const override = process.env.KNURL_NATIVE_DRIVER
  if (override && override.trim().length > 0) {
    return override
  }

  const candidate =
    process.platform === "win32" ? locateExecutable("msedgedriver.exe") : locateExecutable("WebKitWebDriver")

  if (candidate) {
    return candidate
  }

  if (process.platform !== "win32") {
    const fallback = "/usr/bin/WebKitWebDriver"
    if (existsSync(fallback)) {
      return fallback
    }
  }

  return null
}

function locateExecutable(executable: string): string | null {
  const command = process.platform === "win32" ? "where" : "which"
  const result = spawnSync(command, [executable], { encoding: "utf8" })
  if (result.status === 0) {
    const line = result.stdout.split(/\r?\n/).find((entry) => entry.trim().length > 0)
    if (line) {
      return line.trim()
    }
  }
  return null
}

// ============================================================================
// Async Utilities
// ============================================================================

async function waitForDevServer(url: string, timeout = 30000, interval = 500) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: "GET" })
      if (res.ok) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        return
      }
    } catch (_error) {
      // ignore until timeout
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`Vite dev server did not become ready at ${url} within ${timeout}ms`)
}

async function waitForEndpoint(url: string, timeout = 30000, interval = 250) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url, { method: "GET" })
      if (res.ok) {
        return
      }
    } catch (_error) {
      // wait and retry
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  throw new Error(`Endpoint ${url} did not respond within ${timeout}ms`)
}

// ============================================================================
// WebdriverIO Hook Implementations
// ============================================================================

/**
 * onPrepare - Global test preparation
 * Runs ONCE at the start of the entire test suite, before any sessions
 *
 * Responsibilities:
 * - Clean up processes from previous runs on critical ports
 * - Start mock endpoint server (OAuth, test APIs)
 * - Configure OAuth environment variables
 * - Build Rust backend
 * - Start Vite dev server
 * - Start tauri-driver (shared across all sessions)
 */
async function handleOnPrepare() {
  console.log(`\n${"=".repeat(80)}`)
  console.log("[onPrepare] 🔧 Global test preparation (run once for entire test suite)")
  console.log(`  timestamp: ${new Date().toISOString()}`)

  // Kill any existing processes on critical ports
  console.log(`  cleaning up processes on critical ports...`)
  killProcessesOnPort(1420)
  killProcessesOnPort(4444)
  killProcessesOnPort(4445) // WebKitWebDriver port
  killProcessesOnPort(MOCK_ENDPOINT_PORT)
  console.log(`  killing lingering processes from previous runs...`)
  killProcessesByPattern("vite")
  killProcessesByPattern("esbuild")
  killProcessesByPattern("tauri-driver")
  killProcessesByPattern("WebKitWebDriver")
  killProcessesByPattern(path.join("src-tauri", "target", "debug", "knurl"))
  console.log(`  ✓ Process cleanup complete`)

  // Start mock endpoint server
  console.log(`  starting mock endpoint server on port ${MOCK_ENDPOINT_PORT}...`)
  const mockEndpointEnv = {
    ...process.env,
    HOST: MOCK_ENDPOINT_HOST,
    PORT: String(MOCK_ENDPOINT_PORT),
  }

  mockEndpointProcess = spawn("node", ["scripts/mock-endpoint-server.mjs"], {
    cwd: process.cwd(),
    env: mockEndpointEnv,
    stdio: ["ignore", "pipe", "pipe"],
  })

  mockEndpointProcess.stdout?.on("data", (data) => {
    process.stdout.write(`[mock-endpoints] ${data}`)
  })

  mockEndpointProcess.stderr?.on("data", (data) => {
    process.stderr.write(`[mock-endpoints] ${data}`)
  })

  mockEndpointProcess.on("error", (error) => {
    console.error("[mock-endpoints] Error:", error)
  })

  mockEndpointProcess.on("exit", (code) => {
    if (!exit && (code ?? 0) !== 0) {
      console.warn(`[mock-endpoints] Exited with code: ${code ?? 0}`)
    }
  })

  await new Promise((resolve) => setTimeout(resolve, 1000))

  try {
    await waitForEndpoint(`http://${MOCK_ENDPOINT_HOST}:${MOCK_ENDPOINT_PORT}/.well-known/openid-configuration`)
    console.log(`  ✓ Mock endpoint server ready`)
  } catch (error) {
    const detail = error instanceof Error ? error.message : typeof error === "string" ? error : JSON.stringify(error)
    console.warn(`[mock-endpoints] Server startup warning: ${detail}`)
  }

  // Configure OAuth
  console.log(`  configuring OAuth environment variables...`)
  const oauthIssuer = `http://${MOCK_ENDPOINT_HOST}:${MOCK_ENDPOINT_PORT}`
  process.env.VITE_E2E_OAUTH_ISSUER = oauthIssuer
  process.env.VITE_E2E_OAUTH_CLIENT_ID = "test-client"
  process.env.VITE_E2E_OAUTH_CLIENT_SECRET = "test-secret"
  process.env.VITE_E2E_OAUTH_PUBLIC_CLIENT_ID = "public-device-client"
  process.env.VITE_E2E_STUB_OAUTH = "0"
  process.env.KNURL_OAUTH_HEADLESS = "1"
  process.env.KNURL_OAUTH_AUTO_DEVICE = "1"
  console.log(`  ✓ OAuth configured (issuer: ${oauthIssuer})`)
  console.log(`  ✓ Environment variables set`)

  // Build Rust backend
  console.log(`  building Rust backend...`)
  const manifestPath = path.resolve(__dirname, "src-tauri", "Cargo.toml")
  const env = {
    ...process.env,
    CARGO_INCREMENTAL: process.env.CARGO_INCREMENTAL ?? "1",
    RUSTFLAGS: [process.env.RUSTFLAGS].filter(Boolean).join(" ").trim(),
  }

  const buildResult = spawnSync("cargo", ["build", "--manifest-path", manifestPath, "--profile", "e2e-test"], {
    stdio: "inherit",
    shell: true,
    env,
  })

  if (buildResult.status !== 0) {
    throw new Error("cargo build failed")
  }
  console.log(`  ✓ Rust backend built successfully`)

  // Build and serve Vite production bundle
  console.log(`  building Vite production bundle with Istanbul instrumentation...`)
  const viteEnv = {
    ...buildEnvWithKeyringDefaults(),
    BROWSER: "none",
    VITE_DISABLE_SSL: "true",
    VITE_E2E_OAUTH_ISSUER: oauthIssuer,
    VITE_E2E_OAUTH_CLIENT_ID: "test-client",
    VITE_E2E_OAUTH_CLIENT_SECRET: "test-secret",
    VITE_E2E_OAUTH_PUBLIC_CLIENT_ID: "public-device-client",
    VITE_E2E_STUB_OAUTH: "0",
  }

  const iconGeneration = spawnSync("node", ["scripts/generate-knurl-icon.mjs"], {
    cwd: process.cwd(),
    shell: true,
    stdio: "ignore",
  })

  if (iconGeneration.status !== 0) {
    throw new Error("Failed to generate knurl icon")
  }

  // Build production bundle
  const viteBuildResult = spawnSync(
    "vite",
    ["build", "--config", "vite.config.e2e.ts", "--mode", "e2e"],
    {
      cwd: process.cwd(),
      shell: true,
      env: viteEnv,
      stdio: "inherit",
    },
  )

  if (viteBuildResult.status !== 0) {
    throw new Error("Vite build failed")
  }
  console.log(`  ✓ Vite production bundle built successfully`)

  // Start preview server to serve production bundle
  console.log(`  starting Vite preview server on port 1420...`)
  viteProcess = spawn(
    "vite",
    ["preview", "--config", "vite.config.e2e.ts", "--host", "127.0.0.1", "--port", "1420"],
    {
      cwd: process.cwd(),
      shell: true,
      env: viteEnv,
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  viteProcess.stdout?.on("data", (data) => {
    process.stdout.write(`[vite-preview] ${data}`)
  })

  viteProcess.stderr?.on("data", (data) => {
    process.stderr.write(`[vite-preview] ${data}`)
  })

  viteProcess.on("error", (error) => {
    console.error("vite preview server error:", error)
    process.exit(1)
  })

  viteProcess.on("exit", (code) => {
    if (!exit) {
      console.error("vite preview server exited with code:", code)
      process.exit(1)
    }
  })

  await waitForDevServer("http://127.0.0.1:1420")
  console.log(`  ✓ Vite preview server ready (serving production bundle with Istanbul coverage)`)

  // Start tauri-driver
  console.log(`  starting tauri-driver...`)
  const tauriDriverBinary = path.join(
    cargoHome,
    "bin",
    process.platform === "win32" ? "tauri-driver.exe" : "tauri-driver",
  )
  if (!existsSync(tauriDriverBinary)) {
    throw new Error(`tauri-driver not found at ${tauriDriverBinary}. Install via "cargo install tauri-driver".`)
  }
  if (!nativeDriverPath) {
    if (process.platform === "win32") {
      throw new Error(
        "Unable to locate native WebDriver (msedgedriver). Set KNURL_NATIVE_DRIVER or ensure it is on PATH.",
      )
    }
    if (process.platform === "darwin") {
      throw new Error(
        "Unable to locate native WebDriver (WebKitWebDriver). Set KNURL_NATIVE_DRIVER or ensure it is on PATH.",
      )
    }
    console.warn(
      "Native WebDriver not found; continuing without WebKitWebDriver. WebKit-specific checks are disabled on this platform.",
    )
  }

  const tauriDriverArgs = []
  if (nativeDriverPath) {
    tauriDriverArgs.push("--native-driver", nativeDriverPath)
  }

  const driverEnv = buildEnvWithKeyringDefaults()
  tauriDriver = spawn(tauriDriverBinary, tauriDriverArgs, {
    stdio: ["ignore", "pipe", "pipe"],
    env: driverEnv,
  })

  tauriDriver.stdout?.on("data", (data) => {
    console.log(`[tauri-driver stdout] ${data}`)
  })

  tauriDriver.stderr?.on("data", (data) => {
    console.log(`[tauri-driver stderr] ${data}`)
  })

  tauriDriver.on("error", (error) => {
    console.error("[tauri-driver] Failed to start:", error)
    process.exit(1)
  })

  tauriDriver.on("exit", (code) => {
    if (!exit) {
      console.error("[tauri-driver] exited with code:", code)
      process.exit(1)
    }
  })

  await new Promise((resolve) => setTimeout(resolve, 5000))
  console.log(`  ✓ tauri-driver started and ready`)
  console.log(`[onPrepare] ✓ Global test preparation complete\n`)
}

/**
 * beforeSession - Per-session initialization
 * Runs ONCE at the start of each test session (per browser instance)
 *
 * Responsibilities:
 * - Create unique config directory for this session
 * - Copy test settings fixture
 * - Inject config directory path into Tauri command-line args
 */
async function handleBeforeSession(config: any, capabilities: any, specs: any) {
  console.log(`\n${"=".repeat(80)}`)
  console.log("[beforeSession] 🚀 Session initialization starting")
  console.log(`  config: ${JSON.stringify(config)}`)
  console.log(`  capabilities: ${capabilities ? Object.keys(capabilities).join(", ") : "none"}`)
  console.log(`  specs: ${specs ? specs.length : 0} spec files`)

  const configDir = mkdtempSync(path.join(tmpdir(), "knurl-e2e-config-"))
  configDirsByCapability.set(process.pid, configDir)
  console.log(`  configDir: ${configDir}`)

  try {
    const fixtureSettingsPath = path.join(__dirname, "test", "fixtures", "settings.json")
    const configSettingsPath = path.join(configDir, "settings.json")
    if (existsSync(fixtureSettingsPath)) {
      copyFileSync(fixtureSettingsPath, configSettingsPath)
      console.log(`  ✓ Copied settings.json fixture to config directory`)
    }
  } catch (error) {
    console.warn("[beforeSession] Failed to copy settings fixture:", error)
  }

  if (capabilities && typeof capabilities === "object" && "tauri:options" in capabilities) {
    const tauriOptions = capabilities["tauri:options"]
    if (!tauriOptions.args) {
      tauriOptions.args = []
    }
    const normalizedConfigDir = configDir.replaceAll("\\", "/")
    if (process.platform === "win32") {
      tauriOptions.args.push(["--config-dir", normalizedConfigDir].join(" "))
    } else {
      tauriOptions.args.push(`--config-dir=${normalizedConfigDir}`)
    }
    console.log(`  ✓ Injected --config-dir into Tauri args`)
  }

  console.log(`[beforeSession] ✓ Session initialization complete\n`)
}

/**
 * beforeTest - Per-test setup
 * Runs BEFORE each individual test
 *
 * Responsibilities:
 * - Detect [STATE:PRESERVE] annotation in test name
 * - Reset config directory (unless [STATE:PRESERVE] is present)
 * - Log test metadata
 */
async function handleBeforeTest(test: any) {
  const configDir = configDirsByCapability.get(process.pid)
  const preserveState = shouldPreserveState(test.title)

  console.log(`\n[beforeTest] 📋 Starting test: "${test.title}"`)
  console.log(`  ${formatTestMetadata(test)}`)
  console.log(`  state annotation: ${preserveState ? "[STATE:PRESERVE] 💾" : "reset to defaults"}`)

  if (!preserveState && configDir) {
    console.log(`  resetting config directory...`)
    resetConfigDirectory(configDir)
    console.log(`  ✓ Config directory reset`)
  } else if (preserveState && configDir) {
    console.log(`  ✓ Preserving config directory state from previous test`)
  }
}

/**
 * beforeSuite - Per-suite setup
 * Runs ONCE at the start of each test suite
 *
 * Responsibilities:
 * - Log suite metadata
 */
async function handleBeforeSuite(suite: any) {
  console.log(`\n[beforeSuite] 📦 Suite starting: "${suite.title}"`)
  console.log(`  fullTitle: "${suite.fullTitle}"`)
  console.log(`  tests in suite: ${suite.tests ? suite.tests.length : "unknown"}`)
}

/**
 * before - Per-session global setup
 * Runs ONCE per session, after app starts, before first test
 *
 * Responsibilities:
 * - Wait for app startup
 * - Inject config directory into window object
 * - Enable event history tracking for E2E tests
 * - Stabilization pause
 */
async function handleBefore() {
  console.log(`\n[before] 🌐 Per-session setup (run once per session, before first test)`)
  console.log(`  waiting for app to reach startup state 2...`)

  await browser.waitUntil(
    async () => {
      const state = await browser.execute(() => {
        const globalWindow = window as Window & { __KNURL_STARTUP_STATE__?: number }
        return globalWindow.__KNURL_STARTUP_STATE__ ?? 0
      })
      return state === 2
    },
    {
      timeout: 60000,
      timeoutMsg: "Application did not reach startup state 2 within 60s",
    },
  )
  console.log(`  ✓ App startup state reached`)

  const configDir = configDirsByCapability.get(process.pid)
  if (configDir) {
    await browser.execute((dir: string) => {
      const globalWindow = window as any
      globalWindow.__KNURL_E2E_CONFIG_DIR__ = dir
    }, configDir)
    console.log(`  ✓ Injected __KNURL_E2E_CONFIG_DIR__ into window`)
  }

  await browser.execute(() => {
    const globalWindow = window as unknown as Record<string, unknown>
    globalWindow.__KNURL_ENABLE_EVENT_HISTORY = true
  })
  console.log(`  ✓ Enabled event history tracking`)

  await browser.pause(2000)
  console.log(`  ✓ Stabilization pause complete`)
  console.log(`[before] ✓ Per-session setup complete\n`)
}

/**
 * afterTest - Per-test teardown
 * Runs AFTER each individual test
 *
 * Responsibilities:
 * - Log test result and metadata
 * - Collect Istanbul coverage from browser
 */
async function handleAfterTest(test: any, result: any) {
  console.log(`[afterTest] ✓ Test complete: "${test.title}"`)
  console.log(`  ${formatTestMetadata(test)}`)
  console.log(`  ${formatTestResult(result)}`)

  if (envFlag(process.env.KNURL_SKIP_COVERAGE)) {
    console.log(`  coverage collection skipped (KNURL_SKIP_COVERAGE=true)`)
    return
  }

  try {
    const coverage = await browser.execute(() => {
      return (window as any).__coverage__
    })

    if (coverage) {
      const coverageDir = path.join(process.cwd(), ".nyc_output")
      if (!existsSync(coverageDir)) {
        mkdirSync(coverageDir, { recursive: true })
      }

      const coverageFile = path.join(
        coverageDir,
        `coverage-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.json`,
      )
      writeFileSync(coverageFile, JSON.stringify(coverage, null, 2))
      console.log(`  ✓ Coverage data collected and saved`)
    }
  } catch (error) {
    console.warn(`[coverage] Failed to collect coverage: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * afterSuite - Per-suite teardown
 * Runs ONCE at the end of each test suite
 *
 * Responsibilities:
 * - Log suite completion
 */
async function handleAfterSuite(suite: any) {
  console.log(`[afterSuite] 📦 Suite complete: "${suite.title}"`)
  console.log(`  fullTitle: "${suite.fullTitle}"`)
}

/**
 * afterSession - Per-session teardown
 * Runs ONCE per session, after all tests complete
 *
 * Responsibilities:
 * - Log session end (tauri-driver is shared and cleaned in onComplete)
 */
async function handleAfterSession() {
  console.log(`\n[afterSession] 🏁 Session ending`)
}

/**
 * after - Per-session global teardown
 * Runs ONCE per session, after all tests complete
 *
 * Responsibilities:
 * - Post-session cleanup (coverage processing handled separately)
 */
async function handleAfter() {
  console.log(`[after] 🏁 Post-session cleanup (run once per session, after all tests)`)
  console.log(`[after] ✓ Session cleanup complete\n`)
}

/**
 * onComplete - Global test completion
 * Runs ONCE at the very end, after all workers finish
 *
 * Responsibilities:
 * - Kill all processes (Vite, tauri-driver, mock server)
 * - Clean up critical ports
 * - Kill lingering processes
 */
async function handleOnComplete() {
  console.log(`\n${"=".repeat(80)}`)
  console.log("[onComplete] 🛑 Global test completion (run once after all test workers finish)")
  console.log(`  timestamp: ${new Date().toISOString()}`)
  console.log(`  stopping all test infrastructure...`)

  closeProcesses()

  console.log(`  waiting for processes to terminate gracefully...`)
  await new Promise((resolve) => setTimeout(resolve, 500))
  try {
    console.log(`  killing processes on critical ports...`)
    killProcessesOnPort(1420)
    killProcessesOnPort(4444)
    killProcessesOnPort(4445)
    killProcessesOnPort(MOCK_ENDPOINT_PORT)
    console.log(`  killing lingering process patterns...`)
    killProcessesByPattern("vite")
    killProcessesByPattern("esbuild")
    killProcessesByPattern("tauri-driver")
    killProcessesByPattern("WebKitWebDriver")
    killProcessesByPattern("knurl")
    console.log(`  ✓ All processes cleaned up`)
  } catch (_error) {
    console.log("[cleanup] Completed with expected process-already-dead errors")
  }

  console.log(`[onComplete] ✓ Global test completion done\n`)
  console.log(`${"=".repeat(80)}\n`)
}

// ============================================================================
// Process Lifecycle
// ============================================================================

function onShutdown(fn: () => void) {
  const cleanup = () => {
    try {
      fn()
    } finally {
      // process.exit();
    }
  }

  process.on("exit", cleanup)
  process.on("SIGINT", cleanup)
  process.on("SIGTERM", cleanup)
  process.on("SIGHUP", cleanup)
  process.on("SIGBREAK", cleanup)
}

onShutdown(() => {
  closeProcesses()
})

// ============================================================================
// WebdriverIO Configuration
// ============================================================================

const runningDocs =
  process.argv.join(" ").includes("--suite docs") ||
  process.argv.join(" ").includes("/documentation/e2e/") ||
  process.argv.join(" ").includes("documentation/e2e")

export const config = {
  host: "127.0.0.1",
  port: 4444,
  logLevel: "error",
  specs: ["./test/specs/**/*.ts", "./documentation/e2e/**/*.e2e.ts"],
  exclude: runningDocs ? ["./test/specs/**/*.ts"] : ["./documentation/e2e/**/*.e2e.ts"],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: "src-tauri/target/debug/knurl",
        args: ["--window-width=1440", "--window-height=900"],
      },
    },
  ],
  reporters: [
    ["spec", { symbols: { success: "✓", pending: "○", fail: "✕" }, realtimeReporting: false }],
    ["json", { outputDir: "./test-results", outputFileFormat: (opts: { cid: any }) => `results-${opts.cid}.json` }],
  ],
  framework: "mocha",
  baseUrl: "http://localhost:1420",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
    reporter: "spec",
    reporterOptions: {
      enableTimeouts: true,
    },
  },

  // WebdriverIO Hooks
  onPrepare: handleOnPrepare,
  beforeSession: handleBeforeSession,
  beforeTest: handleBeforeTest,
  beforeSuite: handleBeforeSuite,
  before: handleBefore,
  afterTest: handleAfterTest,
  afterSuite: handleAfterSuite,
  afterSession: handleAfterSession,
  after: handleAfter,
  onComplete: handleOnComplete,
}
