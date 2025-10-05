import { z } from "zod"

export const utilitySheetTypes = [
  "settings",
  "import",
  "export",
  "environment",
  "collection-settings",
  "theme-editor",
] as const

export type UtilitySheetType = (typeof utilitySheetTypes)[number]

const zExportContext = z.object({
  collectionId: z.string(),
})

const zEnvironmentContext = z.object({
  collectionId: z.string(),
  selectedEnvironmentId: z.string().optional(),
})

const zCollectionSettingsContext = z.object({
  collectionId: z.string(),
  tab: z.enum(["environments", "authentication"]).optional(),
  selectedEnvironmentId: z.string().optional(),
})

export const zUtilitySheet = z.discriminatedUnion("type", [
  z.object({ type: z.literal("settings") }),
  z.object({ type: z.literal("import") }),
  z.object({ type: z.literal("theme-editor") }),
  z.object({ type: z.literal("export"), context: zExportContext }),
  z.object({ type: z.literal("environment"), context: zEnvironmentContext }),
  z.object({ type: z.literal("collection-settings"), context: zCollectionSettingsContext }),
])

export type UtilitySheetInput = z.infer<typeof zUtilitySheet>

export type UtilitySheet = UtilitySheetInput & { id: string }

export type UtilitySheetsState = {
  stack: UtilitySheet[]
  lastDismissed: UtilitySheet | null
}

export interface UtilitySheetsStateApi {
  openSheet(sheet: UtilitySheetInput): void
  closeSheet(): void
  reopenLastSheet(): void
  getActiveSheet(): UtilitySheet | null
  popSheet(): void
  getStack(): UtilitySheet[]
}

export interface UtilitySheetsStateSlice {
  utilitySheetsState: UtilitySheetsState
  utilitySheetsApi: UtilitySheetsStateApi
}
