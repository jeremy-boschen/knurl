# KNURL - Desktop HTTP Client

A cloudless HTTP client application built with Tauri, React, and TypeScript.

## Project Overview

This application is a desktop HTTP client that allows users to create, save, and execute HTTP requests. It uses Tauri as
the desktop framework, React for the UI, and TypeScript for type safety.

## Simplified Architecture

The application uses a simple and lightweight architecture:

- **Zustand** for state management
- **TypeScript interfaces** for type definitions (instead of zod)
- **Tauri** for desktop integration and native functionality
- **React hooks** for component logic

## Key Features

- Create and execute HTTP requests (GET, POST, PUT, DELETE, etc.)
- Save requests in collections
- View and analyze HTTP responses
- Manage environments with variables
- Authentication support (Bearer, Basic, API Key, OAuth2)

### OAuth2 Discovery

- Use the Discovery URL field to point to your issuer base (e.g., `https://auth.example.com`) or a full `.well-known`
  URL.
- Clicking Discover fetches the OpenID configuration and fills the authorization and token endpoints.

### Terminology

- The app uses Authentication for request/collection auth settings throughout the UI.
- Authorization appears only where technically correct: the HTTP `Authorization` header and the OAuth2 authorization
  endpoint.

### Environment Variables

- Define variables per environment and reference them with `{{name}}` in URLs, params, headers, and bodies.
- URL tokens `{name}` and `:name` also resolve from path/query parameters when present.
- Only enabled variables substitute; unresolved placeholders remain in the text.
- The Discovery URL itself is not overwritten by Discover.

## Development

### Prerequisites

- Node.js v20+
- Yarn v1.22+
- Rust (1.88.0+)
- MSVC build tools
- WebView2 runtime
- On Windows, the repo ships `.cargo/config.toml` files that pin `aws-lc-sys` to its pre-generated artifacts so you
  don't need CMake/NASM locally. Leave those entries in place, or install both tools before building.

### Setup

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Start the development server:
   ```bash
   # With WebView devtools enabled (recommended during development)
   yarn tauri:dev
   # Or explicitly
   yarn tauri dev --features devtools
   # Without devtools (smaller, closer to release)
   yarn tauri dev
   ```

3. Build for production:
   ```bash
   yarn tauri build
   ```

## Testing

Run tests with:

```bash
yarn test
```

## Project Structure

- `src/` - React UI components and hooks
- `src-tauri/` - Rust backend code
- `src/lib/` - Shared utilities and types
- `src/components/` - React components
- `src/pages/` - Page components

## State Management

The application uses Zustand for state management. The store is defined in `src/state/application.ts` and provides:

- Application state
- Actions to update state
- Async operations for data fetching

Components can access the state using the `useApplication` hook:

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

Apache-2.0. See `LICENSE` for details.
