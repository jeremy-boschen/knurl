# Console-to-Logger Migration Summary

## Overview

This script automates the replacement of 80+ `console.log/warn/error/debug` calls with structured logging using `getSyncLogger` from `@/lib/logger`.

## Quick Stats

- **Script**: `/home/newty/worktrees/knurl/claude/scripts/migrate-to-logger.mjs`
- **Files to process**: 220 TypeScript files
- **Files to modify**: 26 files
- **Console calls to replace**: 67 calls
- **Test files excluded**: All `*.test.ts` and `*.test.tsx` files automatically skipped

## Files to be Modified

```
src-ui/src/components/error/error-boundary.tsx
src-ui/src/components/layout/breadcrumbs.tsx
src-ui/src/components/layout/collection-tree/context-menu/collection-menu.tsx
src-ui/src/components/layout/collection-tree/context-menu/folder-menu.tsx
src-ui/src/components/layout/collection-tree/context-menu/request-menu.tsx
src-ui/src/components/layout/environment-selector.tsx
src-ui/src/components/request/editor/request-auth-panel.tsx
src-ui/src/components/ui/knurl/collection-menu.tsx
src-ui/src/components/ui/knurl/request-context-menu.tsx
src-ui/src/components/ui/knurl/request-menu.tsx
src-ui/src/components/utility-sheets/collection-settings/collection-auth-panel.tsx
src-ui/src/components/utility-sheets/settings/sections/appearance.tsx
src-ui/src/components/utility-sheets/settings/sections/theme-selector.tsx
src-ui/src/hooks/use-interval.ts
src-ui/src/hooks/use-zod-form.ts
src-ui/src/index.tsx
src-ui/src/lib/event-emitter.ts
src-ui/src/lib/prettier.ts
src-ui/src/state/collections/collection-ops.ts
src-ui/src/state/collections/core.ts
src-ui/src/state/collections/index-ops.ts
src-ui/src/state/middleware/storage.ts
src-ui/src/state/request-tabs.ts
src-ui/src/state/settings.ts
src-ui/src/state/utils.ts
src-ui/src/types/middleware/storage-manager.ts
```

## Transformation Example

### Before
```typescript
import { z } from "zod"

export function processData(fileName: string, data: unknown) {
  try {
    const result = z.string().safeParse(data)

    if (!result.success) {
      console.error("Failed to parse", z.prettifyError(result.error))
      return null
    }

    console.log(`Processing file ${fileName}`)

    if (result.data.length > 100) {
      console.warn("Large file detected", { size: result.data.length })
    }

    return result.data
  } catch (e) {
    console.error("Unexpected error", e)
    throw e
  }
}
```

### After
```typescript
import { getSyncLogger } from "@/lib/logger"
import { z } from "zod"

const logger = getSyncLogger("module-name")

export function processData(fileName: string, data: unknown) {
  try {
    const result = z.string().safeParse(data)

    if (!result.success) {
      logger.error("Failed to parse", { value: z.prettifyError(result.error) })
      return null
    }

    logger.info(`Processing file ${fileName}`)

    if (result.data.length > 100) {
      logger.warn("Large file detected", { size: result.data.length })
    }

    return result.data
  } catch (e) {
    logger.error("Unexpected error", { e })
    throw e
  }
}
```

## Usage

### 1. Preview all changes
```bash
node scripts/migrate-to-logger.mjs --dry-run
```

### 2. Preview specific file with detailed replacements
```bash
node scripts/migrate-to-logger.mjs --dry-run --show-replacements --file=src-ui/src/state/middleware/storage.ts
```

### 3. Apply changes to all files
```bash
node scripts/migrate-to-logger.mjs
```

### 4. Apply changes to specific file
```bash
node scripts/migrate-to-logger.mjs --file=src-ui/src/state/settings.ts
```

### 5. Format and verify
```bash
yarn format
yarn lint
yarn test:unit
```

## Script Features

✅ **Automatic import injection** - Adds `getSyncLogger` import if missing
✅ **Module naming** - Creates logger instances with appropriate module names
✅ **Smart argument conversion** - Converts multi-arg console calls to message + meta object
✅ **Template literal support** - Preserves template strings with expressions
✅ **Nested function call handling** - Correctly parses complex expressions
✅ **Test file exclusion** - Automatically skips test files
✅ **Dry-run mode** - Preview changes before applying
✅ **Detailed reporting** - Shows replacements and statistics

## Console Method Mapping

| Console | Logger | Notes |
|---------|--------|-------|
| `console.debug()` | `logger.debug()` | Development-only logging |
| `console.log()` | `logger.info()` | General information |
| `console.info()` | `logger.info()` | Informational messages |
| `console.warn()` | `logger.warn()` | Warning conditions |
| `console.error()` | `logger.error()` | Error conditions |

## Argument Transformation Rules

### Single string argument
```typescript
console.error("message")         → logger.error("message")
console.log(`template ${var}`)   → logger.info(`template ${var}`)
```

### String + variable
```typescript
console.error("Failed", error)   → logger.error("Failed", { error })
console.warn("msg", value)       → logger.warn("msg", { value })
```

### String + object (preserved)
```typescript
console.warn("msg", { x, y })    → logger.warn("msg", { x, y })
```

### String + complex expression
```typescript
console.error("err", fn(x))      → logger.error("err", { value: fn(x) })
```

### Multiple arguments
```typescript
console.log("x:", x, "y:", y)    → logger.info("x: y:", { x, y })
```

## Priority

The script prioritizes **error and warn** calls as they are most important for debugging. Use `--log-only` to migrate only `console.log` calls.

## Post-Migration Checklist

- [ ] Run dry-run to preview changes
- [ ] Review generated transformations
- [ ] Apply migrations
- [ ] Run `yarn format` to format code
- [ ] Run `yarn lint` to check for issues
- [ ] Run `yarn test:unit` to verify tests pass
- [ ] Review git diff for correctness
- [ ] Commit with conventional commit message

## Documentation

- **Full README**: `scripts/migrate-to-logger-README.md`
- **Script**: `scripts/migrate-to-logger.mjs`

## Notes

- Test files are automatically excluded
- The `e2e-bridge.ts` file is skipped (special console handling)
- Files already using the logger are updated to use it consistently
- Manual review is recommended for complex edge cases
- Some transformations may require manual adjustment
