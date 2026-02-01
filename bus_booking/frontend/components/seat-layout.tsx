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
  const totalRows = steeringInTopRight ? numRows + 1 : numRows;
  const rowTemplate = steeringInTopRight
    ? `52px repeat(${numRows}, minmax(${rowMinPx}px, auto))`
    : `repeat(${numRows}, minmax(${rowMinPx}px, auto))`;
  return (
    <div
      className="grid gap-1.5 w-fit"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(44px, 1fr))`,
        gridTemplateRows: rowTemplate,
        gridAutoFlow: "column",
      }}
    >
      {Array.from({ length: cols }, (_, c) => {
        const cells: React.ReactNode[] = [];
        if (steeringInTopRight) {
          if (c < cols - 1) {
            cells.push(<div key={`empty-${c}`} className="min-w-[44px]" />);
          } else {
            cells.push(
              <div
                key="steering"
                className="flex min-w-[44px] items-center justify-center text-muted-foreground"
                title="Bus direction (front)"
              >
                <SteeringWheelIcon className="w-10 h-10" />
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
                  relative flex flex-col items-center justify-center rounded-lg border-2 min-h-[74px] min-w-[44px]
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

      {/* Lower and Upper deck side by side — boxes fit seat grid width */}
      <div className="flex flex-wrap justify-center gap-4 w-fit max-w-full">
        <div className="border rounded-lg p-3 pt-2 pb-2 bg-muted/20 w-fit">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Lower deck</p>
          <div className="mt-2 w-fit">
            <DeckGrid
              rows={lower}
              occupiedSet={occupiedSet}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={handleSelect}
              steeringInTopRight
            />
          </div>
        </div>
        <div className="border rounded-lg p-3 pt-2 pb-2 bg-muted/20 w-fit">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Upper deck</p>
          <div className="mt-2" style={{ paddingTop: "52px" }}>
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

/** Steering wheel icon: solid rim, thick spokes (one top, two angled bottom), small white central hub. */
function SteeringWheelIcon({ className }: { className?: string }) {
  const cx = 16;
  const cy = 16;
  const rimOuter = 13;
  const rimInner = 8;
  const hubRadius = 3; // small hub so spokes are visible
  const spokeWidth = 4;
  const spokeLength = rimOuter - hubRadius; // spoke from rim to just outside hub
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      fillRule="evenodd"
      aria-hidden
    >
      {/* Thick solid rim (ring): outer circle then inner circle for evenodd hole */}
      <path
        d={`M ${cx + rimOuter} ${cy} A ${rimOuter} ${rimOuter} 0 1 1 ${cx - rimOuter} ${cy} A ${rimOuter} ${rimOuter} 0 1 1 ${cx + rimOuter} ${cy} Z M ${cx + rimInner} ${cy} A ${rimInner} ${rimInner} 0 1 1 ${cx - rimInner} ${cy} A ${rimInner} ${rimInner} 0 1 1 ${cx + rimInner} ${cy} Z`}
      />
      {/* Top spoke (thick, from rim down to hub) */}
      <rect
        x={cx - spokeWidth / 2}
        y={cy - rimOuter}
        width={spokeWidth}
        height={spokeLength}
        rx={spokeWidth / 2}
      />
      {/* Bottom-left spoke (~8 o'clock) */}
      <rect
        x={cx - spokeWidth / 2}
        y={cy}
        width={spokeWidth}
        height={spokeLength}
        rx={spokeWidth / 2}
        transform={`rotate(120 ${cx} ${cy})`}
      />
      {/* Bottom-right spoke (~4 o'clock) */}
      <rect
        x={cx - spokeWidth / 2}
        y={cy}
        width={spokeWidth}
        height={spokeLength}
        rx={spokeWidth / 2}
        transform={`rotate(240 ${cx} ${cy})`}
      />
      {/* Small white central hub (on top so spokes sit behind it) */}
      <circle cx={cx} cy={cy} r={hubRadius} fill="white" fillRule="nonzero" />
    </svg>
  );
}
