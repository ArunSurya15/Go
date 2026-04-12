/** Two-lane swap: top →, bottom ← (use rotate-90 when the control sits between stacked From/To). */
export function InterchangeArrowsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 8H13M16 8l-3-2.5M16 8l-3 2.5" />
      <path d="M20 16H11M11 16l3-2.5M11 16l3 2.5" />
    </svg>
  );
}
