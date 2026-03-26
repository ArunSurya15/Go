"use client";

import React, { useMemo } from "react";

type SeatLayoutProps = {
  layout: { rows: number; cols: number; labels: string[]; types?: string[] };
  occupied: string[];
  occupiedDetails?: { label: string; gender?: "M" | "F" | string }[];
  fare: string;
  selected: string[];
  onSelect: (seat: string) => void;
  /** Called when user selects (clicks to add) an available female-only seat */
  onFemaleOnlySeatClick?: (seat: string) => void;
};

/**
 * Available seats horizontally adjacent to an occupied female must be booked by females only.
 */
export function computeFemaleOnlySeatLabels(
  layout: { rows: number; cols: number; labels: string[] },
  occupied: Set<string>,
  genderMap: Map<string, string>
): Set<string> {
  const { rows, cols, labels } = layout;
  const out = new Set<string>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const label = labels[idx] ?? "";
      if (!label || !String(label).trim()) continue;
      if (occupied.has(label)) continue;
      for (const dc of [-1, 1] as const) {
        const nc = c + dc;
        if (nc < 0 || nc >= cols) continue;
        const nlabel = labels[r * cols + nc] ?? "";
        if (!nlabel || !String(nlabel).trim()) continue;
        if (occupied.has(nlabel) && genderMap.get(nlabel) === "F") {
          out.add(label);
          break;
        }
      }
    }
  }
  return out;
}

type CellType = "seater" | "sleeper" | "semi_sleeper" | "aisle" | "";
/** Alias for operator UI and templates */
export type SeatCellType = CellType;
type CellInfo = { label: string; type: CellType };

// ============================================================================
// CONFIGURABLE SPACING VARIABLES
// ============================================================================

const SPACING_CONFIG = {
  // Seat icon dimensions
  SEATER_ICON_PX: 36,
  SLEEPER_ICON_HEIGHT_PX: 60,  // Increased from 108 to make it taller
  SLEEPER_ICON_ASPECT: 12 / 22, // New viewBox ratio: width 12 / height 22 (includes 1px padding)
  
  // Icon stroke widths (slightly thicker so outlines are visible at small sizes)
  SEATER_STROKE_WIDTH: 1,    // Stroke width for seater icon (set to 0 for no stroke)
  SLEEPER_STROKE_WIDTH: 0.5,   // Stroke width for sleeper icon (set to 0 for no stroke)
  
  // Spacing around seats (padding inside each seat cell)
  SEAT_HORIZONTAL_PADDING: 2,   // Minimal left/right padding (set to 0 for no padding)
  SEAT_VERTICAL_PADDING: 0,     // Minimal top/bottom padding (set to 0 for no padding)
  
  // Gap between seat icon and price
  ICON_TO_PRICE_GAP: 2,         // Small gap between seat and price (set to 0 for no gap)
  
  // Grid gaps (spacing between grid cells)
  ROW_GAP: 8,                   // Vertical space between rows (set to 0 for no gap)
  COLUMN_GAP: 6,                // Horizontal space between columns (set to 0 for no gap)
  AISLE_WIDTH: 16,              // Width of aisle columns
  
  // Top spacer row height (0 = no spacer; seat rows align via equal header height only)
  STEERING_ROW_HEIGHT: 0,
  
  // Deck container spacing
  DECK_PADDING: 12,
  DECK_GAP: 16,                 // Gap between lower and upper deck
};

/**
 * Seater Top View Icon - compact chair outline
 */
export const SeaterTopViewIcon = ({
  className,
  style,
  fillOpacity = 0,
  strokeOpacity = 1,
  strokeWidth = 0.5,
}: {
  className?: string;
  style?: React.CSSProperties;
  fillOpacity?: number;
  strokeOpacity?: number;
  strokeWidth?: number;
}) => {
  // Paths with 1px padding to prevent stroke clipping
  const outer = `
    M1 13
    A2 2 0 0 1 5 13
    L5 18
    A1 1 0 0 0 6 19
    L16 19
    A1 1 0 0 0 17 18
    L17 13
    A2 2 0 0 1 21 13
    L21 22
    A1 1 0 0 1 20 23
    L2 23
    A1 1 0 0 1 1 22
    Z
  `;

  const top = `
    M3 11
    A2 2 0 0 1 5 13
    L5 18
    A1 1 0 0 0 6 19
    L16 19
    A1 1 0 0 0 17 18
    L17 13
    A2 2 0 0 1 19 11
    L19 7
    A2 2 0 0 0 17 5
    L5 5
    A2 2 0 0 0 3 7
    Z
  `;

  return (
    <svg
      className={className}
      style={style}
      viewBox="0 0 22 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {fillOpacity > 0 && (
        <g fill="currentColor" opacity={fillOpacity}>
          <path d={outer} />
          <path d={top} />
        </g>
      )}
      <g
        fill="none"
        stroke="currentColor"
        opacity={strokeOpacity}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={outer} />
        <path d={top} />
      </g>
    </svg>
  );
};

/**
 * Sleeper Icon - tall rounded berth
 */
const SleeperIcon = ({
  className,
  style,
  strokeWidth = 0.1,
  fillOpacity = 0,
}: {
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
  fillOpacity?: number;
}) => (
  <svg
    className={className}
    style={style}
    viewBox="0 0 12 22"
    xmlns="http://www.w3.org/2000/svg"
  >
    {fillOpacity > 0 && (
      <g fill="currentColor" opacity={fillOpacity}>
        <rect x="1" y="1" width="10" height="20" rx="2" />
      </g>
    )}
    <rect 
      x="1" 
      y="1" 
      width="10" 
      height="20" 
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="2.2"
      y="15.5"
      width="7.6"
      height="2.8"
      rx="1.4"
      fill="currentColor"
      opacity="0.18"
      stroke="none"
    />
  </svg>
);

/**
 * Steering Wheel Icon
 */
function SteeringWheelIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id="steeringMask">
          <rect width="32" height="32" fill="white" />
          <circle cx="16" cy="18" r="2" fill="black" />
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
      <circle cx="16" cy="16" r="11.7" fill="currentColor" mask="url(#steeringMask)" />
    </svg>
  );
}

/**
 * Splits layout into lower and upper deck by row
 */
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

/**
 * Renders seats in vertical columns
 */
function DeckGrid({
  rows,
  occupiedSet,
  genderMap,
  fare,
  selectedSet,
  onSelect,
  femaleOnlySet,
  onFemaleOnlySeatClick,
  topSpacerRow,
  deckType = "lower",
}: {
  rows: CellInfo[][];
  occupiedSet: Set<string>;
  genderMap: Map<string, string>;
  fare: string;
  selectedSet: Set<string>;
  onSelect: (seat: string) => void;
  femaleOnlySet: Set<string>;
  onFemaleOnlySeatClick?: (seat: string) => void;
  /** When true, add an empty first row so seat rows align between lower and upper deck */
  topSpacerRow?: boolean;
  deckType?: "lower" | "upper";
}) {
  const cols = rows[0]?.length ?? 0;
  const numRows = rows.length;
  
  if (cols === 0 || numRows === 0) return null;
  
  const spacerHeight = SPACING_CONFIG.STEERING_ROW_HEIGHT;
  const hasTopRow = !!topSpacerRow && spacerHeight > 0;
  
  const fareInt = Math.round(Number(fare)) || 0;
  const isSleeperDeck = rows.every((row) => 
    row.every((c) => !c?.label || (c.type ?? "seater") === "sleeper")
  );
  
  // Calculate dimensions - just the icon size, no extra padding in column width
  const sleeperW = Math.round(
    SPACING_CONFIG.SLEEPER_ICON_HEIGHT_PX * SPACING_CONFIG.SLEEPER_ICON_ASPECT
  );
  
  const seatIconWidth = isSleeperDeck ? sleeperW : SPACING_CONFIG.SEATER_ICON_PX;
  const aisleWidthPx = SPACING_CONFIG.AISLE_WIDTH;
  
  return (
    <div
      className="inline-grid items-start"
      style={{
        gridTemplateColumns: `repeat(${cols}, min-content)`,
        gridTemplateRows: hasTopRow
          ? `${spacerHeight}px repeat(${numRows}, min-content)`
          : `repeat(${numRows}, min-content)`,
        columnGap: `${SPACING_CONFIG.COLUMN_GAP}px`,
        rowGap: `${SPACING_CONFIG.ROW_GAP}px`,
      }}
    >
      {/* First row: empty spacer so lower/upper deck seat rows align */}
      {hasTopRow && Array.from({ length: cols }, (_, c) => (
        <div key={`top-spacer-${c}`} aria-hidden />
      ))}
      
      {rows.map((row, r) =>
        row.map((cell, c) => {
          // Aisle cell
          if (!cell?.label) {
            return (
              <div 
                key={`aisle-${r}-${c}`} 
                style={{ width: aisleWidthPx }} 
                aria-hidden 
              />
            );
          }
          
          // Seat cell
          const label = cell.label;
          const type = cell.type ?? "seater";
          const isOccupied = occupiedSet.has(label);
          const isSelected = selectedSet.has(label);
          const isAvailable = !isOccupied;
          const canClick = isAvailable || isSelected;
          const isFemaleOnly = isAvailable && femaleOnlySet.has(label);
          const femaleOnlyHighlight = isFemaleOnly && !isSelected;
          const gender = genderMap.get(label);
          /** Booked female = pink; booked male or unknown gender (legacy / no passenger JSON) = blue */
          const occupiedFemale = isOccupied && gender === "F";
          const occupiedMaleOrUnknown = isOccupied && !occupiedFemale;
          
          // Color palette
          const palette = (() => {
            if (isOccupied) {
              if (occupiedFemale) return { icon: "text-pink-200", fill: 0.5 };
              return { icon: "text-blue-200", fill: 0.5 };
            }
            if (isSelected) return { icon: "text-green-800", fill: 0.5 };
            if (femaleOnlyHighlight) return { icon: "text-pink-600", fill: 0 };
            return { icon: "text-green-700", fill: 0 };
          })();
          
          const isSleeper = type === "sleeper";

          const seatButton = (
            <button
              type="button"
              disabled={!canClick}
              onClick={() => {
                if (!canClick) return;
                if (isFemaleOnly && !isSelected) {
                  onFemaleOnlySeatClick?.(label);
                }
                onSelect(label);
              }}
              title={isFemaleOnly ? "Female only" : undefined}
              className={`
                flex flex-col items-center justify-start
                transition-colors text-xs font-medium
                w-full h-full
                ${isOccupied ? (occupiedFemale ? "text-pink-300 cursor-not-allowed" : "text-blue-300 cursor-not-allowed") : "text-green-800"}
              `}
              style={{ 
                minWidth: seatIconWidth + SPACING_CONFIG.SEAT_HORIZONTAL_PADDING * 2,
                gap: `${SPACING_CONFIG.ICON_TO_PRICE_GAP}px`,
                padding: `${SPACING_CONFIG.SEAT_VERTICAL_PADDING}px ${SPACING_CONFIG.SEAT_HORIZONTAL_PADDING}px`,
                margin: 0,
                border: 'none',
                background: 'transparent',
              }}
            >
              {/* Seat icon */}
              <div className="flex items-center justify-center shrink-0 leading-[0] [&>*]:block" style={{ display: 'block' }}>
                <div className={palette.icon}>
                  {isSleeper ? (
                    <SleeperIcon
                      className="shrink-0 block"
                      style={{ 
                        width: seatIconWidth, 
                        height: SPACING_CONFIG.SLEEPER_ICON_HEIGHT_PX,
                        display: 'block',
                      }}
                      strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
                      fillOpacity={palette.fill ?? 0}
                    />
                  ) : (
                    <SeaterTopViewIcon
                      className="shrink-0 block"
                      style={{
                        width: seatIconWidth,
                        height: seatIconWidth,
                        display: 'block',
                      }}
                      fillOpacity={palette.fill}
                      strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
                    />
                  )}
                </div>
              </div>
              
              {/* Status/Price label */}
              {isOccupied && (
                <span
                  className={`text-[10px] leading-none block ${occupiedFemale ? "text-pink-400" : "text-blue-400"}`}
                  style={{ margin: 0 }}
                >
                  Sold
                </span>
              )}
              {isAvailable && (
                <span
                  className="text-[10px] leading-none block text-gray-500 dark:text-gray-400"
                  style={{ margin: 0 }}
                >
                  ₹{fareInt}
                </span>
              )}
            </button>
          );

          if (isFemaleOnly) {
            return (
              <div
                key={label}
                className="relative flex flex-col items-center justify-start group"
              >
                {/* Dark popover (hover / keyboard focus) */}
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max min-w-[5.5rem] -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  role="tooltip"
                >
                  <div className="rounded-lg bg-zinc-900 px-3 py-2 text-center text-white shadow-lg dark:bg-zinc-950">
                    <p className="text-sm font-semibold leading-tight tabular-nums">₹{fareInt}</p>
                    <p className="text-[11px] font-medium text-white/95 mt-0.5">Female only</p>
                  </div>
                  <div className="flex justify-center">
                    <div
                      className="h-0 w-0 border-x-[7px] border-x-transparent border-t-[7px] border-t-zinc-900 dark:border-t-zinc-950"
                      aria-hidden
                    />
                  </div>
                </div>
                {seatButton}
              </div>
            );
          }

          return <React.Fragment key={label}>{seatButton}</React.Fragment>;
        })
      )}
    </div>
  );
}

/** Legend icon sizes — shared for type row + Available/Selected pairs */
const LEGEND_SEATER = "h-10 w-10 sm:h-11 sm:w-11";
const LEGEND_SLEEPER = "h-[3.35rem] w-[2.1rem] sm:h-[3.65rem] sm:w-[2.25rem]";

/**
 * Legend showing seat types and statuses
 */
function SeatTypesLegend() {
  const symbolPair = (
    <span className="flex items-end justify-center gap-3 text-inherit">
      <SeaterTopViewIcon
        className={`${LEGEND_SEATER} shrink-0 inline-block`}
        fillOpacity={0}
        strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
      />
      <SleeperIcon
        className={`${LEGEND_SLEEPER} shrink-0 block`}
        strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
        fillOpacity={0}
      />
    </span>
  );

  const symbolPairSelected = (
    <span className="flex items-end justify-center gap-3 text-green-800">
      <SeaterTopViewIcon
        className={`${LEGEND_SEATER} shrink-0 inline-block`}
        fillOpacity={0.5}
        strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
      />
      <SleeperIcon
        className={`${LEGEND_SLEEPER} shrink-0 block`}
        strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
        fillOpacity={0.5}
      />
    </span>
  );

  const row = (rowKey: string, label: React.ReactNode, node: React.ReactNode) => (
    <div key={rowKey} className="flex items-center gap-3 sm:gap-4 py-1.5 min-h-[3.25rem]">
      <span className="flex items-end justify-center shrink-0 min-w-[7.5rem] w-[7.5rem] sm:min-w-[8.25rem] sm:w-[8.25rem]">
        {node}
      </span>
      <span className="text-xs text-muted-foreground leading-snug self-center">{label}</span>
    </div>
  );

  return (
    <div className="w-full mb-4 p-3 rounded-lg bg-muted/30 border">
      <p className="text-sm font-semibold text-foreground mb-3">
        Seat symbols &amp; status
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
        <div className="flex flex-col">
          {/* Seater + Sleeper on one row, aligned */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-2 pb-3 mb-1 border-b border-border/60">
            <div className="flex items-end gap-2.5 min-w-0">
              <span className="text-green-700 flex shrink-0 items-end justify-center w-[2.75rem] sm:w-[3rem]">
                <SeaterTopViewIcon
                  className={`${LEGEND_SEATER} inline-block`}
                  fillOpacity={0}
                  strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
                />
              </span>
              <span className="text-xs text-muted-foreground pb-0.5 leading-snug">
                Seater (chair)
              </span>
            </div>
            <div className="flex items-end gap-2.5 min-w-0">
              <span className="text-green-700 flex shrink-0 items-end justify-center w-[2.25rem] sm:w-[2.35rem]">
                <SleeperIcon
                  className={`${LEGEND_SLEEPER} inline-block`}
                  strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
                  fillOpacity={0}
                />
              </span>
              <span className="text-xs text-muted-foreground pb-0.5 leading-snug">
                Sleeper (berth)
              </span>
            </div>
          </div>

          {row("legend-available", "Available", <span className="text-green-700">{symbolPair}</span>)}
          {row("legend-selected", "Selected", symbolPairSelected)}
        </div>
        <div className="flex flex-col sm:pt-0 pt-2">
          {row(
            "legend-booked-f",
            "Booked (female)",
            <span className="inline-block rounded border-2 border-pink-200 bg-pink-50 min-w-[32px] min-h-[28px] shrink-0" />
          )}
          {row(
            "legend-booked-m",
            "Booked (male)",
            <span className="inline-block rounded border-2 border-blue-200 bg-blue-50 min-w-[32px] min-h-[28px] shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Main SeatLayout Component
 */
export function SeatLayout({
  layout,
  occupied,
  occupiedDetails,
  fare,
  selected,
  onSelect,
  onFemaleOnlySeatClick,
}: SeatLayoutProps) {
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

  const femaleOnlySet = useMemo(
    () => computeFemaleOnlySeatLabels(layout, occupiedSet, genderMap),
    [layout, occupiedSet, genderMap]
  );
  
  const { lower, upper } = useMemo(
    () => splitDecks(layout.rows, layout.cols, layout.labels, layout.types),
    [layout.rows, layout.cols, layout.labels, layout.types]
  );
  
  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
      {/* Legend */}
      <SeatTypesLegend />
      
      {/* Lower and Upper deck side by side */}
      <div 
        className="grid grid-cols-1 sm:grid-cols-2 w-fit max-w-full place-items-start"
        style={{ gap: `${SPACING_CONFIG.DECK_GAP}px` }}
      >
        {/* Lower Deck */}
        <div 
          className="border rounded-lg bg-muted/20 w-full min-w-0"
          style={{ padding: `${SPACING_CONFIG.DECK_PADDING}px` }}
        >
          <div className="flex items-center justify-between gap-2 mb-8 min-h-10">
            <p className="text-xs font-semibold text-muted-foreground">Lower deck</p>
            <span title="Bus direction (front)">
              <SteeringWheelIcon className="h-12 w-12 shrink-0 text-gray-400" />
            </span>
          </div>
          <div className="w-fit">
            <DeckGrid
              rows={lower}
              occupiedSet={occupiedSet}
              genderMap={genderMap}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={onSelect}
              femaleOnlySet={femaleOnlySet}
              onFemaleOnlySeatClick={onFemaleOnlySeatClick}
              topSpacerRow
              deckType="lower"
            />
          </div>
        </div>
        
        {/* Upper Deck */}
        <div 
          className="border rounded-lg bg-muted/20 w-full min-w-0"
          style={{ padding: `${SPACING_CONFIG.DECK_PADDING}px` }}
        >
          <div className="flex items-center justify-between gap-2 mb-10 min-h-10">
            <p className="text-xs font-semibold text-muted-foreground">Upper deck</p>
          </div>
          <div className="w-fit">
            <DeckGrid
              rows={upper}
              occupiedSet={occupiedSet}
              genderMap={genderMap}
              fare={fare}
              selectedSet={selectedSet}
              onSelect={onSelect}
              femaleOnlySet={femaleOnlySet}
              onFemaleOnlySeatClick={onFemaleOnlySeatClick}
              topSpacerRow
              deckType="upper"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
