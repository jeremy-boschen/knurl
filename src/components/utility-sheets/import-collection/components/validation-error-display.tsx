import type { core } from "zod"

export function ValidationErrorDisplay({ issues }: { issues: core.ZodIssue[] }) {
  return (
    <div className="p-3 border border-destructive/50 bg-destructive/10 rounded-md text-destructive text-xs max-h-24 overflow-y-auto">
      <h4 className="font-bold mb-1 text-sm">Validation Errors</h4>
      <ul className="space-y-1 list-disc list-inside">
        {issues.map((issue, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: index is stable
          <li key={i}>
            <span className="font-semibold">{issue.path.join(".") || "Root"}</span>: {issue.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
