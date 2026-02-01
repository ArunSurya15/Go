"use client";

import { useMemo } from "react";

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

function DeckGrid({
  rows,
  occupiedSet,
  fare,
  selectedSet,
  onSelect,
}: {
  rows: string[][];
  occupiedSet: Set<string>;
  fare: string;
  selectedSet: Set<string>;
  onSelect: (seat: string) => void;
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${rows[0]?.length ?? 2}, minmax(0, 1fr))` }}>
      {rows.map((row, ri) =>
        row.map((label, ci) => {
          if (!label) return null;
          const isOccupied = occupiedSet.has(label);
          const isSelected = selectedSet.has(label);
          const isAvailable = !isOccupied;
          const canClick = isAvailable || isSelected;
          return (
            <button
              key={label}
              type="button"
              disabled={!canClick}
              onClick={() => canClick && onSelect(label)}
              className={`
                relative flex flex-col items-center justify-center rounded-lg border-2 min-h-[52px] min-w-[44px]
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
              {isAvailable && !isSelected && <span className="text-[10px] mt-0.5">₹{fare}</span>}
            </button>
          );
        })
      )}
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

  const handleSelect = (seat: string) => {
    if (selectedSet.has(seat)) {
      onSelect(seat);
    } else {
      onSelect(seat);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1">
          <span className="inline-block w-4 h-4 rounded border-2 border-gray-300 bg-gray-100" /> Front
        </h3>
        <div className="flex justify-end mb-1">
          <span className="text-[10px] text-muted-foreground" title="Driver">⌙</span>
        </div>
        <div className="border rounded-lg p-3 bg-muted/20">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Lower deck</p>
          <DeckGrid
            rows={lower}
            occupiedSet={occupiedSet}
            fare={fare}
            selectedSet={selectedSet}
            onSelect={handleSelect}
          />
        </div>
      </div>
      <div className="border rounded-lg p-3 bg-muted/20">
        <p className="text-xs font-semibold text-muted-foreground mb-2">Upper deck</p>
        <DeckGrid
          rows={upper}
          occupiedSet={occupiedSet}
          fare={fare}
          selectedSet={selectedSet}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
