# Feature Manifest Generator for Knurl

A production-ready Node.js tool that scans your Knurl repository (and other multi-tech codebases), extracts structured signals (routes, endpoints, schemas, data models, configurations), and uses a local Ollama LLM to infer and document every feature with evidence-backed citations.

**Output:** Authoritative, machine-readable manifest (YAML + JSON) organized by functional area, with per-feature detail files and an evidence ledger mapping each claim to source code.

---

## Quick Start

### Prerequisites

- **Node.js 20+** (already part of your dev environment)
- **Yarn** (already configured in project)
- **Ollama** running locally (Windows, macOS, Linux)
  - Model: `qwen2.5-coder:7b` (required for code analysis)
  - Context: 131K tokens (with YaRN enabled for best results)
  - Listening on `http://host.docker.internal:11434` (for WSL ↔ Windows)

### Installation

Dependencies are already included in `package.json`.

**1. Set up Ollama**

See [OLLAMA_SETUP.md](./OLLAMA_SETUP.md) for detailed setup instructions including:
- Installing Ollama
- Pulling the qwen2.5-coder:7b model
- Configuring extended context (131K tokens with YaRN)
- Memory management and troubleshooting

**2. Verify Ollama is running:**

```bash
curl http://host.docker.internal:11434/api/tags
```

Should return JSON with your available models. (The `host.docker.internal` URL works from both WSL and Windows.)

### Basic Usage

Run the generator from the repository root:

```bash
yarn feature-manifest
```

Or with npm:

```bash
npx node scripts/feature-manifest.mjs
```

**Output directory structure:**

All files are consolidated under `docs/feature-manifest/`:

```
docs/feature-manifest/
├── feature-manifest.yaml          # Complete manifest (YAML)
├── feature-manifest.json          # Complete manifest (JSON)
└── features/
    ├── auth/
    │   ├── oauth2.yaml           # Feature detail
    │   └── oauth2.evidence.json   # Citations
    ├── http-client/
    │   ├── request-builder.yaml
    │   └── request-builder.evidence.json
    └── ...
```

---

## CLI Options

```bash
yarn feature-manifest [OPTIONS]
# or
node scripts/feature-manifest.mjs [OPTIONS]
```

### Arguments

| Flag | Default | Description |
|------|---------|-------------|
| `--repo` | `.` (current dir) | Path to repository to analyze |
| `--out` | `docs/feature-manifest` | Output directory for manifest files |
| `--model` | `qwen2.5-coder:7b` | Ollama model to use for inference |
| `--ollama-url` | `http://host.docker.internal:11434` | Ollama instance URL (works from WSL & Windows) |
| `--max-chunk` | `3000` | Max chunk size in lines for LLM processing |
| `--chunk-overlap` | `300` | Overlap between chunks (for context) |
| `--concurrency` | `8` | Max parallel file reads |
| `--max-files` | *(none)* | Limit total files to process (for testing) |
| `--no-default-ignores` | *(false)* | Disable default ignores; respect only .gitignore |
| `--dry-run` | *(false)* | Plan only; don't call Ollama or emit files |
| `--log-level` | `INFO` | Logging level: `DEBUG`, `INFO`, `WARNING`, `ERROR` |

### Examples

**Dry-run (planning only, no Ollama calls):**

```bash
yarn feature-manifest:dry-run --log-level DEBUG
```

**Custom Ollama model or URL:**

```bash
yarn feature-manifest --model qwen3:8b

# Or if Ollama is on a different host:
yarn feature-manifest --ollama-url http://192.168.1.100:11434
```

**Analyze specific directory:**

```bash
yarn feature-manifest --repo ./src-tauri --out ./rust-manifest
```

**Incremental re-run:**

```bash
yarn feature-manifest --repo .
# Script will skip unchanged files on subsequent runs (with caching)
```

---

## Smart Ignore Rules

The tool automatically ignores:

- VCS: `.git`, `.github`, `.gitlab`
- Build/dist: `node_modules`, `target`, `dist`, `build`, `.next`, `.venv`
- Dependencies: `*.lock`, `.cargo`, `.gradle`, `.yarn`
- Binaries/media: `*.exe`, `*.so`, `*.jpg`, `*.png`, `*.mp4`
- IDE: `.vscode`, `.idea`
- Cache: `__pycache__`, `.pytest_cache`, `.mypy_cache`

Plus rules from your `.gitignore`.

**Override with `--no-default-ignores`** to respect only `.gitignore`.

---

## How It Works

### 1. Repository Scanning

- Recursively indexes all files (respecting ignores)
- Computes content hashes for caching
- Detects tech stack (Node, Rust, TypeScript, Vite, etc.)

### 2. File Classification

- **Code:** `.ts`, `.tsx`, `.js`, `.jsx`, `.rs`, `.java`, etc.
- **Config:** `.json`, `.yaml`, `.toml`, `.env`
- **Tests:** `test.ts`, `spec.js`, etc.
- **Docs:** `.md`, `.mdx`, `.rst`
- **Data:** `.sql`, `.graphql`, `.proto`

### 3. Signal Extraction

Parses code to extract:

- **Routes:** React Router paths, Wouter paths
- **API Endpoints:** REST methods + paths (GET, POST, etc.)
- **Schemas:** GraphQL types, interfaces, data structures
- **Data Models:** Classes, structs, TypeScript interfaces
- **Config:** Environment variables, feature flags
- **Exports:** Top-level functions, classes, modules

### 4. LLM Processing (Ollama)

For each chunk of code:

- Summarize purpose, exports, routes, endpoints
- Extract user-visible features
- Generate feature IDs, descriptions, confidence scores

Aggregates per area (Auth, HTTP Client, etc.) and infers discrete features.

### 5. Manifest Emission

Produces:

- **YAML:** Human-readable, version-control friendly
- **JSON:** Machine-consumable, strict schema validation
- **Per-feature files:** Detailed feature specs + evidence ledgers
- **Evidence ledger:** Maps every claim → file + line range + hash

---

## Manifest Schema

Every feature must include:

- **id:** Slugified, stable identifier (e.g., `"auth.oauth2"`)
- **name:** User-facing name
- **area:** Functional category (`Auth`, `HTTP Client`, `Settings`, `Sync`, `Build/CI`, etc.)
- **summary_user:** Plain-language value to end users
- **summary_business:** Why it exists
- **status:** `active`, `experimental`, or `deprecated`
- **entry_points:** UI routes, CLI commands, API endpoints
- **data_model:** Entities, storage mechanism
- **configuration:** Environment variables, feature flags
- **security_privacy:** Permissions, auth flows, secrets
- **dependencies:** Internal modules, external libraries
- **evidence:** Minimum 1 citation (file, lines, hash)
- **confidence:** 0.0–1.0; <0.6 requires a TODO

Full schema: `scripts/schema/feature-manifest.schema.json` (JSON Schema v2020-12).

---

## Validating the Manifest

The generator **automatically validates** before emitting. If validation fails, the run will error and log details.

You can manually validate with Node.js:

```bash
node -e "
const fs = require('fs');
const Ajv = require('ajv');

const manifest = JSON.parse(fs.readFileSync('docs/feature-manifest/feature-manifest.json', 'utf-8'));
const schema = JSON.parse(fs.readFileSync('scripts/schema/feature-manifest.schema.json', 'utf-8'));

const ajv = new Ajv();
const valid = ajv.validate(schema, manifest);

if (valid) {
  console.log('✓ Manifest is valid!');
} else {
  console.error('✗ Validation errors:', ajv.errors);
  process.exit(1);
}
"
```

---

## Consuming the Manifest (AI Agents, Tools)

The manifest is designed for automated consumption:

```javascript
const fs = require('fs');

// Load manifest
const manifest = JSON.parse(
  fs.readFileSync('docs/feature-manifest/feature-manifest.json', 'utf-8')
);

// Query a feature
const authFeatures = manifest.features.filter(f => f.area === 'Auth');

// Check confidence
const highConfidence = manifest.features.filter(f => f.confidence > 0.8);

// Trace evidence
for (const feature of manifest.features) {
  for (const evidence of feature.evidence) {
    console.log(`  ${evidence.file_path}:${evidence.line_start}-${evidence.line_end}`);
  }
}
```

---

## Incremental & Cached Runs

The tool caches file digests (path + size + mtime + hash) to avoid re-analyzing unchanged files:

```
.feature-manifest-cache/
├── digests.json           # {file_path: {size, mtime, hash, summary}}
└── summaries/
    └── src_lib_ts.json    # Cached LLM summary
```

**Resumability:**

- On re-run, the tool checks if file digest matches cache
- Only missing or changed files are re-analyzed
- Summaries are reused (faster runs)
- Manifest is rebuilt from fresh signals

---

## Common Issues

### Ollama not reachable

```
WARNING Ollama not reachable at http://localhost:11434
```

**Solution:** Ensure Ollama is running and listening on the correct port.

```bash
# Windows: Start Ollama from taskbar or CLI
ollama serve

# macOS/Linux:
ollama serve &
```

### Model not found

```
ERROR Failed to infer features: No such file or directory: model 'qwen3:8b'
```

**Solution:** Pull the model first.

```bash
ollama pull qwen2.5-coder:7b
# or: ollama pull qwen3:8b
```

### Out of memory

If chunks are timing out or model crashes, reduce `--max-chunk`:

```bash
yarn feature-manifest --max-chunk 2000
```

Or use a smaller model:

```bash
yarn feature-manifest --model gemma3:4b
```

### Slow performance

For large repos, limit files or increase concurrency:

```bash
yarn feature-manifest --max-files 100 --concurrency 16
```

---

## Performance Notes

With your system (Ryzen 9 9950X, RTX 4070, 12GB VRAM):

- **Scanning:** ~50–100 files/sec (I/O bound)
- **Summarization:** ~30–50 tokens/sec (qwen2.5-coder on GPU)
- **Full run (1000 files):** ~10–15 minutes

**Tips for speed:**

1. Use `--dry-run` first to estimate file count
2. Start with a subset: `--max-files 50`
3. Cache is reused on subsequent runs
4. GPU acceleration: ensure CUDA drivers are current

---

## Integration with CI/CD

Add to your `.github/workflows/`:

```yaml
- name: Generate Feature Manifest
  run: |
    yarn feature-manifest

- name: Commit manifest
  run: |
    git add docs/feature-manifest/
    git commit -m "chore: update feature manifest" || true
    git push
```

Or upload to artifact storage:

```yaml
- name: Upload manifest
  uses: actions/upload-artifact@v3
  with:
    name: feature-manifest
    path: docs/feature-manifest/
```

---

## Next Steps

1. ✅ **Run the generator:** `yarn feature-manifest`
2. ✅ **Inspect the output:** `cat docs/feature-manifest/feature-manifest.yaml`
3. ✅ **Validate:** Check against schema (see above)
4. ✅ **Iterate:** Review confidence scores; add/refine features with low confidence
5. ✅ **Automate:** Add to CI pipeline or regular re-generation schedule

---

## Troubleshooting & Support

**Enable debug logging:**

```bash
yarn feature-manifest --log-level DEBUG
```

**Check for TypeScript errors in script:**

```bash
yarn typecheck
```

**Verify Ollama API and run generator:**

```bash
# Check Ollama
curl http://host.docker.internal:11434/api/tags

# Run generator
yarn feature-manifest
```

---

## License & Attribution

This tool is part of the Knurl project. For issues or contributions, see `CONTRIBUTING.md`.

Generated by: Feature Manifest Generator v0.1.0
