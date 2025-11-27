# Async Functions Without Try-Catch Analysis

This document shows how to use ast-grep to find async functions that don't have try-catch blocks.

## Rules Created

### TypeScript - Basic Rule (function_declaration only)

**File:** `/tmp/async_no_trycatch_ts.yml`

```yaml
id: async-function-no-try-catch-ts
language: typescript
rule:
  all:
    - kind: function_declaration
    - has:
        pattern: await $EXPR
        stopBy: end
    - not:
        has:
          kind: try_statement
          stopBy: end
```

**Usage:**
```bash
ast-grep scan --rule /tmp/async_no_trycatch_ts.yml src-ui/src
```

**Results:** Found 11 async functions in `src-ui/src` without try-catch blocks:
1. `getKey()` — src-ui/src/state/credentials.ts:34
2. `encrypt()` — src-ui/src/state/credentials.ts:55
3. `decrypt()` — src-ui/src/state/credentials.ts:73
4. `setupCollectionStorage()` — src-ui/src/state/collections/core.ts:148
5. `createCollectionOps()` — src-ui/src/state/collections/collection-ops.ts:43
6. `buildExportCommand()` — src-ui/src/lib/request/exporters.ts:18
7. `prepareForExport()` — src-ui/src/lib/request/exporters.ts:32
8. `resolveAuthResult()` — src-ui/src/lib/request/exporters.ts:367
9. `runTasks()` — src-ui/src/lib/utils.ts:16
10. `loadPlugin()` — src-ui/src/worker/prettier.worker.ts:29
11. `pluginsFor()` — src-ui/src/worker/prettier.worker.ts:59

### TypeScript - Extended Rule (all function types)

**File:** `/tmp/async_no_trycatch_extended.yml`

```yaml
id: async-functions-no-try-catch-extended
language: typescript
rule:
  any:
    # Regular async functions
    - all:
        - kind: function_declaration
        - has:
            pattern: await $EXPR
            stopBy: end
        - not:
            has:
              kind: try_statement
              stopBy: end
    # Async arrow functions and expressions
    - all:
        - kind: arrow_function
        - has:
            pattern: await $EXPR
            stopBy: end
        - not:
            has:
              kind: try_statement
              stopBy: end
```

**Usage:**
```bash
ast-grep scan --rule /tmp/async_no_trycatch_extended.yml src-ui/src
```

**Results:** Found 1787 total instances (includes arrow functions, methods, callbacks, etc.)

### Rust - Basic Rule

**File:** `/tmp/async_no_trycatch_rust.yml`

```yaml
id: async-function-no-try-catch-rust
language: rust
rule:
  all:
    - kind: async_block
    - has:
        pattern: await $EXPR
        stopBy: end
    - not:
        has:
          kind: try_expression
          stopBy: end
```

**Usage:**
```bash
ast-grep scan --rule /tmp/async_no_trycatch_rust.yml src-tauri/src
```

**Results:** No matches found in `src-tauri/src` (Rust codebase handles errors differently)

## Key Concepts

### Rule Components

- **`kind`**: AST node type (e.g., `function_declaration`, `try_statement`)
- **`has`**: Checks if a node contains a matching sub-node (with `stopBy: end` to traverse entire subtree)
- **`not`**: Negates a condition (finds things that DON'T have a pattern)
- **`all`**: AND logic — all conditions must match
- **`any`**: OR logic — any condition can match
- **`pattern`**: Direct code pattern matching with metavariables (e.g., `await $EXPR`)
- **`stopBy: end`**: Essential for relational rules — ensures complete traversal of the node tree

### How the Rule Works

1. **Finds** async functions that contain `await` expressions
2. **Filters out** any that already have a `try_statement` block
3. **Results** are functions that use async/await but lack error handling

## Running the Searches

### Install ast-grep (one-time)
```bash
npm install -g @ast-grep/cli
```

### Search TypeScript with basic rule
```bash
ast-grep scan --rule /tmp/async_no_trycatch_ts.yml src-ui/src
```

### Search TypeScript with extended rule (includes arrow functions)
```bash
ast-grep scan --rule /tmp/async_no_trycatch_extended.yml src-ui/src
```

### Search Rust
```bash
ast-grep scan --rule /tmp/async_no_trycatch_rust.yml src-tauri/src
```

### Get JSON output for programmatic use
```bash
ast-grep scan --rule /tmp/async_no_trycatch_ts.yml src-ui/src --json
```

## Extending the Rule

### Find async functions without try-catch AND without error boundaries

```yaml
rule:
  all:
    - kind: function_declaration
    - has:
        pattern: await $EXPR
        stopBy: end
    - not:
        has:
          kind: try_statement
          stopBy: end
    - not:
        has:
          kind: class_declaration
          stopBy: end
```

### Find async arrow functions with console.log but no try-catch

```yaml
rule:
  all:
    - kind: arrow_function
    - has:
        pattern: await $EXPR
        stopBy: end
    - has:
        pattern: console.log($$$)
        stopBy: end
    - not:
        has:
          kind: try_statement
          stopBy: end
```

## References

- **ast-grep documentation:** https://ast-grep.github.io/
- **Rule syntax:** https://ast-grep.github.io/guide/rule.html
- **Pattern matching:** https://ast-grep.github.io/guide/pattern-syntax.html
