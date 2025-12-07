import { FileInput } from "@/components/ui/knurl"
import { useRequestBody } from "@/state"
import type { FormField } from "@/types"
import { FieldRow } from "./field-row"

export type FormFieldRowProps = {
  tabId: string
  field: FormField
  original?: FormField
  orderIds: string[]
  onGuessContentType: (fileName: string | undefined) => string | undefined
}

export function FormFieldRow({ tabId, field, original, orderIds, onGuessContentType }: FormFieldRowProps) {
  const { actions } = useRequestBody(tabId)

  const reorder = (direction: "up" | "down") => {
    const idx = orderIds.indexOf(field.id)
    if (idx === -1) {
      return
    }
    const target = direction === "up" ? idx - 1 : idx + 1
    if (target < 0 || target >= orderIds.length) {
      return
    }
    const next = [...orderIds]
    ;[next[idx], next[target]] = [next[target], next[idx]]
    actions.reorderFormItems(next)
  }

  return (
    <FieldRow
      fieldKey={field.id}
      dataTestIdPrefix="request-body-panel:form"
      field={{
        enabled: field.enabled,
        name: field.key,
        value: field.value,
        secure: field.kind === "text" ? field.secure : undefined,
      }}
      unsaved={{
        enabled: original?.enabled !== field.enabled,
        name: original?.key !== field.key,
        value: original?.value !== field.value,
        secure: original?.secure !== field.secure,
      }}
      valueSlot={
        field.kind === "file" ? (
          <FileInput
            fileName={field.fileName ?? ""}
            contentType={field.contentType ?? ""}
            onFileChange={(path, name, mimeType) => {
              const detected = mimeType ?? onGuessContentType(name)
              actions.updateFormItem(field.id, {
                kind: "file",
                fileName: name,
                filePath: path,
                contentType: detected,
                value: "",
              })
            }}
            onContentTypeChange={(ct) => actions.updateFormItem(field.id, { contentType: ct })}
            onClear={() =>
              actions.updateFormItem(field.id, {
                kind: "file",
                fileName: "",
                filePath: undefined,
                contentType: "",
                value: "",
              })
            }
            data-test-id={`request-body-panel:form-file-input:${field.id}`}
          />
        ) : undefined
      }
      onChange={(changes) => {
        if ("enabled" in changes) {
          actions.updateFormItem(field.id, { enabled: !!changes.enabled })
        }
        if ("name" in changes && changes.name !== undefined) {
          actions.updateFormItem(field.id, { key: changes.name })
        }
        if ("value" in changes && changes.value !== undefined) {
          actions.updateFormItem(field.id, { value: changes.value })
        }
        if ("secure" in changes && changes.secure !== undefined) {
          actions.updateFormItem(field.id, { secure: !!changes.secure })
        }
      }}
      onDelete={() => actions.removeFormItem(field.id)}
      onMoveUp={() => reorder("up")}
      onMoveDown={() => reorder("down")}
      canMoveUp={orderIds.indexOf(field.id) > 0}
      canMoveDown={orderIds.indexOf(field.id) < orderIds.length - 1}
    />
  )
}
