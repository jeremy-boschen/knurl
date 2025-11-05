import type {
  CollectionsSlice,
  CredentialsCacheSlice,
  RequestTabsSlice,
  SettingsSlice,
  SidebarSlice,
  UtilitySheetsSlice,
} from "@/types"

export type Application = CollectionsSlice &
  RequestTabsSlice &
  SidebarSlice &
  SettingsSlice &
  CredentialsCacheSlice &
  UtilitySheetsSlice
