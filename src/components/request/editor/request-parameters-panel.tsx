import { Input } from "@/components/ui/knurl/input"
import { cn } from "@/lib"
import { useRequestParameters } from "@/state"
import type { RequestCookieParam } from "@/types"
import { FieldRow } from "./field-row"
import { SectionHeader } from "./section-header"
import { EmptyState } from "./empty-state"

export type RequestParametersPanelProps = {
  tabId: string
}

export function RequestParametersPanel({ tabId }: RequestParametersPanelProps) {
  const {
    state: { queryParams, pathParams, cookieParams, original },
    actions,
  } = useRequestParameters(tabId)

  return (
    <div className="flex flex-col gap-4 p-2 h-full overflow-y-auto min-h-0">
      {/* Path Parameters Section */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Path Parameters" />

        <div className="flex flex-col gap-3 divide-y divide-border/10">
          {Object.values(pathParams ?? {}).map((pathParam) => (
            <FieldRow
              key={pathParam.id}
              enabled={pathParam.enabled}
              onEnabledChange={(enabled) => actions.updatePathParam(pathParam.id, { enabled })}
              nameValue={pathParam.name}
              onNameChange={(name) => actions.updatePathParam(pathParam.id, { name })}
              valueSlot={
                <Input
                  type={pathParam.secure ? "password" : "text"}
                  placeholder="Value"
                  value={pathParam.value}
                  onChange={(e) => actions.updatePathParam(pathParam.id, { value: e.target.value })}
                  className={cn(
                    "font-mono",
                    original.pathParams?.[pathParam.id]?.value !== pathParam.value && "unsaved-changes",
                  )}
                />
              }
              onDelete={() => actions.removePathParam(pathParam.id)}
              secure={pathParam.secure}
              onSecureChange={(secure) => actions.updatePathParam(pathParam.id, { secure })}
              deleteTooltip="Delete Path Parameter"
              hasUnsavedEnabled={original.pathParams?.[pathParam.id]?.enabled !== pathParam.enabled}
              hasUnsavedName={original.pathParams?.[pathParam.id]?.name !== pathParam.name}
              hasUnsavedSecure={original.pathParams?.[pathParam.id]?.secure !== pathParam.secure}
            />
          ))}

          {Object.keys(pathParams ?? {}).length === 0 && (
            <EmptyState message="No path parameters added yet. Path parameters replace placeholders in the URL (e.g., /users/:id)." />
          )}
        </div>
      </div>

      {/* Query Parameters Section */}
      <div className="flex flex-col gap-3">
        <SectionHeader title="Query Parameters" />

        <div className="flex flex-col gap-3 divide-y divide-border/10">
          {Object.values(queryParams ?? {}).map((param) => (
            <FieldRow
              key={param.id}
              enabled={param.enabled}
              onEnabledChange={(enabled) => actions.updateQueryParam(param.id, { enabled })}
              nameValue={param.name}
              onNameChange={(name) => actions.updateQueryParam(param.id, { name })}
              valueSlot={
                <Input
                  type={param.secure ? "password" : "text"}
                  placeholder="Value"
                  value={param.value}
                  onChange={(e) => actions.updateQueryParam(param.id, { value: e.target.value })}
                  className={cn(
                    "font-mono",
                    original.queryParams?.[param.id]?.value !== param.value && "unsaved-changes",
                  )}
                />
              }
              onDelete={() => actions.removeQueryParam(param.id)}
              secure={param.secure}
              onSecureChange={(secure) => actions.updateQueryParam(param.id, { secure })}
              deleteTooltip="Delete Query Parameter"
              hasUnsavedEnabled={original.queryParams?.[param.id]?.enabled !== param.enabled}
              hasUnsavedName={original.queryParams?.[param.id]?.name !== param.name}
              hasUnsavedSecure={original.queryParams?.[param.id]?.secure !== param.secure}
            />
          ))}

          {Object.keys(queryParams ?? {}).length === 0 && (
            <EmptyState message="No query parameters added yet. Query parameters are appended to the URL (e.g., ?name=value)." />
          )}
        </div>
      </div>

      {/* Cookies Section (render only when provided to keep tests deterministic) */}
      {cookieParams !== undefined && (
        <div className="flex flex-col gap-3">
          <SectionHeader title="Cookies" />

          <div className="flex flex-col gap-3 divide-y divide-border/10">
            {Object.values((cookieParams ?? {}) as Record<string, RequestCookieParam>).map((param) => (
              <FieldRow
                key={param.id}
                enabled={param.enabled}
                onEnabledChange={(enabled) => actions.updateCookieParam(param.id, { enabled })}
                nameValue={param.name}
                onNameChange={(name) => actions.updateCookieParam(param.id, { name })}
                valueSlot={
                  <Input
                    type={param.secure ? "password" : "text"}
                    placeholder="Value"
                    value={param.value}
                    onChange={(e) => actions.updateCookieParam(param.id, { value: e.target.value })}
                    className={cn(
                      "font-mono",
                      original.cookieParams?.[param.id]?.value !== param.value && "unsaved-changes",
                    )}
                  />
                }
                onDelete={() => actions.removeCookieParam(param.id)}
                secure={param.secure}
                onSecureChange={(secure) => actions.updateCookieParam(param.id, { secure })}
                deleteTooltip="Delete Cookie"
                hasUnsavedEnabled={original.cookieParams?.[param.id]?.enabled !== param.enabled}
                hasUnsavedName={original.cookieParams?.[param.id]?.name !== param.name}
                hasUnsavedSecure={original.cookieParams?.[param.id]?.secure !== param.secure}
              />
            ))}

            {Object.keys((cookieParams ?? {}) as Record<string, RequestCookieParam>).length === 0 && (
              <EmptyState message="No cookies added yet." />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
