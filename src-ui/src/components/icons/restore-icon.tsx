export function RestoreIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      shapeRendering="geometricPrecision"
      className={className}
    >
      <title>Restore</title>
      <defs>
        <mask id="restore-cutout">
          {/* White = visible, Black = hidden */}
          <rect width="24" height="24" fill="white" />
          {/* Slightly larger than the bottom rect to avoid AA fringe */}
          <rect x="2" y="8" width="14" height="14" fill="black" />
        </mask>
      </defs>

      {/* Top-right rectangle, masked so it doesn't overlap */}
      <rect x="6" y="6" width="12" height="12" rx="0.5" mask="url(#restore-cutout)" />

      {/* Bottom-left rectangle */}
      <rect x="3" y="9" width="12" height="12" rx="0.5" />
    </svg>
  )
}
