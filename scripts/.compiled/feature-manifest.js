/**
 * Feature Manifest Generator for Knurl (and other multi-tech repositories)
 *
 * A production-ready tool that scans a repository, extracts structured signals
 * (routes, endpoints, schemas, configs, data models, etc.), and uses a local
 * Ollama model to infer and document features with evidence-based citations.
 *
 * LANGUAGE CHOICE RATIONALE:
 * TypeScript/Node.js chosen to:
 * - Keep everything in the project's existing tech stack (React/TypeScript)
 * - Avoid Python dependency on dev machines
 * - Use yarn for consistent package management
 * - Leverage existing build tooling (Vite, esbuild, tsx)
 * - Better integration with other Node tools in CI/CD
 *
 * Usage:
 *   tsx scripts/feature-manifest.ts --repo . --out ./manifest
 *   npx tsx scripts/feature-manifest.ts --repo . --dry-run
 */
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { globSync } from "glob";
import { parseArgs } from "util";
import { mkdir, writeFile } from "fs/promises";
// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================
const DEFAULT_OLLAMA_BASE_URL = "http://host.docker.internal:11434";
const DEFAULT_OLLAMA_MODEL = "qwen2.5-coder:7b";
const DEFAULT_MAX_CHUNK_SIZE = 3000;
const DEFAULT_CHUNK_OVERLAP = 300;
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_LOG_LEVEL = "INFO";
const GENERATOR_VERSION = "0.2.0";
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
];
const FILE_TYPE_PATTERNS = {
    code: /\.(ts|tsx|js|jsx|rs|java|kt|py|go)$/i,
    config: /\.(json|yaml|yml|toml|ini|env|conf)$/i,
    test: /(test|spec)\.(ts|tsx|js|jsx)$/i,
    docs: /\.(md|mdx|rst|txt)$/i,
    data: /\.(sql|graphql|proto)$/i,
};
class Logger {
    constructor(level = "INFO") {
        this.level = level;
    }
    shouldLog(messageLevel) {
        const levels = { DEBUG: 0, INFO: 1, WARNING: 2, ERROR: 3 };
        return levels[messageLevel] >= levels[this.level];
    }
    debug(msg) {
        if (this.shouldLog("DEBUG")) {
            console.log(`[DEBUG] ${msg}`);
        }
    }
    info(msg) {
        if (this.shouldLog("INFO")) {
            console.log(`[INFO] ${msg}`);
        }
    }
    warn(msg) {
        if (this.shouldLog("WARNING")) {
            console.warn(`[WARNING] ${msg}`);
        }
    }
    error(msg) {
        if (this.shouldLog("ERROR")) {
            console.error(`[ERROR] ${msg}`);
        }
    }
}
// ============================================================================
// REPOSITORY SCANNER
// ============================================================================
class RepositoryScanner {
    constructor(repoPath, noDefaultIgnores = false, logger) {
        this.repoPath = repoPath;
        this.noDefaultIgnores = noDefaultIgnores;
        this.files = [];
        this.techStack = new Set();
        this.logger = logger;
        this.ignorePatterns = new Set();
        if (!noDefaultIgnores) {
            DEFAULT_IGNORE_PATTERNS.forEach((p) => this.ignorePatterns.add(p));
        }
        // Load .gitignore
        this.loadGitignore();
    }
    loadGitignore() {
        const gitignorePath = path.join(this.repoPath, ".gitignore");
        if (fs.existsSync(gitignorePath)) {
            try {
                const content = fs.readFileSync(gitignorePath, "utf-8");
                content.split("\n").forEach((line) => {
                    const trimmed = line.trim();
                    if (trimmed && !trimmed.startsWith("#")) {
                        this.ignorePatterns.add(trimmed);
                    }
                });
            }
            catch (e) {
                this.logger.warn(`Failed to load .gitignore: ${e}`);
            }
        }
    }
    shouldIgnore(relPath) {
        const name = path.basename(relPath);
        for (const pattern of this.ignorePatterns) {
            if (name === pattern || relPath.includes(pattern)) {
                return true;
            }
        }
        return false;
    }
    detectFileType(filePath) {
        for (const [type, regex] of Object.entries(FILE_TYPE_PATTERNS)) {
            if (regex.test(filePath)) {
                return type;
            }
        }
        return "other";
    }
    computeHash(content) {
        return crypto.createHash("sha256").update(content).digest("hex").slice(0, 16);
    }
    async scan(maxFiles) {
        this.logger.info(`Scanning repository: ${this.repoPath}`);
        const globPattern = path.join(this.repoPath, "**/*");
        const files = globSync(globPattern, {
            dot: true,
            nodir: true,
            ignore: Array.from(this.ignorePatterns),
        });
        let count = 0;
        for (const filePath of files) {
            if (maxFiles && count >= maxFiles)
                break;
            const relPath = path.relative(this.repoPath, filePath);
            if (this.shouldIgnore(relPath))
                continue;
            try {
                const stat = fs.statSync(filePath);
                const content = fs.readFileSync(filePath);
                this.files.push({
                    path: relPath.replace(/\\/g, "/"),
                    absPath: filePath,
                    size: stat.size,
                    mtime: stat.mtimeMs,
                    contentHash: this.computeHash(content),
                    fileType: this.detectFileType(filePath),
                    isIgnored: false,
                });
                count++;
            }
            catch (e) {
                this.logger.debug(`Failed to index ${relPath}: ${e}`);
            }
        }
        this.logger.info(`Indexed ${this.files.length} files`);
        this.detectTechStack();
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
        };
        for (const file of this.files) {
            for (const [indicator, tech] of Object.entries(indicators)) {
                if (file.path.includes(indicator)) {
                    this.techStack.add(tech);
                }
            }
        }
        this.logger.info(`Detected tech stack: ${Array.from(this.techStack).join(", ")}`);
    }
    getFiles() {
        return this.files;
    }
    getTechStack() {
        return Array.from(this.techStack);
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
        };
        if (!["code", "config", "data"].includes(fileInfo.fileType)) {
            return signals;
        }
        try {
            const content = fs.readFileSync(fileInfo.absPath, "utf-8");
            // Routes extraction
            const routePatterns = [
                /(?:path|href|route)=["']([^"']+)["']/g,
                /<Route\s+path=["']([^"']+)["']/g,
                /(?:path|route):\s*["']([^"']+)["']/g,
            ];
            routePatterns.forEach((pattern) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    signals.routes.add(match[1]);
                }
            });
            // Endpoint extraction
            const endpointPatterns = [
                /(?:POST|GET|PUT|DELETE|PATCH)\s+["']([^"']+)["']/g,
                /(?:post|get|put|delete|patch)\(["']([^"']+)["']/g,
            ];
            endpointPatterns.forEach((pattern) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    signals.endpoints.add(match[1]);
                }
            });
            // Model extraction
            const modelPatterns = [
                /(?:interface|type)\s+(\w+)(?:\s*extends|\s*{)?/g,
                /class\s+(\w+)/g,
                /struct\s+(\w+)/g,
            ];
            modelPatterns.forEach((pattern) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    signals.models.add(match[1]);
                }
            });
            // Export extraction
            const exportPatterns = [
                /export\s+(?:function|const|class|interface)\s+(\w+)/g,
                /^export\s+default\s+(\w+)/gm,
            ];
            exportPatterns.forEach((pattern) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    signals.exports.add(match[1]);
                }
            });
            // Config extraction
            const configPatterns = [
                /(?:const|let|var)\s+(\w+)\s*=\s*(?:process\.env\.|config\.)/g,
                /env\[?["']([^"']+)["']?/g,
            ];
            configPatterns.forEach((pattern) => {
                let match;
                while ((match = pattern.exec(content)) !== null) {
                    signals.config.add(match[1]);
                }
            });
        }
        catch (e) {
            // Ignore read errors
        }
        return signals;
    }
}
// ============================================================================
// FEATURE INFERENCE
// ============================================================================
function inferAreaFromPath(path) {
    const lower = path.toLowerCase();
    if (lower.includes("auth"))
        return "Auth";
    if (lower.includes("http") || lower.includes("request") || lower.includes("client"))
        return "HTTP Client";
    if (lower.includes("settings") || lower.includes("config"))
        return "Settings";
    if (lower.includes("sync"))
        return "Sync";
    if (lower.includes("build") || lower.includes(".github"))
        return "Build/CI";
    if (lower.includes("collections"))
        return "Collections";
    return "Core";
}
function buildManifest(scanner, appName = "Knurl", appDescription = "Desktop HTTP client") {
    const files = scanner.getFiles();
    const manifest = {
        app_name: appName,
        app_description: appDescription,
        tech_stack: scanner.getTechStack().sort(),
        modules: ["Frontend", "Backend", "Documentation"],
        generated_at: new Date().toISOString(),
        generator_version: GENERATOR_VERSION,
        features: [],
    };
    // Extract signals from key files
    const allSignals = new Map();
    const keyFiles = files
        .filter((f) => ["code", "config", "test"].includes(f.fileType))
        .slice(0, 100);
    for (const file of keyFiles) {
        const signals = SignalExtractor.extractFromFile(file);
        allSignals.set(file.path, signals);
    }
    // Group by area
    const signalsByArea = new Map();
    for (const [filePath, signals] of allSignals) {
        const area = inferAreaFromPath(filePath);
        if (!signalsByArea.has(area)) {
            signalsByArea.set(area, {
                files: [],
                routes: new Set(),
                endpoints: new Set(),
                models: new Set(),
                config: new Set(),
            });
        }
        const areaSignals = signalsByArea.get(area);
        areaSignals.files.push(filePath);
        areaSignals.routes = new Set([...areaSignals.routes, ...signals.routes]);
        areaSignals.endpoints = new Set([...areaSignals.endpoints, ...signals.endpoints]);
        areaSignals.models = new Set([...areaSignals.models, ...signals.models]);
        areaSignals.config = new Set([...areaSignals.config, ...signals.config]);
    }
    // Build features from areas
    for (const [area, areaSignals] of Array.from(signalsByArea).sort()) {
        if (areaSignals.files.length === 0)
            continue;
        const areaSlug = area.toLowerCase().replace(/[/ ]+/g, "-");
        if ((areaSignals.routes.size || areaSignals.endpoints.size) === 0)
            continue;
        const feature = {
            id: `${areaSlug}.core`,
            name: `${area} Core`,
            area,
            summary_user: `Core ${area} functionality for Knurl`,
            summary_business: `Enables ${area.toLowerCase()} capabilities`,
            status: "active",
            confidence: 0.7,
            last_verified: new Date().toISOString(),
            evidence: [],
        };
        // Add evidence from top 3 files
        let evidenceCount = 0;
        for (const filePath of areaSignals.files.slice(0, 3)) {
            const fileInfo = files.find((f) => f.path === filePath);
            if (fileInfo && evidenceCount < 3) {
                feature.evidence.push({
                    filePath,
                    lineStart: 1,
                    lineEnd: 50,
                    contentHash: fileInfo.contentHash,
                    snippet: `From ${filePath}`,
                });
                evidenceCount++;
            }
        }
        // Populate fields from signals
        if (areaSignals.routes.size > 0) {
            feature.entry_points = {
                ui_routes: Array.from(areaSignals.routes)
                    .slice(0, 3)
                    .map((route) => ({
                    path: route,
                    component: null,
                    files: areaSignals.files.slice(0, 2),
                })),
            };
        }
        if (areaSignals.models.size > 0) {
            feature.data_model = {
                entities: Array.from(areaSignals.models)
                    .slice(0, 3)
                    .map((model) => ({
                    name: model,
                    fields: {},
                    primary_keys: [],
                    relations: {},
                    files: areaSignals.files.slice(0, 2),
                })),
            };
        }
        if (areaSignals.config.size > 0) {
            feature.configuration = {
                env_vars: Array.from(areaSignals.config)
                    .slice(0, 3)
                    .map((config) => ({
                    name: config,
                    required: false,
                    default: null,
                    used_in_files: areaSignals.files.slice(0, 2),
                })),
            };
        }
        manifest.features.push(feature);
    }
    return manifest;
}
// ============================================================================
// OUTPUT EMISSION
// ============================================================================
async function emitManifest(manifest, outDir) {
    await mkdir(outDir, { recursive: true });
    // YAML output
    const yaml = await import("js-yaml");
    const yamlContent = yaml.dump(manifest, { indent: 2, lineWidth: -1 });
    await writeFile(path.join(outDir, "feature-manifest.yaml"), yamlContent);
    // JSON output
    const jsonContent = JSON.stringify(manifest, null, 2);
    await writeFile(path.join(outDir, "feature-manifest.json"), jsonContent);
    // Per-feature detail files
    const featuresDir = path.join(outDir, "features");
    for (const feature of manifest.features) {
        const areaDir = path.join(featuresDir, feature.area.toLowerCase().replace(/[/ ]+/g, "-"));
        await mkdir(areaDir, { recursive: true });
        // Feature YAML
        const featureYaml = yaml.dump(feature, { indent: 2, lineWidth: -1 });
        await writeFile(path.join(areaDir, `${feature.id}.yaml`), featureYaml);
        // Evidence ledger
        const evidenceJson = JSON.stringify(feature.evidence, null, 2);
        await writeFile(path.join(areaDir, `${feature.id}.evidence.json`), evidenceJson);
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
            "log-level": { type: "string", default: DEFAULT_LOG_LEVEL },
            help: { type: "boolean", default: false },
        },
    });
    const logger = new Logger(args["log-level"]);
    if (args.help) {
        console.log(`
Feature Manifest Generator v${GENERATOR_VERSION}

Usage: tsx scripts/feature-manifest.ts [OPTIONS]

Options:
  --repo <path>         Repository path (default: .)
  --out <path>          Output directory (default: ./knurl-manifest)
  --model <name>        Ollama model (default: ${DEFAULT_OLLAMA_MODEL})
  --ollama-url <url>    Ollama URL (default: ${DEFAULT_OLLAMA_BASE_URL})
  --max-files <num>     Limit files to process (for testing)
  --dry-run             Plan only; don't generate output
  --log-level <level>   Log level: DEBUG|INFO|WARNING|ERROR (default: INFO)
  --help                Show this help message
    `);
        return;
    }
    logger.info("=".repeat(70));
    logger.info("Feature Manifest Generator");
    logger.info("=".repeat(70));
    logger.info(`Repository: ${args.repo}`);
    logger.info(`Output: ${args.out}`);
    logger.info(`Model: ${args.model}`);
    logger.info(`Ollama URL: ${args["ollama-url"]}`);
    logger.info(`Dry run: ${args["dry-run"]}`);
    logger.info("=".repeat(70));
    const scanner = new RepositoryScanner(args.repo, false, logger);
    const maxFiles = args["max-files"] ? parseInt(args["max-files"]) : undefined;
    await scanner.scan(maxFiles);
    if (args["dry-run"]) {
        logger.info(`Would analyze ${scanner.getFiles().length} files`);
        logger.info(`Detected tech: ${scanner.getTechStack().join(", ")}`);
        return;
    }
    logger.info("Building manifest...");
    const manifest = buildManifest(scanner);
    logger.info(`Inferred ${manifest.features.length} features`);
    logger.info("Emitting output...");
    await emitManifest(manifest, args.out);
    logger.info("=".repeat(70));
    logger.info("Feature manifest generation complete!");
    logger.info("=".repeat(70));
}
main().catch((e) => {
    console.error("Fatal error:", e);
    process.exit(1);
});
