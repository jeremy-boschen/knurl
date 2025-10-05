import { cloneElement, type ReactElement, type ReactNode } from "react"

import { ChevronDownIcon, FilePlus2Icon, PlusIcon, TriangleAlertIcon, TypeIcon, UndoIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
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
import { assert } from "@/lib"
import { useRequestTab, useCollections, useRequestParameters, useRequestHeaders, useRequestBody } from "@/state"
import { generateUniqueId } from "@/lib/utils"
import { CodeLanguages, type RequestBodyData, type RequestBodyGrammar, type RequestBodyType } from "@/types"
import { type AuthType, AuthTypes } from "@/types/request"
import { type RequestTabId, zRequestTabId } from "@/types"
import { RequestAuthPanel } from "./request-auth-panel"
import { RequestBodyPanel } from "./request-body-panel"
import { RequestHeadersPanel } from "./request-headers-panel"
import { RequestOptionsPanel } from "./request-options-panel"
import { RequestParametersPanel } from "./request-parameters-panel"

export type RequestEditorProps = {
  tabId: string
}

export function RequestEditor({ tabId }: RequestEditorProps) {
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
    <div className="flex h-full flex-1 min-h-0 flex-col ">
      <Tabs
        value={activeTab.activeTab as string}
        onValueChange={setActiveRequestTab}
        className="flex flex-1 min-h-0 flex-col gap-0"
      >
        <div className="sticky top-0 z-20 flex justify-between items-center px-2 bg-muted flex-nowra">
          <TabsList className="h-10 p-0 rounded-none space-x-2">
            <h2 className="text-lg font-medium mr-2 text-foreground">Request</h2>
            <div className="flex space-x-2">
              <RequestTabTrigger
                value="params"
                label="Params"
                onActivate={() => setActiveRequestTab("params")}
                menu={<ParamsTabMenu tabId={tabId} />}
              />
              <RequestTabTrigger
                value="headers"
                label="Headers"
                onActivate={() => setActiveRequestTab("headers")}
                menu={<HeadersTabMenu tabId={tabId} />}
              />
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
              <TabsTrigger value="options">Options</TabsTrigger>
            </div>
          </TabsList>
          <div className="flex items-center gap-0">
            {isDirty && (
              <div className="flex items-center space-x-2 text-xs text-warning">
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
                  >
                    <UndoIcon className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Discard Changes</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="flex min-h-0 h-full">
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
  )
}

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
      <TabsTrigger value={value} className="pr-8">
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
}

function TabDropdown({ ariaLabel, children, onActivate }: TabDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className="absolute right-1 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onPointerDown={() => onActivate?.()}
          onClick={(event) => {
            if (event.detail === 0) {
              onActivate?.()
            }
          }}
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      {children}
    </DropdownMenu>
  )
}

function ParamsTabMenu({ tabId, onActivate }: { tabId: string; onActivate: () => void }) {
  const {
    state: { cookieParams },
    actions,
  } = useRequestParameters(tabId)
  const showCookieItem = cookieParams !== undefined

  return (
    <TabDropdown ariaLabel="Open parameters menu" onActivate={onActivate}>
      <DropdownMenuContent side="bottom" align="end" className="w-56">
        <DropdownMenuItem onSelect={() => void actions.addPathParam()}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Path Parameter
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void actions.addQueryParam()}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Query Parameter
        </DropdownMenuItem>
        {showCookieItem && (
          <DropdownMenuItem onSelect={() => void actions.addCookieParam()}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Cookie
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </TabDropdown>
  )
}

function HeadersTabMenu({ tabId, onActivate }: { tabId: string; onActivate?: () => void }) {
  const { actions } = useRequestHeaders(tabId)

  return (
    <TabDropdown ariaLabel="Open headers menu" onActivate={onActivate}>
      <DropdownMenuContent side="bottom" align="end" className="w-48">
        <DropdownMenuItem onSelect={() => void actions.addHeader()}>
          <PlusIcon className="mr-2 h-4 w-4" />
          Add Header
        </DropdownMenuItem>
      </DropdownMenuContent>
    </TabDropdown>
  )
}

const COMMON_LANGUAGES = ["json", "yaml", "graphql", "text"] as const

function BodyTabMenu({ tabId, onActivate }: { tabId: string; onActivate?: () => void }) {
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

    actions.updateRequestPatch({ body: fullBody })
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
    actions.updateRequestPatch({
      body: {
        encoding: "multipart",
        formData: {
          [id]: { id, key: "", value: "", enabled: true, secure: false, kind: "file" },
        },
      },
    })
  }

  return (
    <TabDropdown ariaLabel="Open body menu" onActivate={onActivate}>
      <DropdownMenuContent side="bottom" align="end" className="w-64">
        <DropdownMenuLabel>Body Type</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selectedValue} onValueChange={handleValueChange}>
          <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="binary">Binary File</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Form</DropdownMenuLabel>
          <DropdownMenuRadioItem value="form:url">URL-Encoded</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="form:multipart">Multipart</DropdownMenuRadioItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Text</DropdownMenuLabel>
          {visibleLanguages.map((lang) => (
            <DropdownMenuRadioItem key={lang.language} value={`text:${lang.language}`}>
              {lang.title}
            </DropdownMenuRadioItem>
          ))}
          {moreLanguages.length > 0 && (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger inset>More Languages</DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-56">
                <DropdownMenuRadioGroup value={selectedValue} onValueChange={handleValueChange}>
                  {moreLanguages.map((lang) => (
                    <DropdownMenuRadioItem key={lang.language} value={`text:${lang.language}`}>
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
            <DropdownMenuItem onSelect={() => addFormField("text")}>
              <TypeIcon className="mr-2 h-4 w-4" />
              Add Text Field
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => addFormField("file")}>
              <FilePlus2Icon className="mr-2 h-4 w-4" />
              Add File Field
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </TabDropdown>
  )
}

function AuthTabMenu({ tabId, onActivate }: { tabId: string; onActivate?: () => void }) {
  const {
    state: { request },
  } = useRequestTab(tabId)
  const {
    actions: { collectionsApi },
  } = useCollections()

  const authType = request.authentication?.type ?? "none"

  const handleAuthTypeChange = (value: AuthType) => {
    const base =
      value === "oauth2"
        ? {
            type: "oauth2" as const,
            oauth2: { grantType: "client_credentials", tokenCaching: "always", clientAuth: "body" } as const,
          }
        : ({ type: value } as const)

    void collectionsApi().updateRequestPatch(request.collectionId, request.id, {
      authentication: base,
    })
  }

  return (
    <TabDropdown ariaLabel="Open authentication menu" onActivate={onActivate}>
      <DropdownMenuContent side="bottom" align="end" className="w-56">
        <DropdownMenuLabel>Authentication</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={authType} onValueChange={(value) => handleAuthTypeChange(value as AuthType)}>
          {Object.entries(AuthTypes).map(([type, name]) => (
            <DropdownMenuRadioItem key={type} value={type}>
              {name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </TabDropdown>
  )
}
