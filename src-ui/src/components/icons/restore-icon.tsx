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
      <defs>
        <clipPath id="bottomClip">
          <rect x="3" y="7" width="9" height="9" />
        </clipPath>
      </defs>
      {/* Top square - drawn first so bottom doesn't hide its lines */}
      <rect x="12" y="3" width="9" height="9" rx="1" />
      {/* Bottom square - clipped to not overlap top square's lines */}
      <rect x="3" y="7" width="9" height="9" rx="1" clipPath="url(#bottomClip)" />
    </svg>
  )
}
