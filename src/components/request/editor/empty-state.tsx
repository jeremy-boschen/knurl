export type EmptyStateProps = {
  message: string
  height?: "default" | "tall"
}

export function EmptyState({ message, height = "default" }: EmptyStateProps) {
  return (
    <div
      className={`text-center text-sm text-muted-foreground/70 ${height === "tall" ? "py-8" : "h-[2.25rem] flex items-center justify-center"}`}
    >
      {message}
    </div>
  )
}
