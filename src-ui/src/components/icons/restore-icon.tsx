export function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <title>Restore</title>
      {/* Top-right rectangle (smaller) */}
      <rect x="9" y="3" width="12" height="8" rx="0.5" />
      {/* Bottom-left rectangle (larger) */}
      <rect x="3" y="9" width="12" height="12" rx="0.5" />
    </svg>
  )
}
