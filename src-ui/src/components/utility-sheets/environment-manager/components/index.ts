import type { Environment } from "@/types"

export type EnvironmentAction = "select" | "rename" | "delete" | "duplicate"

export type EnvironmentActionHandler = (environment: Environment, action: EnvironmentAction) => void

// re-export for utility
export type { Environment }

export * from "./environment-editor"
export * from "./environment-list"
