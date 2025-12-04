export function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <title>Restore</title>
      {/* Top square */}
      <rect x="8" y="6" width="10" height="10" rx="1" />
      {/* Bottom square - only draw the visible parts */}
      {/* Left side */}
      <line x1="6" y1="9" x2="6" y2="19" />
      {/* Bottom side */}
      <line x1="6" y1="19" x2="16" y2="19" />
      {/* Right side */}
      <line x1="16" y1="19" x2="16" y2="9" />
      {/* Top side - only the part not covered by top square */}
      <line x1="16" y1="9" x2="6" y2="9" />
    </svg>
  )
}
