#!/usr/bin/env node

/**
 * Feature Manifest Generator for Knurl (and other multi-tech repositories)
 *
 * A production-ready tool that scans a repository, extracts structured signals
 * (routes, endpoints, schemas, configs, data models, etc.), and uses a local
 * Ollama model to infer and document features with evidence-based citations.
 *
 * LANGUAGE CHOICE RATIONALE:
 * Node.js/ESM chosen to:
 * - Keep everything in the project's existing tech stack (React/TypeScript/Node)
 * - Avoid Python dependency on dev machines
 * - Use yarn for consistent package management
 * - Leverage existing build tooling
 * - Better integration with CI/CD
 *
 * Usage:
 *   node scripts/feature-manifest.mjs --repo . --out ./manifest
 *   node scripts/feature-manifest.mjs --repo . --dry-run
 */

import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"
import { globSync } from "glob"
import yaml from "js-yaml"
import { parseArgs } from "util"
import { readFile, mkdir, writeFile } from "fs/promises"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ============================================================================
// CONFIGURATION
// ============================================================================

const DEFAULT_OLLAMA_BASE_URL = "http://host.docker.internal:11434"
const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b"
const GENERATOR_VERSION = "0.2.0"

// Context window management
// Qwen2.5-Coder-7B supports 131K tokens with YaRN enabled in config.json:
// {"rope_scaling": {"type": "yarn", "factor": 4.0, "original_max_position_embeddings": 32768}}
// Default: 32K tokens. Conservative limit: 120K (leaving headroom)
const MAX_CONTEXT_TOKENS = 120000
const AVG_TOKENS_PER_CHAR = 0.25 // Rough estimate: 1 token ≈ 4 chars
const MAX_CONTEXT_CHARS = Math.floor(MAX_CONTEXT_TOKENS / AVG_TOKENS_PER_CHAR)
const MAX_FILE_CHARS = 5000 // Max chars per file to include

const DEFAULT_IGNORE_PATTERNS = [
  ".git",
  ".github",
  ".gitlab",
  ".vscode",
  ".idea",
  ".gradle",
  "node_modules",
  ".yarn",
  "target",
  "dist",
  "build",
  ".next",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
  ".cargo",
  "*.lock",
  "*.o",
  "*.a",
  "*.so",
  "*.exe",
  "*.dll",
  "*.dylib",
  "*.class",
  "*.jar",
  ".DS_Store",
  "Thumbs.db",
  "*.jpg",
  "*.jpeg",
  "*.png",
  "*.gif",
  "*.mp4",
  "*.mov",
  "*.zip",
  "*.tar.gz",
  ".env",
  ".env.local",
  ".env.*.local",
]

const FILE_TYPE_PATTERNS = {
  code: /\.(ts|tsx|js|jsx|rs|java|kt|py|go)$/i,
  config: /\.(json|yaml|yml|toml|ini|env|conf)$/i,
  test: /(test|spec)\.(ts|tsx|js|jsx)$/i,
  docs: /\.(md|mdx|rst|txt)$/i,
  data: /\.(sql|graphql|proto)$/i,
}

// ============================================================================
// LOGGING
// ============================================================================

class Logger {
  constructor(level = "INFO") {
    this.level = level
    this.levels = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 }
  }

  shouldLog(messageLevel) {
    return this.levels[messageLevel] >= this.levels[this.level]
  }

  debug(msg) {
    if (this.shouldLog("DEBUG")) console.log(`[DEBUG] ${msg}`)
  }

  info(msg) {
    if (this.shouldLog("INFO")) console.log(`[INFO] ${msg}`)
  }

  warn(msg) {
    if (this.shouldLog("WARNING")) console.warn(`[WARNING] ${msg}`)
  }

  error(msg) {
    if (this.shouldLog("ERROR")) console.error(`[ERROR] ${msg}`)
  }
}

// ============================================================================
// REPOSITORY SCANNER
// ============================================================================

class RepositoryScanner {
  constructor(repoPath, noDefaultIgnores = false, logger) {
    this.repoPath = repoPath
    this.logger = logger
    this.files = []
    this.techStack = new Set()
    this.ignorePatterns = new Set()

    if (!noDefaultIgnores) {
      DEFAULT_IGNORE_PATTERNS.forEach((p) => this.ignorePatterns.add(p))
    }

    this.loadGitignore()
  }

  loadGitignore() {
    const gitignorePath = path.join(this.repoPath, ".gitignore")
    if (fs.existsSync(gitignorePath)) {
      try {
        const content = fs.readFileSync(gitignorePath, "utf-8")
        content.split("\n").forEach((line) => {
          const trimmed = line.trim()
          if (trimmed && !trimmed.startsWith("#")) {
            this.ignorePatterns.add(trimmed)
          }
        })
      } catch (e) {
        this.logger.warn(`Failed to load .gitignore: ${e.message}`)
      }
    }
  }

  shouldIgnore(relPath) {
    const name = path.basename(relPath)
    for (const pattern of this.ignorePatterns) {
      if (name === pattern || relPath.includes(pattern)) {
        return true
      }
    }
    return false
  }

  detectFileType(filePath) {
    for (const [type, regex] of Object.entries(FILE_TYPE_PATTERNS)) {
      if (regex.test(filePath)) {
        return type
      }
    }
    return "other"
  }

  computeHash(content) {
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16)
  }

  scan(maxFiles) {
    this.logger.info(`Scanning repository: ${this.repoPath}`)

    // Use forward slashes for glob pattern (cross-platform)
    const cwd = this.repoPath
    const files = globSync("**/*", {
      cwd: cwd,
      dot: true,
      nodir: true,
      absolute: true,
      ignore: Array.from(this.ignorePatterns).map((p) => {
        // Glob ignore patterns need to be relative to cwd
        return p.replace(/^\/+/, "")
      }),
    })

    let count = 0
    for (const filePath of files) {
      if (maxFiles && count >= maxFiles) break

      // filePath is already absolute from glob with absolute: true
      const relPath = path.relative(this.repoPath, filePath).replace(/\\/g, "/")

      // Skip if we've already filtered it via ignore patterns
      if (this.shouldIgnore(relPath)) continue

      try {
        const stat = fs.statSync(filePath)
        const content = fs.readFileSync(filePath)

        this.files.push({
          path: relPath, // Already normalized with forward slashes
          absPath: filePath,
          size: stat.size,
          mtime: stat.mtimeMs,
          contentHash: this.computeHash(content),
          fileType: this.detectFileType(relPath), // Use normalized path for detection
          isIgnored: false,
        })
        count++
      } catch (e) {
        this.logger.debug(`Failed to index ${relPath}: ${e.message}`)
      }
    }

    this.logger.info(`Indexed ${this.files.length} files`)
    this.detectTechStack()
  }

  detectTechStack() {
    const indicators = {
      "package.json": "Node/Yarn",
      "Cargo.toml": "Rust",
      "pom.xml": "Java/Maven",
      "build.gradle": "Java/Gradle",
      "build.gradle.kts": "Kotlin/Gradle",
      "pyproject.toml": "Python",
      "go.mod": "Go",
      "tsconfig.json": "TypeScript",
      "vite.config": "Vite",
      "astro.config": "Astro",
      "tailwind.config": "Tailwind CSS",
      ".github/workflows": "GitHub Actions",
    }

    for (const file of this.files) {
      for (const [indicator, tech] of Object.entries(indicators)) {
        if (file.path.includes(indicator)) {
          this.techStack.add(tech)
        }
      }
    }

    this.logger.info(`Detected tech stack: ${Array.from(this.techStack).join(", ")}`)
  }

  getFiles() {
    return this.files
  }

  getTechStack() {
    return Array.from(this.techStack)
  }
}

// ============================================================================
// SIGNAL EXTRACTOR
// ============================================================================

class SignalExtractor {
  static extractFromFile(fileInfo) {
    const signals = {
      routes: new Set(),
      endpoints: new Set(),
      schemas: new Set(),
      models: new Set(),
      config: new Set(),
      exports: new Set(),
    }

    if (!["code", "config", "data"].includes(fileInfo.fileType)) {
      return signals
    }

    try {
      const content = fs.readFileSync(fileInfo.absPath, "utf-8")

      // Routes
      const routePatterns = [
        /(?:path|href|route)=["']([^"']+)["']/g,
        /<Route\s+path=["']([^"']+)["']/g,
        /(?:path|route):\s*["']([^"']+)["']/g,
        /Router\s*\(\s*\)\s*{[^}]*<Route\s+path=["']([^"']+)["']/gs,
        /route\(["']([^"']+)["']/g,
      ]
      routePatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(content)) !== null) {
          signals.routes.add(match[1])
        }
      })

      // Endpoints (HTTP + Tauri)
      const endpointPatterns = [
        /(?:POST|GET|PUT|DELETE|PATCH)\s+["']([^"']+)["']/g,
        /(?:post|get|put|delete|patch)\(["']([^"']+)["']/g,
        /#\[tauri::command\][^}]*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/gs,
        /invoke\(["']([^"']+)["']/g,
        /invoke\s*<[^>]+>\(["']([^"']+)["']/g,
      ]
      endpointPatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(content)) !== null) {
          signals.endpoints.add(match[1])
        }
      })

      // Models
      const modelPatterns = [
        /(?:interface|type)\s+(\w+)(?:\s*extends|\s*{)?/g,
        /class\s+(\w+)/g,
        /struct\s+(\w+)/g,
      ]
      modelPatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(content)) !== null) {
          signals.models.add(match[1])
        }
      })

      // Exports
      const exportPatterns = [
        /export\s+(?:function|const|class|interface)\s+(\w+)/g,
        /^export\s+default\s+(\w+)/gm,
      ]
      exportPatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(content)) !== null) {
          signals.exports.add(match[1])
        }
      })

      // Config
      const configPatterns = [
        /(?:const|let|var)\s+(\w+)\s*=\s*(?:process\.env\.|config\.)/g,
        /env\[?["']([^"']+)["']?/g,
      ]
      configPatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(content)) !== null) {
          signals.config.add(match[1])
        }
      })
    } catch (e) {
      // Ignore read errors
    }

    return signals
  }
}

// ============================================================================
// BASELINE MANIFEST LOADING
// ============================================================================

function loadBaselineManifest(outDir, logger) {
  const manifestPath = path.join(outDir, "feature-manifest.json")
  try {
    if (fs.existsSync(manifestPath)) {
      const content = fs.readFileSync(manifestPath, "utf-8")
      const manifest = JSON.parse(content)
      logger.info(`Loaded baseline manifest with ${manifest.features.length} existing features`)
      return manifest
    }
  } catch (e) {
    logger.debug(`Could not load baseline manifest: ${e.message}`)
  }
  return null
}

function formatBaselineForContext(baselineManifest, area) {
  if (!baselineManifest) return ""

  const areaFeatures = baselineManifest.features.filter(
    (f) => f.area.toLowerCase().replace(/[/ ]+/g, "-") === area.toLowerCase().replace(/[/ ]+/g, "-")
  )

  if (areaFeatures.length === 0) return ""

  const formatted = areaFeatures
    .map((f) => `- ${f.name}: ${f.summary_user}`)
    .join("\n")

  return `\n## Previous Analysis (for reference/refinement):\n${formatted}\n`
}

// ============================================================================
// FEATURE INFERENCE
// ============================================================================

function inferAreaFromPath(filePath) {
  const lower = filePath.toLowerCase()
  if (lower.includes("auth") || lower.includes("oauth") || lower.includes("login"))
    return "Auth"
  if (
    lower.includes("http") ||
    lower.includes("request") ||
    lower.includes("client") ||
    lower.includes("request-builder") ||
    lower.includes("response")
  )
    return "HTTP Client"
  if (lower.includes("settings") || lower.includes("config") || lower.includes("preference"))
    return "Settings"
  if (lower.includes("sync") || lower.includes("synchroniz")) return "Sync"
  if (lower.includes("build") || lower.includes(".github") || lower.includes("workflow"))
    return "Build/CI"
  if (lower.includes("collections") || lower.includes("workspace")) return "Collections"
  if (lower.includes("ui") || lower.includes("component")) return "UI/UX"
  if (lower.includes("test") || lower.includes("spec") || lower.includes("e2e"))
    return "Testing"
  if (lower.includes("documentation") || lower.includes("docs")) return "Documentation"
  return "Core"
}

async function buildManifest(
  scanner,
  ollamaUrl,
  model,
  logger,
  outDir,
  appName = "Knurl",
  appDescription = "Desktop HTTP client"
) {
  const files = scanner.getFiles()

  // Load baseline manifest to use as context for refinement
  const baselineManifest = loadBaselineManifest(outDir, logger)

  const manifest = {
    app_name: appName,
    app_description: appDescription,
    tech_stack: scanner.getTechStack().sort(),
    modules: ["Frontend", "Backend", "Documentation"],
    generated_at: new Date().toISOString(),
    generator_version: GENERATOR_VERSION,
    features: [],
  }

  // Select key files for analysis (code and config files)
  const codeFiles = files.filter((f) => ["code", "config"].includes(f.fileType))

  logger.info(`Selected ${codeFiles.length} code files for analysis`)

  // Group files by area for better context
  const filesByArea = new Map()
  for (const file of codeFiles) {
    const area = inferAreaFromPath(file.path)
    if (!filesByArea.has(area)) {
      filesByArea.set(area, [])
    }
    filesByArea.get(area).push(file)
  }

  logger.info(`Grouped into ${filesByArea.size} areas`)

  // Process each area through Ollama, respecting context window
  for (const [area, areaFiles] of Array.from(filesByArea).sort()) {
    try {
      logger.debug(`Analyzing ${area} (${areaFiles.length} files)...`)

      // Build code context within context window limit
      const codeChunks = []
      let currentChunkSize = 0

      for (const file of areaFiles) {
        try {
          let content = fs.readFileSync(file.absPath, "utf-8")

          // Truncate large files
          if (content.length > MAX_FILE_CHARS) {
            content = content.slice(0, MAX_FILE_CHARS) + "\n... (truncated)"
          }

          const formatted = `File: ${file.path}\n\`\`\`\n${content}\n\`\`\``
          const size = formatted.length

          // Check if adding this file would exceed context window
          if (currentChunkSize + size > MAX_CONTEXT_CHARS && codeChunks.length > 0) {
            logger.debug(
              `Context limit reached for ${area}. Stopping at ${codeChunks.length} files.`
            )
            break
          }

          codeChunks.push(formatted)
          currentChunkSize += size
        } catch (e) {
          logger.debug(`Failed to read ${file.path}: ${e.message}`)
        }
      }

      if (codeChunks.length === 0) {
        logger.debug(`No readable files in ${area}, skipping`)
        continue
      }

      const codeContext = codeChunks.join("\n\n")
      const baselineContext = formatBaselineForContext(baselineManifest, area)

      const prompt = `You are analyzing code to document features for user-facing documentation.
Focus on: what users can DO, not implementation details or internal architecture.

Area: ${area}

## Current Code:
${codeContext}
${baselineContext}

Based on the code, identify and refine user-facing features in this area.
For each feature, provide:

1. **Feature name** - Clear, user-focused (e.g., "Request Authoring" not "RequestComponent")
2. **User summary** - What value does this provide? How do users interact with it?
3. **Business summary** - Why does this exist? What problem does it solve?
4. Entry points (optional) - Where users access it (routes, menu items, UI actions)
5. Key entities (optional) - Important concepts/data models users deal with
6. Configuration (optional) - Settings or options users can configure

Respond ONLY with valid JSON. Include all features, refined from baseline if present:

{
  "features": [
    {
      "id": "feature-slug",
      "name": "User-Facing Feature Name",
      "summary_user": "What users see and do",
      "summary_business": "Why this exists",
      "entry_points": ["optional: routes or UI paths"],
      "entities": ["optional: key concepts"],
      "config": ["optional: user-configurable settings"]
    }
  ]
}`

      const response = await callOllama(ollamaUrl, model, prompt, logger)

      // Parse Ollama response
      let features = []
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          features = parsed.features || []
        }
      } catch (e) {
        logger.warn(`Failed to parse Ollama response for ${area}: ${e.message}`)
        continue
      }

      logger.debug(`Found ${features.length} features in ${area}`)

      // Create feature objects from Ollama analysis
      for (const feat of features) {
        const areaSlug = area.toLowerCase().replace(/[/ ]+/g, "-")
        // Use feat.id directly if it already contains area prefix, otherwise prepend
        const featureId = (feat.id || "feature").toLowerCase()
        const hasAreaPrefix = featureId.startsWith(`${areaSlug}.`)
        const finalId = hasAreaPrefix ? featureId : `${areaSlug}.${featureId}`

        const feature = {
          id: finalId,
          name: feat.name || `${area} Feature`,
          area,
          summary_user: feat.summary_user || `${area} functionality`,
          summary_business: feat.summary_business || `Enables ${area.toLowerCase()}`,
          status: "active",
          confidence: 0.8, // Ollama analysis confidence
          last_verified: new Date().toISOString(),
          evidence: [],
        }

        // Add evidence from files in this area
        let evidenceCount = 0
        for (const file of codeChunks.length > 0 ? areaFiles : []) {
          if (evidenceCount < 3) {
            feature.evidence.push({
              filePath: file.path,
              lineStart: 1,
              lineEnd: 100,
              contentHash: file.contentHash,
              snippet: `Evidence from ${file.path}`,
            })
            evidenceCount++
          }
        }

        // Populate from Ollama analysis
        if (feat.entry_points && feat.entry_points.length > 0) {
          feature.entry_points = {
            ui_routes: feat.entry_points.slice(0, 5).map((ep) => ({
              path: ep,
              component: null,
              files: areaFiles.slice(0, 2).map((f) => f.path),
            })),
          }
        }

        if (feat.entities && feat.entities.length > 0) {
          feature.data_model = {
            entities: feat.entities.slice(0, 5).map((entity) => ({
              name: entity,
              fields: {},
              primary_keys: [],
              relations: {},
              files: areaFiles.slice(0, 2).map((f) => f.path),
            })),
          }
        }

        if (feat.config && feat.config.length > 0) {
          feature.configuration = {
            env_vars: feat.config.slice(0, 5).map((cfg) => ({
              name: cfg,
              required: false,
              default: null,
              used_in_files: areaFiles.slice(0, 2).map((f) => f.path),
            })),
          }
        }

        manifest.features.push(feature)
      }
    } catch (error) {
      logger.warn(`Error analyzing ${area}: ${error.message}`)
    }
  }

  return manifest
}

async function verifyOllamaSetup(baseUrl, model, logger) {
  try {
    logger.debug(`Verifying Ollama setup at ${baseUrl}...`)

    // Check if Ollama is running
    const tagsResponse = await fetch(`${baseUrl}/api/tags`)
    if (!tagsResponse.ok) {
      throw new Error(`Ollama not responding: ${tagsResponse.status}`)
    }

    const tags = await tagsResponse.json()
    const availableModels = tags.models?.map((m) => m.name) || []

    if (!availableModels.includes(model)) {
      throw new Error(
        `Model "${model}" not found. Available models: ${availableModels.join(", ") || "none"}`
      )
    }

    logger.info(`✓ Ollama is running with model "${model}"`)

    // Check currently loaded models
    const psResponse = await fetch(`${baseUrl}/api/ps`)
    if (psResponse.ok) {
      const ps = await psResponse.json()
      const loadedModels = ps.models?.map((m) => m.model) || []

      if (loadedModels.length > 1) {
        logger.warn(
          `Multiple models loaded: ${loadedModels.join(", ")}. Consider running: ollama rm <model-name>`
        )
      } else if (loadedModels.length === 1) {
        logger.debug(`✓ Only one model loaded: ${loadedModels[0]}`)
      }
    }

    return true
  } catch (error) {
    logger.error(`Ollama verification failed: ${error.message}`)
    throw error
  }
}

async function callOllama(baseUrl, model, prompt, logger) {
  try {
    logger.debug(`Calling Ollama with model ${model}...`)

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        temperature: 0.3, // Lower temperature for more consistent analysis
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    return data.response || ""
  } catch (error) {
    logger.error(`Ollama call failed: ${error.message}`)
    throw error
  }
}

// ============================================================================
// OUTPUT
// ============================================================================

async function emitManifest(manifest, outDir) {
  await mkdir(outDir, { recursive: true })

  // YAML
  const yamlContent = yaml.dump(manifest, { indent: 2, lineWidth: -1 })
  await writeFile(path.join(outDir, "feature-manifest.yaml"), yamlContent)

  // JSON
  const jsonContent = JSON.stringify(manifest, null, 2)
  await writeFile(path.join(outDir, "feature-manifest.json"), jsonContent)

  // Per-feature files
  const featuresDir = path.join(outDir, "features")
  for (const feature of manifest.features) {
    const areaDir = path.join(featuresDir, feature.area.toLowerCase().replace(/[/ ]+/g, "-"))
    await mkdir(areaDir, { recursive: true })

    // Feature YAML
    const featureYaml = yaml.dump(feature, { indent: 2, lineWidth: -1 })
    await writeFile(path.join(areaDir, `${feature.id}.yaml`), featureYaml)

    // Evidence
    const evidenceJson = JSON.stringify(feature.evidence, null, 2)
    await writeFile(path.join(areaDir, `${feature.id}.evidence.json`), evidenceJson)
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const { values: args } = parseArgs({
    options: {
      repo: { type: "string", default: "." },
      out: { type: "string", default: "./knurl-manifest" },
      model: { type: "string", default: DEFAULT_OLLAMA_MODEL },
      "ollama-url": { type: "string", default: DEFAULT_OLLAMA_BASE_URL },
      "max-files": { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "log-level": { type: "string", default: "INFO" },
      help: { type: "boolean", default: false },
    },
  })

  const logger = new Logger(args["log-level"])

  if (args.help) {
    console.log(`
Feature Manifest Generator v${GENERATOR_VERSION}

Usage: node scripts/feature-manifest.mjs [OPTIONS]

Options:
  --repo <path>         Repository path (default: .)
  --out <path>          Output directory (default: ./knurl-manifest)
  --model <name>        Ollama model (default: ${DEFAULT_OLLAMA_MODEL})
  --ollama-url <url>    Ollama URL (default: ${DEFAULT_OLLAMA_BASE_URL})
  --max-files <num>     Limit files to process (for testing)
  --dry-run             Plan only; don't generate output
  --log-level <level>   Log level: DEBUG|INFO|WARNING|ERROR (default: INFO)
  --help                Show this help message
    `)
    return
  }

  logger.info("=".repeat(70))
  logger.info("Feature Manifest Generator")
  logger.info("=".repeat(70))
  logger.info(`Repository: ${args.repo}`)
  logger.info(`Output: ${args.out}`)
  logger.info(`Model: ${args.model}`)
  logger.info(`Ollama URL: ${args["ollama-url"]}`)
  logger.info(`Dry run: ${args["dry-run"]}`)
  logger.info("=".repeat(70))

  const scanner = new RepositoryScanner(args.repo, false, logger)
  const maxFiles = args["max-files"] ? parseInt(args["max-files"]) : undefined

  scanner.scan(maxFiles)

  if (args["dry-run"]) {
    logger.info(`Would analyze ${scanner.getFiles().length} files`)
    logger.info(`Detected tech: ${scanner.getTechStack().join(", ")}`)
    return
  }

  // Verify Ollama setup before analysis
  logger.info("Verifying Ollama setup...")
  await verifyOllamaSetup(args["ollama-url"], args.model, logger)

  logger.info("Building manifest...")
  const manifest = await buildManifest(
    scanner,
    args["ollama-url"],
    args.model,
    logger,
    args.out
  )

  logger.info(`Inferred ${manifest.features.length} features`)
  logger.info("Emitting output...")
  await emitManifest(manifest, args.out)

  logger.info("=".repeat(70))
  logger.info("Feature manifest generation complete!")
  logger.info("=".repeat(70))
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
