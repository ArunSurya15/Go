"use client";

import React, { useMemo } from "react";

type SeatLayoutProps = {
  layout: { rows: number; cols: number; labels: string[]; types?: string[] };
  occupied: string[];
  occupiedDetails?: { label: string; gender?: "M" | "F" | string }[];
  fare: string;
  selected: string[];
  onSelect: (seat: string) => void;
};

type CellType = "seater" | "sleeper" | "semi_sleeper" | "aisle" | "";
type CellInfo = { label: string; type: CellType };

/**
 * Seater (person sitting with belt) — closer to the reference silhouette.
 * - Black part uses currentColor
 * - Belt uses white (so it pops on green/blue/pink states)
 */
export const SeaterBeltIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 128 128"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* ====== SOLID SILHOUETTE (currentColor) ====== */}
    <g fill="currentColor">
      {/* Head */}
      <circle cx="86" cy="30" r="16" />

      {/* Seat back (tall rounded) */}
      <rect x="20" y="10" width="22" height="64" rx="10" />

      {/* Backrest top pad (small vertical block) */}
      <rect x="20" y="6" width="22" height="18" rx="9" />

      {/* Torso (leaning into seat) */}
      <path d="
        M56 46
        C60 34, 74 28, 86 34
        C96 39, 100 52, 94 62
        C90 69, 82 72, 74 70
        C66 68, 60 62, 56 54
        C54 50, 54 48, 56 46
        Z" />

      {/* Arm (single curved arm down to lap) */}
      <path d="
        M90 58
        C98 64, 102 74, 98 84
        C95 92, 86 96, 78 92
        C71 88, 67 80, 70 72
        C73 64, 82 56, 90 58
        Z" />

      {/* Seat base */}
      <path d="
        M36 74
        H86
        C100 74, 112 86, 112 100
        V104
        H54
        C44 104, 36 96, 36 86
        Z" />

      {/* Leg (vertical rounded) */}
      <path d="
        M92 86
        H112
        V122
        C112 126, 109 128, 104 128
        H100
        C95 128, 92 126, 92 122
        Z" />

      {/* Bottom base/shadow bar */}
      <rect x="30" y="108" width="76" height="10" rx="5" />
    </g>

    {/* ====== SEATBELT (white) ====== */}
    <g
      fill="none"
      stroke="#fff"
      strokeWidth="7"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.95"
    >
      {/* diagonal belt */}
      <path d="M50 62 L84 94" />
      {/* lap belt */}
      <path d="M46 96 L92 70" />
    </g>

    {/* buckle dot */}
    <circle cx="70" cy="84" r="5" fill="#fff" opacity="0.98" />
  </svg>
);

/** Seater: chair outline only — backrest + U-shaped armrests; no enclosing rectangle. */
/** Seater: rounded chair outline + inner U-seat (matches screenshot) */
export const FancySeatIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 64 64"
    aria-hidden="true"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Backrest */}
    <rect x="14" y="6" width="36" height="34" rx="12" fill="currentColor" />

    {/* Top highlight panel */}
    <rect x="26" y="6" width="12" height="18" rx="2" fill="#E6EEF5" />

    {/* Arms (shadow behind + light arms) */}
    <rect x="7.5" y="26" width="12.5" height="12" rx="6" fill="currentColor" opacity="0.18" />
    <rect x="44" y="26" width="12.5" height="12" rx="6" fill="currentColor" opacity="0.18" />
    <rect x="9" y="24" width="12.5" height="12" rx="6" fill="currentColor" opacity="0.28" />
    <rect x="42.5" y="24" width="12.5" height="12" rx="6" fill="currentColor" opacity="0.28" />

    {/* Seat cushion (lighter) */}
    <rect x="16" y="34" width="32" height="10" rx="4" fill="currentColor" opacity="0.72" />

    {/* Seat base (darker) */}
    <rect x="14" y="40" width="36" height="14" rx="4" fill="currentColor" opacity="0.9" />

    {/* Legs (darkest) */}
    <rect x="18" y="50" width="9" height="14" rx="4.5" fill="currentColor" opacity="0.55" />
    <rect x="37" y="50" width="9" height="14" rx="4.5" fill="currentColor" opacity="0.55" />
  </svg>
);

const SeaterIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Outer chair: backrest + armrests + base */}
    <path d="M8.5 6.5A2.5 2.5 0 0 1 11 4h2a2.5 2.5 0 0 1 2.5 2.5V10c0 1.1-.9 2-2 2H8.5Z" />
    <path d="M7 11v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-6" />

    {/* Inner seat: U shape */}
    <path d="M9 12.2v2.8a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.8" />
  </svg>
);
/** Sleeper: tall rounded berth + filled rounded bar at bottom (matches screenshot) */
const SleeperIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="6" y="3.5" width="12" height="17" rx="2.6" />
    {/* Bottom cushion bar (filled, no stroke) */}
    <rect x="7.6" y="15.8" width="8.8" height="2.8" rx="1.4" fill="currentColor" opacity="0.18" stroke="none" />
  </svg>
);

/** Splits layout into lower and upper deck by row (first half = lower). */
function splitDecks(
  rows: number,
  cols: number,
  labels: string[],
  types?: string[]
): { lower: CellInfo[][]; upper: CellInfo[][] } {
  const half = Math.ceil(rows / 2);
  const lower: CellInfo[][] = [];
  const upper: CellInfo[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowCells: CellInfo[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const label = labels[idx] ?? "";
      const type = (types?.[idx] as CellType) ?? (label ? "seater" : "aisle");
      rowCells.push({ label, type });
    }
    if (r < half) lower.push(rowCells);
    else upper.push(rowCells);
  }
  return { lower, upper };
}

// Row height per deck (px). Set equal for same-length decks; set different to adjust lower vs upper berth height.
const LOWER_DECK_ROW_PX = 70;
const UPPER_DECK_ROW_PX = 70;

/** Renders seats in vertical columns (each column = seats stacked top to bottom). */
function DeckGrid({
  rows,
  occupiedSet,
  genderMap,
  fare,
  selectedSet,
  onSelect,
  steeringInTopRight,
  deckType = "lower",
}: {
  rows: CellInfo[][];
  occupiedSet: Set<string>;
  genderMap: Map<string, string>;
  fare: string;
  selectedSet: Set<string>;
  onSelect: (seat: string) => void;
  steeringInTopRight?: boolean;
  deckType?: "lower" | "upper";
}) {
  const cols = rows[0]?.length ?? 0;
  const numRows = rows.length;
  if (cols === 0 || numRows === 0) return null;
  const fareInt = Math.round(Number(fare)) || 0;
  const colWidthPx = 28;
  const aisleWidthPx = 20;
  const colWidths = rows[0].map((cell) => (cell?.label ? colWidthPx : aisleWidthPx));
  const uniformRowPx = deckType === "upper" ? UPPER_DECK_ROW_PX : LOWER_DECK_ROW_PX;
  const steeringRowPx = 48;
  const rowTemplate = steeringInTopRight
    ? `${steeringRowPx}px repeat(${numRows}, ${uniformRowPx}px)`
    : `repeat(${numRows}, ${uniformRowPx}px)`;
  return (
    <div
      className="grid gap-0.5 w-fit"
      style={{
        gridTemplateColumns: colWidths.map((w) => `${w}px`).join(" "),
        gridTemplateRows: rowTemplate,
        gridAutoFlow: "column",
      }}
    >
      {Array.from({ length: cols }, (_, c) => {
        const cells: React.ReactNode[] = [];
        const colW = colWidths[c] ?? colWidthPx;
        if (steeringInTopRight) {
          if (c < cols - 1) {
            cells.push(<div key={`empty-${c}`} style={{ minWidth: colW }} />);
          } else {
            cells.push(
              <div
                key="steering"
                className="flex items-center justify-center pb-2 text-gray-400"
                style={{ minWidth: colW }}
                title="Bus direction (front)"
              >
                <SteeringWheelIcon className="h-[3.25rem] w-[3.25rem]" />
              </div>
            );
          }
        }
        for (let r = 0; r < numRows; r++) {
          const cell = rows[r]?.[c];
          if (cell && !cell.label) {
            cells.push(
              <div key={`aisle-${c}-${r}`} style={{ minHeight: uniformRowPx, minWidth: colW }} aria-hidden />
            );
          } else if (cell?.label) {
            const label = cell.label;
            const type = cell.type ?? "seater";
            const isOccupied = occupiedSet.has(label);
            const isSelected = selectedSet.has(label);
            const isAvailable = !isOccupied;
            const canClick = isAvailable || isSelected;
            const gender = genderMap.get(label);

            // Palette by type/gender/state
            const palette = (() => {
              if (type === "sleeper") {
                if (isOccupied) {
                  if (gender === "F") return { border: "border-pink-300", fill: "bg-pink-50", icon: "text-pink-500" };
                  if (gender === "M") return { border: "border-blue-300", fill: "bg-blue-50", icon: "text-blue-500" };
                  return { border: "border-gray-300", fill: "bg-gray-50", icon: "text-gray-400" };
                }
                if (isSelected) return { border: "border-emerald-600", fill: "bg-emerald-100", icon: "text-emerald-800" };
                return { border: "border-emerald-500", fill: "bg-white", icon: "text-emerald-600" };
              }
              // seater / semi
              if (isOccupied) {
                if (gender === "F") return { border: "border-pink-300", fill: "bg-pink-50", icon: "text-pink-500" };
                if (gender === "M") return { border: "border-blue-300", fill: "bg-blue-50", icon: "text-blue-500" };
                return { border: "border-gray-300", fill: "bg-gray-50", icon: "text-gray-400" };
              }
              if (isSelected) return { border: "border-emerald-600", fill: "bg-emerald-100", icon: "text-emerald-800" };
              return { border: "border-emerald-500", fill: "bg-white", icon: "text-emerald-600" };
            })();

            const isSleeper = type === "sleeper";

            cells.push(
              <button
                key={label}
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onSelect(label)}
                className={`
                  relative flex flex-col items-center justify-center w-full min-w-0
                  transition-colors text-xs font-medium
                  ${isOccupied ? "text-gray-500 cursor-not-allowed" : "text-emerald-800"}
                `}
                style={{ minHeight: uniformRowPx }}
              >
                <div className={`flex items-center justify-center shrink-0 ${palette.icon}`}>
                  {isSleeper ? (
                    <SleeperIcon className="h-15 w-12" />
                  ) : (
                    <FancySeatIcon className="h-8 w-8" />
                  )}
                </div>
                {isOccupied && <span className="text-[10px] mt-0.5 text-gray-500">Sold</span>}
                {isAvailable && <span className="text-[10px] mt-0.5">₹{fareInt}</span>}
              </button>
            );
          }
        }
        return cells;
      }).flat()}
    </div>
  );
}

export function SeatLayout({ layout, occupied, occupiedDetails, fare, selected, onSelect }: SeatLayoutProps) {
  const occupiedSet = useMemo(() => new Set(occupied), [occupied]);
  const genderMap = useMemo(() => {
    const m = new Map<string, string>();
    occupiedDetails?.forEach((o) => {
      if (o.label) {
        m.set(o.label, (o.gender || "").toString().toUpperCase());
      }
    });
    return m;
  }, [occupiedDetails]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const { lower, upper } = useMemo(
    () => splitDecks(layout.rows, layout.cols, layout.labels, layout.types),
    [layout.rows, layout.cols, layout.labels, layout.types]
  );

  const handleSelect = (seat: string) => onSelect(seat);

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto">
      {/* Know your seat types */}
      <SeatTypesLegend />

      {/* Lower and Upper deck side by side — same width and row alignment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-fit max-w-full place-items-start">
        <div className="border rounded-lg p-3 pt-2 pb-2 bg-muted/20 w-full min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2 min-h-[3.25rem]">
            <p className="text-xs font-semibold text-muted-foreground">Lower deck</p>
            <SteeringWheelIcon className="h-[3.25rem] w-[3.25rem] shrink-0 text-gray-400" />
          </div>
          <div className="mt-2 w-fit">
            <DeckGrid
              rows={lower}
              occupiedSet={occupiedSet}
              genderMap={genderMap}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={handleSelect}
              deckType="lower"
            />
          </div>
        </div>
        <div className="border rounded-lg p-3 pt-2 pb-2 bg-muted/20 w-full min-w-0">
          <p className="text-xs font-semibold text-muted-foreground mb-2 min-h-[3.25rem] flex items-start">Upper deck</p>
          <div className="mt-2 w-fit">
            <DeckGrid
              rows={upper}
              occupiedSet={occupiedSet}
              genderMap={genderMap}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={handleSelect}
              deckType="upper"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Legend: symbols + availability states (no labels on individual seats). */
function SeatTypesLegend() {
  const row = (label: string, node: React.ReactNode) => (
    <div key={label} className="flex items-center gap-2 py-1">
      {node}
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
  return (
    <div className="w-full mb-4 p-3 rounded-lg bg-muted/30 border">
      <p className="text-sm font-semibold text-foreground mb-2">Seat symbols &amp; status</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
        <div className="space-y-0">
          {row("Seater (chair)", <span className="text-emerald-600"><FancySeatIcon className="h-5 w-6 inline-block" /></span>)}
          {row("Sleeper (berth)", <span className="text-emerald-600"><SleeperIcon className="h-6 w-4 inline-block" /></span>)}
          {row("Available", <span className="inline-block rounded border-2 border-green-500 bg-white min-w-[28px] min-h-[24px] shrink-0" />)}
          {row("Selected", <span className="inline-block rounded border-2 border-green-600 bg-green-500 min-w-[28px] min-h-[24px] shrink-0" />)}
          {row("Sold", <span className="inline-block rounded border-2 border-gray-300 bg-gray-100 min-w-[28px] min-h-[24px] shrink-0" />)}
        </div>
        <div className="space-y-0">
          {row("Booked (female)", <span className="inline-block rounded border-2 border-pink-200 bg-pink-50 min-w-[28px] min-h-[24px] shrink-0" />)}
          {row("Booked (male)", <span className="inline-block rounded border-2 border-blue-200 bg-blue-50 min-w-[28px] min-h-[24px] shrink-0" />)}
        </div>
      </div>
    </div>
  );
}

/** Steering wheel icon: solid disc with 3 curved cut-outs + center hub hole */
function SteeringWheelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* White = visible, Black = punched out */}
        <mask id="steeringMask">
          <rect width="32" height="32" fill="white" />

          {/* Center hub hole */}
          <circle cx="16" cy="18" r="2" fill="black" />

          {/* Top window (curved cap cut-out) */}
          <path
            fill="black"
            d="
              M 8.0 13.0
              Q 16.0 3.5 24.0 13.0
              Q 21.2 15.2 16.0 13
              Q 10.8 15.2 8.0 13.0
              Z
            "
          />

          {/* Bottom-left window */}
          <path
            fill="black"
            d="
              M 7.8 18.2
              Q 8.6 24.8 14.2 24.6
              Q 13.2 20.4 10.8 18.0
              Q 9.2 16.4 7.8 18.2
              Z
            "
          />

          {/* Bottom-right window (mirror of bottom-left) */}
          <path
            fill="black"
            d="
              M 24.2 18.2
              Q 23.4 24.8 17.8 24.6
              Q 18.8 20.4 21.2 18.0
              Q 22.8 16.4 24.2 18.2
              Z
            "
          />
        </mask>
      </defs>

      {/* Solid disc; mask punches the 3 windows + hub. Rim ~25% thinner than previous. */}
      <circle cx="16" cy="16" r="11.7" fill="currentColor" mask="url(#steeringMask)" />
    </svg>
  );
}

