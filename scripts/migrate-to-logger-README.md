# Console-to-Logger Migration Script

Automated replacement of `console.log/warn/error/debug` calls with the structured logger from `@/lib/logger`.

## Quick Start

```bash
# Dry run to preview changes
node scripts/migrate-to-logger.mjs --dry-run --show-replacements

# Migrate all files
node scripts/migrate-to-logger.mjs

# Migrate specific file
node scripts/migrate-to-logger.mjs --file=src-ui/src/state/collections/core.ts
```

## What It Does

1. **Adds logger import** if not present:
   ```typescript
   import { getSyncLogger } from "@/lib/logger"
   ```

2. **Creates logger instance** with module name:
   ```typescript
   const logger = getSyncLogger("state/middleware/storage")
   ```

3. **Replaces console calls** with structured logging:
   ```typescript
   // Before
   console.error("Failed to load", error)
   console.warn("Migration failed", { id })
   console.log(`Processing ${count} items`)

   // After
   logger.error("Failed to load", { error })
   logger.warn("Migration failed", { id })
   logger.info(`Processing ${count} items`)
   ```

## Options

| Flag | Description |
|------|-------------|
| `--dry-run` | Preview changes without modifying files |
| `--verbose` | Show detailed output for each file |
| `--show-replacements` | Display before/after for each console call |
| `--log-only` | Only replace `console.log` (skip warn/error) |
| `--file=path` | Process only a specific file |

## Transformation Examples

### Single argument (string)
```typescript
console.error("Something failed")
→ logger.error("Something failed")
```

### Template literal
```typescript
console.log(`Processing ${fileName}`)
→ logger.info(`Processing ${fileName}`)
```

### String + variable
```typescript
console.error("Failed to load", error)
→ logger.error("Failed to load", { error })
```

### String + object
```typescript
console.warn("Invalid state", { id, type })
→ logger.warn("Invalid state", { id, type })
```

### String + function call
```typescript
console.error("Parse error", z.prettifyError(err))
→ logger.error("Parse error", { value: z.prettifyError(err) })
```

### Nested function calls
```typescript
console.error(`Failed to parse ${fileName}:`, z.prettifyError(result.error))
→ logger.error(`Failed to parse ${fileName}:`, { value: z.prettifyError(result.error) })
```

## What Gets Skipped

- Test files (`*.test.ts`, `*.test.tsx`)
- E2E bridge file (`e2e-bridge.ts`)
- Files without any console calls
- Files already using the logger

## Module Naming

Logger instances are named based on the file path relative to `src-ui/src/`:

| File | Logger Module Name |
|------|-------------------|
| `src-ui/src/state/collections/core.ts` | `state/collections/core` |
| `src-ui/src/components/auth/oauth2-editor.tsx` | `components/auth/oauth2-editor` |
| `src-ui/src/lib/utils.ts` | `lib/utils` |

## Method Mapping

| Console | Logger |
|---------|--------|
| `console.debug()` | `logger.debug()` |
| `console.log()` | `logger.info()` |
| `console.info()` | `logger.info()` |
| `console.warn()` | `logger.warn()` |
| `console.error()` | `logger.error()` |

## Usage Workflow

### 1. Preview changes
```bash
node scripts/migrate-to-logger.mjs --dry-run --show-replacements --file=src-ui/src/state/settings.ts
```

### 2. Review output
Check that the transformations are correct for your use case.

### 3. Apply to specific file
```bash
node scripts/migrate-to-logger.mjs --file=src-ui/src/state/settings.ts
```

### 4. Run tests
```bash
yarn test:unit
```

### 5. Migrate all files
```bash
node scripts/migrate-to-logger.mjs
```

### 6. Format and lint
```bash
yarn format
yarn lint
```

## Limitations

- Does not handle dynamic console calls: `console[method](msg)`
- May not perfectly format complex nested expressions
- Manual review recommended for edge cases
- Some calls may need manual adjustment after migration

## After Migration

1. **Review changes**: Check git diff for correctness
2. **Run tests**: Ensure all tests pass
3. **Format code**: Run `yarn format`
4. **Commit**: Use conventional commit format

```bash
git add .
git commit -m "refactor: migrate console calls to structured logger"
```
