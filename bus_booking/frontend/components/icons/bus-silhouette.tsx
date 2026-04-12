import { cn } from "@/lib/utils";

/**
 * Front-facing bus for the ticket strip — shorter windshield, taller fascia
 * (headlight zone); cutouts match strip background.
 */
export function BusSilhouette({ className }: { className?: string }) {
  return (
    <svg
      className={cn("text-indigo-700 dark:text-indigo-300", className)}
      viewBox="0 0 56 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <g transform="translate(0, 2)">
        {/* Tires: pill shape so the bottom reads rounded */}
        <rect x="14" y="45.5" width="4" height="5.5" rx="2" ry="2" fill="currentColor" />
        <rect x="38" y="45.5" width="4" height="5.5" rx="2" ry="2" fill="currentColor" />
        <path
          fill="currentColor"
          d="M14 44V18Q14 12 20 12h16Q42 12 42 18V44H14z"
        />
        <g className="fill-slate-100 dark:fill-slate-800">
          <rect x="23" y="15" width="10" height="3.2" rx="1" />
          {/* Shorter windshield → more solid body below for lamps */}
          <rect x="17" y="20.5" width="22" height="8.2" rx="1.8" />
          <circle cx="20" cy="39.5" r="2.55" />
          <circle cx="36" cy="39.5" r="2.55" />
        </g>
      </g>
    </svg>
  );
}
