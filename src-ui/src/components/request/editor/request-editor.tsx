import React, { cloneElement, type ReactElement, type ReactNode, Profiler } from "react"

import { ChevronDownIcon, TriangleAlertIcon, TypeIcon, UndoIcon, FilePlus2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { onProfilerRender } from "@/lib/profiler-bridge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/knurl/tooltip"
import { assert, createDefaultAuthConfig } from "@/lib"
import { useCollections, useRequestBody, useRequestTab } from "@/state"
import { generateUniqueId } from "@/lib/utils"
import {
  CodeLanguages,
  type RequestBodyData,
  type RequestBodyGrammar,
  type RequestBodyType,
  type RequestTabId,
  zRequestTabId,
} from "@/types"
import { type AuthType, AuthTypes } from "@/types/request"
import { RequestAuthPanel } from "./request-auth-panel"
import { RequestBodyPanel } from "./request-body-panel"
import { RequestHeadersPanel } from "./request-headers-panel"
import { RequestOptionsPanel } from "./request-options-panel"
import { RequestParametersPanel } from "./request-parameters-panel"

export type RequestEditorProps = {
  tabId: string
}

function RequestEditorComponent({ tabId }: RequestEditorProps) {
  const {
    state: { activeTab, isDirty },
    actions: { requestTabsApi },
  } = useRequestTab(tabId)
  const {
    actions: { collectionsApi },
  } = useCollections()

  const setActiveRequestTab = (tab: string) => {
    assert(tab in zRequestTabId.enum, `Invalid tab: ${tab}`)
    requestTabsApi.updateTab(tabId, {
      activeTab: tab as RequestTabId,
    })
  }

  const handleDiscardPatch = () => {
    void collectionsApi().discardRequestPatch(activeTab.collectionId, activeTab.requestId)
  }

  return (
    <Profiler id="RequestEditor" onRender={onProfilerRender}>
      <div className="flex h-full flex-1 min-h-0 flex-col" data-test-id="request-editor">
        <Tabs
          value={activeTab.activeTab as string}
          onValueChange={setActiveRequestTab}
          className="flex flex-1 min-h-0 flex-col gap-0"
        >
          <div className="sticky top-0 z-20 flex justify-between items-center px-2 bg-muted flex-nowra">
            <TabsList className="h-10 p-0 rounded-none space-x-2">
              <h2 className="text-lg font-medium mr-2 text-foreground">Request</h2>
              <div className="flex space-x-2">
                <TabsTrigger value="params" data-test-id="request-editor:params-tab">
                  Params
                </TabsTrigger>
                <TabsTrigger value="headers" data-test-id="request-editor:headers-tab">
                  Headers
                </TabsTrigger>
                <RequestTabTrigger
                  value="body"
                  label="Body"
                  onActivate={() => setActiveRequestTab("body")}
                  menu={<BodyTabMenu tabId={tabId} />}
                />
                <RequestTabTrigger
                  value="auth"
                  label="Authentication"
                  onActivate={() => setActiveRequestTab("auth")}
                  menu={<AuthTabMenu tabId={tabId} />}
                />
                <TabsTrigger value="options" data-test-id="request-editor:options-tab">
                  Options
                </TabsTrigger>
              </div>
            </TabsList>
            <div className="flex items-center gap-0">
              {isDirty && (
                <div
                  className="flex items-center space-x-2 text-xs text-warning"
                  data-test-id="request-editor:dirty-indicator"
                >
                  <TriangleAlertIcon className="w-4 h-4 mr-1" /> MODIFIED
                </div>
              )}
              {isDirty && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Discard changes"
                      onClick={handleDiscardPatch}
                      className="ml-2"
                      data-test-id="request-editor:discard-changes-button"
                    >
                      <UndoIcon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Discard Changes</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          <div className="flex min-h-0 h-full mr-2">
            <TabsContent value="params" className="m-0 h-full overflow-y-auto">
              <RequestParametersPanel tabId={tabId} />
            </TabsContent>

            <TabsContent value="headers" className="m-0 h-full overflow-y-auto">
              <RequestHeadersPanel tabId={tabId} />
            </TabsContent>

            <TabsContent value="body" className="m-0 h-full overflow-y-auto">
              <RequestBodyPanel tabId={tabId} />
            </TabsContent>

            <TabsContent value="auth" className="m-0 h-full overflow-y-auto">
              <RequestAuthPanel tabId={tabId} />
            </TabsContent>

            <TabsContent value="options" className="m-0 h-full overflow-y-auto">
              <RequestOptionsPanel tabId={tabId} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </Profiler>
  )
}

export const RequestEditor = React.memo(RequestEditorComponent)

type RequestTabTriggerProps = {
  value: string
  label: string
  menu: ReactElement
  onActivate: () => void
}

function RequestTabTrigger({ value, label, menu, onActivate }: RequestTabTriggerProps) {
  const renderedMenu = cloneElement(menu, { onActivate })

  return (
    <div className="relative flex items-center">
      <TabsTrigger value={value} className="pr-8" data-test-id={`request-editor:${value}-tab`}>
        {label}
      </TabsTrigger>
      {renderedMenu}
    </div>
  )
}

type TabDropdownProps = {
  ariaLabel: string
  children: ReactNode
  onActivate: () => void
  tabName: string
}

function TabDropdown({ ariaLabel, children, onActivate, tabName }: TabDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
          onPointerDown={() => onActivate?.()}
          onClick={(event) => {
            if (event.detail === 0) {
              onActivate?.()
            }
          }}
          data-test-id={`request-editor:${tabName}-tab-dropdown-trigger`}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      {children}
    </DropdownMenu>
  )
}

const COMMON_LANGUAGES = ["json", "yaml", "graphql", "text"] as const

export function BodyTabMenu({ tabId, onActivate }: { tabId: string; onActivate?: () => void }) {
  const {
    state: { body },
    actions,
  } = useRequestBody(tabId)

  const selectedValue = (() => {
    switch (body.type) {
      case "form":
        return `form:${body.encoding ?? "url"}`
      case "text":
        return `text:${body.language ?? "text"}`
      default:
        return body.type
    }
  })()

  const { visibleLanguages, moreLanguages } = (() => {
    const currentLanguage = body.type === "text" ? body.language : null
    const isCommon = currentLanguage
      ? COMMON_LANGUAGES.includes(currentLanguage as (typeof COMMON_LANGUAGES)[number])
      : false

    const visible = new Set<RequestBodyGrammar>(COMMON_LANGUAGES)
    if (currentLanguage && !isCommon) {
      visible.add(currentLanguage as RequestBodyGrammar)
    }

    const visibleLangs = CodeLanguages.filter((lang) => visible.has(lang.language))
    const moreLangs = CodeLanguages.filter((lang) => !visible.has(lang.language))

    return { visibleLanguages: visibleLangs, moreLanguages: moreLangs }
  })()

  const handleBodyChange = (nextType: Partial<RequestBodyData> & { type: RequestBodyType }) => {
    let fullBody: RequestBodyData

    switch (nextType.type) {
      case "form": {
        const encoding = nextType.encoding ?? (body.type === "form" ? (body.encoding ?? "url") : "url")
        fullBody = {
          type: "form",
          encoding,
          formData: {},
        }
        break
      }
      case "text": {
        const language = nextType.language ?? (body.type === "text" ? (body.language ?? "text") : "text")
        fullBody = {
          type: "text",
          language,
          content: body.type === "text" ? (body.content ?? "") : "",
        }
        break
      }
      case "binary":
        fullBody = { type: "binary" }
        break
      default:
        fullBody = { type: "none" }
        break
    }

    actions.updateBody(fullBody)
  }

  const handleValueChange = (value: string) => {
    const [type, subType] = value.split(":")
    switch (type) {
      case "none":
      case "binary":
        handleBodyChange({ type: type as "none" | "binary" })
        break
      case "form":
        handleBodyChange({ type: "form", encoding: subType as "url" | "multipart" })
        break
      case "text":
        handleBodyChange({ type: "text", language: subType as RequestBodyGrammar })
        break
    }
  }

  const addFormField = (kind: "text" | "file") => {
    if (kind === "text") {
      actions.addFormItem()
      return
    }

    const id = generateUniqueId(8)
    actions.updateBody({ encoding: "multipart" })
    actions.updateFormItem(id, { id, key: "", value: "", enabled: true, secure: false, kind: "file" })
  }

  return (
    <TabDropdown ariaLabel="Open body menu" onActivate={onActivate} tabName="body">
      <DropdownMenuContent side="bottom" align="end" className="w-64" data-test-id="request-editor:body-menu">
        <DropdownMenuLabel>Body Type</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedValue} onValueChange={handleValueChange}>
          <DropdownMenuRadioItem value="none" data-test-id="request-editor:body-menu:type-none">
            None
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="binary" data-test-id="request-editor:body-menu:type-binary">
            Binary File
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Form</DropdownMenuLabel>
          <DropdownMenuRadioItem value="form:url" data-test-id="request-editor:body-menu:type-form-url">
            URL-Encoded
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="form:multipart" data-test-id="request-editor:body-menu:type-form-multipart">
            Multipart
          </DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Text</DropdownMenuLabel>
          {visibleLanguages.map((lang) => (
            <DropdownMenuRadioItem
              key={lang.language}
              value={`text:${lang.language}`}
              data-test-id={`request-editor:body-menu:type-text-${lang.language}`}
            >
              {lang.title}
            </DropdownMenuRadioItem>
          ))}
          {moreLanguages.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset data-test-id="request-editor:body-menu:more-languages">
                More Languages
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup value={selectedValue} onValueChange={handleValueChange}>
                  {moreLanguages.map((lang) => (
                    <DropdownMenuRadioItem
                      key={lang.language}
                      value={`text:${lang.language}`}
                      data-test-id={`request-editor:body-menu:type-text-${lang.language}`}
                    >
                      {lang.title}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          )}
        </DropdownMenuRadioGroup>

        {body.type === "form" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Form Fields</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => addFormField("text")}
              data-test-id="request-editor:body-menu:add-text-field"
            >
              <TypeIcon className="mr-2 h-4 w-4" />
              Add Text Field
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => addFormField("file")}
              data-test-id="request-editor:body-menu:add-file-field"
            >
              <FilePlus2Icon className="mr-2 h-4 w-4" />
              Add File Field
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </TabDropdown>
  )
}

export function AuthTabMenu({ tabId, onActivate }: { tabId: string; onActivate?: () => void }) {
  const {
    state: { request },
  } = useRequestTab(tabId)
  const {
    actions: { collectionsApi },
  } = useCollections()

  const authType = request.authentication?.type ?? "none"

  const handleAuthTypeChange = (value: AuthType) => {
    const base = createDefaultAuthConfig(value as string)
    void collectionsApi().setRequestAuthentication(request.collectionId, request.id, base)
  }

  return (
    <TabDropdown ariaLabel="Open authentication menu" onActivate={onActivate} tabName="auth">
      <DropdownMenuContent side="bottom" align="end" className="w-56" data-test-id="request-editor:auth-menu">
        <DropdownMenuLabel>Authentication</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={authType} onValueChange={(value) => handleAuthTypeChange(value as AuthType)}>
          {Object.entries(AuthTypes).map(([type, name]) => (
            <DropdownMenuRadioItem key={type} value={type} data-test-id={`request-editor:auth-menu:type-${type}`}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </TabDropdown>
  )
}
