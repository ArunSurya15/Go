"use client";

import React, { useMemo } from "react";

type SeatLayoutProps = {
  layout: { rows: number; cols: number; labels: string[] };
  occupied: string[];
  fare: string;
  selected: string[];
  onSelect: (seat: string) => void;
};

/** Splits layout into lower and upper deck by row (first half = lower). */
function splitDecks(
  rows: number,
  cols: number,
  labels: string[]
): { lower: string[][]; upper: string[][] } {
  const half = Math.ceil(rows / 2);
  const lower: string[][] = [];
  const upper: string[][] = [];
  for (let r = 0; r < rows; r++) {
    const rowLabels: string[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      rowLabels.push(labels[idx] ?? "");
    }
    if (r < half) lower.push(rowLabels);
    else upper.push(rowLabels);
  }
  return { lower, upper };
}

/** Renders seats in vertical columns (each column = seats stacked top to bottom). */
function DeckGrid({
  rows,
  occupiedSet,
  fare,
  selectedSet,
  onSelect,
  steeringInTopRight,
}: {
  rows: string[][];
  occupiedSet: Set<string>;
  fare: string;
  selectedSet: Set<string>;
  onSelect: (seat: string) => void;
  steeringInTopRight?: boolean;
}) {
  const cols = rows[0]?.length ?? 0;
  const numRows = rows.length;
  if (cols === 0 || numRows === 0) return null;
  // Column-major order: first row can be steering (last col) + empties; then seat cells
  const fareInt = Math.round(Number(fare)) || 0;
  const rowMinPx = 74;
  const colWidthPx = 48; // fixed so lower and upper deck match
  const totalRows = steeringInTopRight ? numRows + 1 : numRows;
  const rowTemplate = steeringInTopRight
    ? `68px repeat(${numRows}, minmax(${rowMinPx}px, auto))`
    : `repeat(${numRows}, minmax(${rowMinPx}px, auto))`;
  return (
    <div
      className="grid gap-1.5 w-fit"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${colWidthPx}px)`,
        gridTemplateRows: rowTemplate,
        gridAutoFlow: "column",
      }}
    >
      {Array.from({ length: cols }, (_, c) => {
        const cells: React.ReactNode[] = [];
        if (steeringInTopRight) {
          if (c < cols - 1) {
            cells.push(<div key={`empty-${c}`} style={{ minWidth: colWidthPx }} />);
          } else {
            cells.push(
              <div
                key="steering"
                className="flex items-center justify-center pb-2 text-gray-400"
                style={{ minWidth: colWidthPx }}
                title="Bus direction (front)"
              >
                <SteeringWheelIcon className="h-[3.25rem] w-[3.25rem]" />
              </div>
            );
          }
        }
        for (let r = 0; r < numRows; r++) {
          const label = rows[r]?.[c];
          if (label) {
            const isOccupied = occupiedSet.has(label);
            const isSelected = selectedSet.has(label);
            const isAvailable = !isOccupied;
            const canClick = isAvailable || isSelected;
            cells.push(
              <button
                key={label}
                type="button"
                disabled={!canClick}
                onClick={() => canClick && onSelect(label)}
                className={`
                  relative flex flex-col items-center justify-center rounded-lg border-2 min-h-[74px] w-full min-w-0
                  transition-colors text-xs font-medium
                  ${isOccupied
                    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : isSelected
                      ? "border-green-600 bg-green-500 text-white cursor-pointer hover:bg-green-600"
                      : "border-green-500 bg-white text-green-700 cursor-pointer hover:bg-green-50"
                  }
                `}
              >
                <span>{label}</span>
                {isOccupied && <span className="text-[10px] mt-0.5">Sold</span>}
                {isAvailable && !isSelected && <span className="text-[10px] mt-0.5">₹{fareInt}</span>}
              </button>
            );
          }
        }
        return cells;
      }).flat()}
    </div>
  );
}

export function SeatLayout({ layout, occupied, fare, selected, onSelect }: SeatLayoutProps) {
  const occupiedSet = useMemo(() => new Set(occupied), [occupied]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const { lower, upper } = useMemo(
    () => splitDecks(layout.rows, layout.cols, layout.labels),
    [layout.rows, layout.cols, layout.labels]
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
            <SteeringWheelIcon className="h-[3.25rem] w-[3.25rem] shrink-0 text-gray-400" title="Bus direction (front)" />
          </div>
          <div className="mt-2 w-fit">
            <DeckGrid
              rows={lower}
              occupiedSet={occupiedSet}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={handleSelect}
            />
          </div>
        </div>
        <div className="border rounded-lg p-3 pt-2 pb-2 bg-muted/20 w-full min-w-0">
          <p className="text-xs font-semibold text-muted-foreground mb-2 min-h-[3.25rem] flex items-start">Upper deck</p>
          <div className="mt-2 w-fit">
            <DeckGrid
              rows={upper}
              occupiedSet={occupiedSet}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={handleSelect}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Legend: Know your seat types (Available, Selected, Sold, male/female variants). */
function SeatTypesLegend() {
  const row = (label: string, seatClass: string) => (
    <div key={label} className="flex items-center gap-2 py-1">
      <span className={`inline-block rounded border-2 min-w-[28px] min-h-[24px] shrink-0 ${seatClass}`} />
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
  return (
    <div className="w-full mb-4 p-3 rounded-lg bg-muted/30 border">
      <p className="text-sm font-semibold text-foreground mb-2">Know your seat types</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0">
        <div className="space-y-0">
          {row("Available", "border-green-500 bg-white")}
          {row("Selected by you", "border-green-600 bg-green-500")}
          {row("Already booked", "border-gray-300 bg-gray-100")}
        </div>
        <div className="space-y-0">
          {row("Available only for female", "border-pink-400 bg-white")}
          {row("Available only for male", "border-blue-400 bg-white")}
          {row("Booked by female", "border-pink-200 bg-pink-50/50")}
          {row("Booked by male", "border-blue-200 bg-blue-50/50")}
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
              Q 16.0 6.2 24.0 13.0
              Q 21.2 15.2 16.0 15.2
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

