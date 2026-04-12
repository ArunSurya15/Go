import { cn } from "@/lib/utils";

const BAR_THICKNESSES = [
  0.22, 0.38, 0.18, 0.45, 0.26, 0.5, 0.2, 0.42, 0.32, 0.48, 0.24, 0.36, 0.2, 0.44, 0.28, 0.4, 0.22, 0.46, 0.3, 0.38, 0.24, 0.42, 0.2, 0.48, 0.34, 0.4, 0.26, 0.36,
];

function buildStubLines(): [number, number][] {
  const gap = 0.065;
  let y = 5.28;
  return BAR_THICKNESSES.map((th) => {
    const row: [number, number] = [y, th];
    y += th + gap;
    return row;
  });
}

/** Front-facing bus — larger symbol; taller lower fascia for headlight zone. */
function FrontBusMini() {
  const cutout = "fill-slate-50 dark:fill-slate-900/75";
  return (
    <g className="text-indigo-700 dark:text-indigo-300">
      {/* Corner wheels */}
      <rect x="4.38" y="17" width="1.38" height="1.52" rx="0.55" ry="0.55" fill="currentColor" />
      <rect x="13.24" y="17" width="1.38" height="1.52" rx="0.55" ry="0.55" fill="currentColor" />
      {/* Body: more width + extra height below windshield for lamp panel */}
      <path
        fill="currentColor"
        d="M4.5 17.35V7.45Q4.5 6.2 5.95 6.2h7.6Q15 6.2 15 7.45v9.9H4.5z"
      />
      <g className={cutout}>
        <rect x="8.55" y="6.72" width="2.65" height="0.65" rx="0.2" />
        {/* Shorter windshield → larger solid fascia under it */}
        <rect x="5.95" y="8.85" width="7.6" height="2.35" rx="0.52" />
        <circle cx="6.75" cy="15.65" r="0.82" />
        <circle cx="13.75" cy="15.65" r="0.82" />
      </g>
    </g>
  );
}

/**
 * Classic ticket + stub barcode; simple front-facing bus (no side profile).
 */
export function TicketBusIcon({ className }: { className?: string }) {
  const barcodeLines = buildStubLines();
  const x0 = 17.74;
  const lineW = 3.52;

  return (
    <svg
      className={cn("shrink-0 text-indigo-600 dark:text-indigo-400", className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="
          M3 4.5 H21.5 V10.5
          Q20 12 21.5 13.5
          V19.5 H3 V13.5
          Q4.5 12 3 10.5
          Z
        "
        className="fill-slate-50 stroke-current dark:fill-slate-900/75"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />

      <line
        x1="17.5"
        y1="5.2"
        x2="17.5"
        y2="18.8"
        className="stroke-current opacity-30"
        strokeWidth="0.8"
        strokeDasharray="1.1 1.2"
        strokeLinecap="round"
      />

      <g className="fill-slate-500 dark:fill-slate-400">
        {barcodeLines.map(([y, th], i) => (
          <rect key={i} x={x0} y={y} width={lineW} height={th} rx="0.06" />
        ))}
      </g>

      <g transform="translate(0.05, 0.2)">
        <g transform="translate(9.55, 12.75) scale(1.14) translate(-9.55, -12.75)">
          <FrontBusMini />
        </g>
      </g>
    </svg>
  );
}
