# Postman Lite Parser Plan

## Context
- Goal: Replace the `postman-collection` dependency with a lightweight, in-house parser for Postman Collection v2.1 that only handles fields supported by Knurl.
- Constraints: Ignore Postman features we do not support (tests, responses, advanced auth inheritance, file uploads, GraphQL, etc.) while keeping import UX intact.

-## Tasks
- [x] Audit current Postman import implementation (`parsers.ts`, `use-import-parser`, related tests) to capture existing assumptions.
- [x] Define Zod schemas/types for the minimal Postman v2.1 subset we need, noting unsupported cases and error UX.
- [x] Implement parser + normaliser updates, wire into import flow, and add fixtures/tests covering happy-path and unsupported scenarios.

## Notes
- Enforce Postman Collection v2.1 by validating `info.schema` and raising a user-facing error for older exports.
- Ignore Postman responses/tests/pre-request scripts in conversion; import only name, method, URL, headers, body, auth, variables.
- Prefer reuse of existing OpenAPI import pathways where possible.
- Emit user-friendly errors when encountering unsupported Postman body/auth types.
- Consider future extension: environment variable interpolation and folder-level auth inheritance.
