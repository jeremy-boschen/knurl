import type {
  CollectionsStateSlice,
  CredentialsCacheStateSlice,
  RequestTabsStateSlice,
  SettingsSlice,
  SidebarStateSlice,
  UtilitySheetsStateSlice,
} from "@/types"

export type ApplicationState = CollectionsStateSlice &
  RequestTabsStateSlice &
  SidebarStateSlice &
  SettingsSlice &
  CredentialsCacheStateSlice &
  UtilitySheetsStateSlice
