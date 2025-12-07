import { EmptyState } from "./empty-state"
import { FormFieldRow } from "./form-field-row"
import type { FormField } from "@/types"

type FormFieldListProps = {
  tabId: string
  formData?: Record<string, FormField> | null
  originalFormData?: Record<string, FormField> | null
  onGuessContentType: (fileName: string | undefined) => string | undefined
}

export function FormFieldList({ tabId, formData, originalFormData, onGuessContentType }: FormFieldListProps) {
  const order = Object.keys(formData ?? {})

  return (
    <>
      {order.map((id) => {
        const field = formData?.[id]
        if (!field) {
          return null
        }
        return (
          <FormFieldRow
            key={field.id}
            tabId={tabId}
            field={field}
            original={originalFormData?.[id]}
            orderIds={order}
            onGuessContentType={onGuessContentType}
          />
        )
      })}

      {order.length === 0 && <EmptyState message="No form items added yet. Click 'Add Form Item' to get started." />}
    </>
  )
}
