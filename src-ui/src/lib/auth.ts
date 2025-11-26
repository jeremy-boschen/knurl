/**
 * Shared authentication utilities
 *
 * Centralized logic for creating default auth configurations.
 * This ensures all components creating auth objects maintain consistency.
 */

import type { AuthConfig } from "@/types/request"

/**
 * Creates a complete default AuthConfig for a given auth type.
 *
 * This is the single source of truth for auth object initialization.
 * All components (request editor, collection settings, etc.) should use this
 * to ensure consistent, valid auth objects that can round-trip through storage.
 */
export function createDefaultAuthConfig(type: string): AuthConfig {
  switch (type) {
    case "none":
      return { type: "none" }
    case "inherit":
      return { type: "inherit" }
    case "basic":
      return { type: "basic", basic: {} }
    case "bearer":
      return {
        type: "bearer",
        bearer: {
          scheme: "Bearer",
          placement: { type: "header", name: "Authorization" },
        },
      }
    case "apiKey":
      return {
        type: "apiKey",
        apiKey: {
          placement: { type: "header", name: "" },
        },
      }
    case "oauth2":
      return {
        type: "oauth2",
        oauth2: {
          grantType: "client_credentials",
          tokenCaching: "always",
          clientAuth: "body",
        },
      }
    default:
      return { type: "none" }
  }
}
