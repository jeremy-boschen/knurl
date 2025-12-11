# Logging Guide for Knurl

Complete guide to using the logging system in Knurl's frontend and backend.

## Quick Start

### Frontend (TypeScript/React)

```typescript
import { getSyncLogger } from "@/lib/logger"

const logger = getSyncLogger("components/auth")

logger.info("User logged in", { userId: "123", provider: "google" })
logger.warn("Token expiring soon", { expiresIn: "5m" })
logger.error("Login failed", { reason: "invalid_credentials" })
logger.debug("Auth state updated", { state: authState })
```

### Backend (Rust)

```rust
use log::{info, warn, error, debug};

info!("Server started on port 3000");
warn!("High memory usage detected: {}MB", memory_mb);
error!("Failed to connect to database: {}", err);
debug!("Processing request from {}", client_ip);
```

## Frontend Logger

### Import

```typescript
import { getLogger, getSyncLogger } from "@/lib/logger"
```

### Async Logger (Best for Most Cases)

Use when you can await or handle promises:

```typescript
const logger = getLogger("module-name")

// All methods are async
await logger.info("Message", { key: "value" })
await logger.warn("Warning", { data: someData })
await logger.error("Error occurred", { error: err.message })
await logger.debug("Debug info", { details: "..." })
```

**Advantages:**
- Non-blocking
- Proper Tauri plugin integration
- Structured metadata support

### Sync Logger (For Event Handlers)

Use for synchronous contexts (event handlers, render functions):

```typescript
const logger = getSyncLogger("module-name")

// All methods are synchronous, non-blocking
logger.info("Clicked button")
logger.error("Something broke", { err: e })
logger.warn("This is deprecated")
```

**Note:** Internally queues to async logger, handles errors silently

## Logging Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Internal flow, state changes | "State updated from A to B" |
| `info` | User actions, normal flow | "File saved successfully" |
| `warn` | Unusual but recoverable | "Cache miss, fetching fresh" |
| `error` | Failure, exceptions | "Network request failed" |

## Structured Metadata

Always include context as the second parameter:

```typescript
// Good: Structured metadata
logger.error("Save failed", { collectionId: id, reason: "timeout" })

// Avoid: Formatting in message
logger.error(`Save failed: collection=${id}`)
```

**Benefits:**
- Filterable in log files
- Better debugging
- Easier parsing for analysis

## Module Naming

Use descriptive module names with path-like format:

```typescript
// In components/auth/oauth-form.tsx
const logger = getSyncLogger("components/auth/oauth-form")

// In state/collections/core.ts
const logger = getLogger("state/collections/core")

// In hooks/use-request.ts
const logger = getSyncLogger("hooks/use-request")
```

**Format:** `{directory}/{subdirectory}/{file}` (without extension)

## Backend Logging

### Rust Macros

```rust
use log::{trace, debug, info, warn, error};

trace!("Very detailed: {:?}", variable);
debug!("Debug info: {}", value);
info!("Important: User {} logged in", user_id);
warn!("Warning: {} attempts failed", count);
error!("Error: {}", error_message);
```

### With Key-Value Pairs

```rust
info!(
    user_id = "user123",
    action = "login",
    provider = "google",
    "User authentication successful"
);
```

### Targets (Filtering)

Logs are tagged with their origin module:

```rust
// In src/http_client/engine.rs
info!(target: "knurl/http_client", "Request starting");

// In src/app_data/loader.rs
error!(target: "knurl/storage", "Failed to load data: {}", err);
```

## Finding Logs

### Development (Debug Builds)

**Frontend:**
- Browser console (F12)
- Tauri command line output

**Backend:**
- Terminal where app was launched
- Browser console (Webview target enabled)

### Production (Release Builds)

**Frontend & Backend:**
- Platform-specific log directories:
  - **Linux:** `~/.local/share/{bundleId}/logs/knurl.log`
  - **macOS:** `~/Library/Logs/{bundleId}/knurl.log`
  - **Windows:** `%LOCALAPPDATA%\{bundleId}\logs\knurl.log`

**Example on macOS:**
```bash
tail -f ~/Library/Logs/com.tauri.knurl/knurl.log
```

## Log File Management

### Rotation

- **Max file size:** 50KB
- **Strategy:** Keep all (auto-rotates to `.1`, `.2`, etc.)
- **Format:** `knurl.log`, `knurl.log.1`, `knurl.log.2`

### Cleaning Up

```bash
# Linux/macOS
rm ~/.local/share/com.tauri.knurl/logs/*
rm ~/Library/Logs/com.tauri.knurl/*

# Windows
rmdir %LOCALAPPDATA%\com.tauri.knurl\logs /s
```

## Examples

### Authentication Module

```typescript
import { getSyncLogger } from "@/lib/logger"

const logger = getSyncLogger("components/auth")

export function useAuth() {
  const handleLogin = async (credentials) => {
    try {
      logger.debug("Login attempt", { provider: credentials.provider })
      const result = await authenticate(credentials)
      logger.info("Login successful", { userId: result.id })
      return result
    } catch (error) {
      logger.error("Login failed", {
        provider: credentials.provider,
        reason: error.message,
      })
      throw error
    }
  }

  return { handleLogin }
}
```

### State Management

```typescript
import { getLogger } from "@/lib/logger"

const logger = getLogger("state/collections")

export function collectionsApi(get, set) {
  return {
    async saveCollection(collection) {
      try {
        logger.debug("Saving collection", { id: collection.id })
        await saveToFile(collection)
        logger.info("Collection saved", { id: collection.id, size: collection.requests.length })
      } catch (error) {
        logger.error("Failed to save collection", {
          id: collection.id,
          error: error.message,
        })
      }
    },
  }
}
```

### Backend HTTP Engine

```rust
use log::{debug, info, warn, error};

pub async fn execute_request(req: Request) -> Result<Response> {
    info!(method = ?req.method, url = ?req.url, "Request started");

    let start = Instant::now();
    match hyper_client.request(req).await {
        Ok(response) => {
            let elapsed = start.elapsed().as_millis();
            info!(
                status = response.status(),
                duration_ms = elapsed,
                "Request completed successfully"
            );
            Ok(response)
        }
        Err(e) => {
            error!(
                error = %e,
                elapsed_ms = start.elapsed().as_millis(),
                "Request failed"
            );
            Err(e.into())
        }
    }
}
```

## Best Practices

✅ **DO:**
- Include context in metadata (IDs, counts, names)
- Use appropriate log levels (info ≠ debug ≠ error)
- Create logger once at module level
- Use module names that reflect file location

❌ **DON'T:**
- Log sensitive data (passwords, tokens, keys)
- Format complex data in messages (use metadata)
- Create new logger on every function call
- Use console.log directly (use logger instead)
- Over-log in hot paths (network, render loops)

## Troubleshooting

### Logs Not Appearing

**Frontend:**
- Check browser console (F12 → Console tab)
- Verify logger module imported correctly
- Check app data log directory

**Backend:**
- Check terminal output
- Verify log crate macro imported (`use log::*`)
- Check log file in app data directory

### Performance Issues

- Reduce `debug` logs in release builds (use `info` minimum)
- Avoid logging in tight loops
- Use `getSyncLogger` for event handlers (no await)
- Filter by target in Tauri config if needed

### Log Files Growing Large

- Logs automatically rotate at 50KB
- Old files are kept (`.1`, `.2`, etc.)
- Manually delete old logs from app data directory
- Adjust max_file_size in Tauri config if needed

## Configuration

### Changing Log Level

In `src-tauri/src/lib.rs`:

```rust
tauri_plugin_log::Builder::new()
    .level(log::LevelFilter::Debug)  // Change here
    .level_for("noisy_module", log::LevelFilter::Warn)  // Per-module level
    .build()
```

### Adding New Logging Targets

```rust
.target(Target::new(TargetKind::Webview))  // Browser console
.target(Target::new(TargetKind::Stderr))   // Standard error
```

## References

- Frontend: `src-ui/src/lib/logger.ts`
- Backend Config: `src-tauri/src/lib.rs` (lines 509-551)
- Tauri Docs: https://v2.tauri.app/plugin/logging/
- Rust Log Crate: https://docs.rs/log/
