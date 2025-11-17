/**
 * Knurl Event System
 * Type-safe discriminated union for all UI and execution events
 */

// Base event interface with timestamp
export interface BaseEvent {
  timestamp: string // ISO 8601
}

// ============================================================================
// EVENT TYPES (Discriminated Unions)
// ============================================================================

// REQUEST UI EVENTS
export type RequestUiEvent = BaseEvent & {
  type: 'requestUi'
  action:
    | 'opened'
    | 'closed'
    | 'params.changed'
    | 'params.added'
    | 'params.deleted'
    | 'auth.changed'
    | 'auth.opened'
    | 'headers.changed'
    | 'headers.added'
    | 'headers.deleted'
    | 'body.changed'
    | 'body.cleared'
  tabId: string
  requestId?: string
  collectionId?: string
  // Context-specific fields based on action
  paramName?: string // For params.* actions
  headerName?: string // For headers.* actions
  authType?: string // For auth.* actions
  value?: string // For *.changed actions
}

// RESPONSE UI EVENTS
export type ResponseUiEvent = BaseEvent & {
  type: 'responseUi'
  action:
    | 'opened'
    | 'closed'
    | 'updated'
    | 'body.changed'
    | 'body.formatted'
    | 'headers.changed'
    | 'logs.changed'
    | 'format.toggled'
    | 'tab.switched'
  tabId: string
  statusCode?: number
  responseSize?: number
  contentType?: string
  // Context-specific fields
  format?: 'raw' | 'formatted' // For format.toggled
  activeTab?: 'body' | 'headers' | 'logs' // For tab.switched
}

// REQUEST EXECUTION EVENTS
export type RequestExecutionEvent = BaseEvent & {
  type: 'requestExecution'
  action: 'sent' | 'completed' | 'failed' | 'cancelled'
  tabId: string
  requestId: string
  method?: string // HTTP method (GET, POST, etc.)
  url?: string // Request URL
  statusCode?: number // Present for 'completed'
  responseTime?: number // Milliseconds (present for 'completed')
  error?: string // Error message (present for 'failed')
  reason?: string // Cancellation reason
}

// SIDEBAR UI EVENTS
export type SidebarUiEvent = BaseEvent & {
  type: 'sidebarUi'
  action: 'opened' | 'closed' | 'collapsed' | 'expanded'
  isCollapsed?: boolean // Convenience duplicate of action
  width?: number // Current width in pixels
}

// IMPORT/EXPORT UI EVENTS
export type ImportUiEvent = BaseEvent & {
  type: 'importUi'
  action: 'opened' | 'closed' | 'confirmed' | 'cancelled'
  importType?: 'collection' | 'request' | 'environment'
  collectionId?: string // For collection-specific imports
  fileSize?: number // Size of imported file in bytes
}

// ENVIRONMENT UI EVENTS
export type EnvironmentUiEvent = BaseEvent & {
  type: 'environmentUi'
  action:
    | 'opened'
    | 'closed'
    | 'selected'
    | 'created'
    | 'deleted'
    | 'variable.added'
  collectionId?: string
  environmentId?: string
  environmentName?: string
  variableKey?: string // For variable.added
  isSecure?: boolean // For variable.added
}

// SETTINGS UI EVENTS
export type SettingsUiEvent = BaseEvent & {
  type: 'settingsUi'
  action: 'opened' | 'closed' | 'changed'
  settingKey?: string // For changed action
  value?: any
}

// COLLECTION SETTINGS UI EVENTS
export type CollectionSettingsUiEvent = BaseEvent & {
  type: 'collectionSettingsUi'
  action: 'opened' | 'closed' | 'changed'
  collectionId: string
  settingKey?: string
  value?: any
}

// THEME EDITOR UI EVENTS
export type ThemeEditorUiEvent = BaseEvent & {
  type: 'themeEditorUi'
  action: 'opened' | 'closed' | 'changed'
  themeId?: string
  propertyChanged?: string // CSS property name
}

// DIALOG UI EVENTS
export type DialogUiEvent = BaseEvent & {
  type: 'dialogUi'
  action: 'opened' | 'closed' | 'confirmed' | 'cancelled'
  dialogId: string
  intent: 'delete' | 'rename' | 'save' | 'newCollection'
  itemType?: 'collection' | 'request' | 'folder' | 'environment'
  itemId?: string
  itemName?: string
  newName?: string // For rename intent
}

// COLLECTION EVENTS
export type CollectionEvent = BaseEvent & {
  type: 'collection'
  action: 'item.added' | 'item.deleted' | 'item.renamed' | 'item.moved'
  itemType: 'collection' | 'request' | 'folder'
  itemId: string
  parentId: string
  itemName?: string // Present for item.added, item.renamed
  newParentId?: string // Present for item.moved
  previousName?: string // Present for item.renamed
}

// ENVIRONMENT DATA EVENTS
export type EnvironmentEvent = BaseEvent & {
  type: 'environment'
  action:
    | 'selected'
    | 'created'
    | 'deleted'
    | 'variableAdded'
    | 'tabEnvironmentChanged'
  collectionId: string
  environmentId?: string | undefined
  environmentName?: string
  variableKey?: string // For variableAdded
  isSecure?: boolean // For variableAdded
  tabId?: string // For tabEnvironmentChanged
}

// ============================================================================
// DISCRIMINATED UNION OF ALL EVENTS
// ============================================================================

export type KnurlEvent =
  | RequestUiEvent
  | ResponseUiEvent
  | RequestExecutionEvent
  | SidebarUiEvent
  | ImportUiEvent
  | EnvironmentUiEvent
  | SettingsUiEvent
  | CollectionSettingsUiEvent
  | ThemeEditorUiEvent
  | DialogUiEvent
  | CollectionEvent
  | EnvironmentEvent
