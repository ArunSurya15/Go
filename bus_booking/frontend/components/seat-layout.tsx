"use client";

import React, { useEffect, useId, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

type SeatLayoutProps = {
  layout: {
    rows: number;
    cols: number;
    labels: string[];
    types?: string[];
    orientations?: string[];
    /** When false, all rows show as one deck (no upper panel). Default true if omitted (legacy maps). */
    has_upper_deck?: boolean;
    /**
     * First row index of upper deck (split is exclusive: rows [0, deck_split_row) = lower).
     * When omitted, lower/upper split defaults to Math.ceil(rows / 2).
     */
    deck_split_row?: number;
  };
  occupied: string[];
  occupiedDetails?: { label: string; gender?: "M" | "F" | string }[];
  /** Default fare; used when `seatFares` has no entry for a label. */
  fare: string;
  /** Optional per-seat prices (label -> rupees string), e.g. from seat-map API `seat_fares`. */
  seatFares?: Record<string, string>;
  selected: string[];
  onSelect: (seat: string) => void;
  /** Called when user selects (clicks to add) an available female-only seat */
  onFemaleOnlySeatClick?: (seat: string) => void;
  /** Hide the passenger legend (symbols / booked vs available). Use for operator pricing preview. */
  hideLegend?: boolean;
  /** Show seat label (e.g. L1, U5) under the icon — useful for operator pricing preview. */
  showSeatLabels?: boolean;
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

type CellType = "seater" | "sleeper" | "semi_sleeper" | "aisle" | "blank" | "";
/** Alias for operator UI and templates */
export type SeatCellType = "seater" | "sleeper" | "semi_sleeper" | "aisle" | "blank";
export type SeatOrientation = "portrait" | "landscape";
type CellInfo = { label: string; type: CellType; orientation?: SeatOrientation };

// ============================================================================
// CONFIGURABLE SPACING VARIABLES
// ============================================================================

export const SPACING_CONFIG = {
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
  /** Empty “spacer” cell (no seat, not a walkway) */
  BLANK_CELL_WIDTH: 14,

  // Top spacer row height (0 = no spacer; seat rows align via equal header height only)
  STEERING_ROW_HEIGHT: 0,
  
  // Deck container spacing
  DECK_PADDING: 12,
  DECK_GAP: 16,                 // Gap between lower and upper deck
};

const LABEL_LINE_HEIGHT_PX = 14;

function sleeperNarrowWidthPx(): number {
  return Math.round(
    SPACING_CONFIG.SLEEPER_ICON_HEIGHT_PX * SPACING_CONFIG.SLEEPER_ICON_ASPECT
  );
}

/** Icon box (before padding/price row) for grid sizing — mixed seater/sleeper rows align per column/row max. */
function getIconBoxDims(type: CellType, orientation: SeatOrientation): { iw: number; ih: number } {
  const s = SPACING_CONFIG.SEATER_ICON_PX;
  const sh = SPACING_CONFIG.SLEEPER_ICON_HEIGHT_PX;
  const sw = sleeperNarrowWidthPx();
  if (type === "sleeper") {
    if (orientation === "landscape") return { iw: sh, ih: sw };
    return { iw: sw, ih: sh };
  }
  if (type === "semi_sleeper") {
    if (orientation === "landscape") {
      const w = Math.round(s * 2.15);
      const h = Math.round(s * 0.92);
      return { iw: w, ih: h };
    }
    return { iw: s, ih: s };
  }
  if (type === "seater" || !type) {
    if (orientation === "landscape") {
      const w = Math.round(s * 2.15);
      const h = Math.round(s * 0.92);
      return { iw: w, ih: h };
    }
    return { iw: s, ih: s };
  }
  return { iw: s, ih: s };
}

function getCellOuterDims(type: CellType, orientation: SeatOrientation): { ow: number; oh: number } {
  const { iw, ih } = getIconBoxDims(type, orientation);
  const oh =
    ih +
    SPACING_CONFIG.ICON_TO_PRICE_GAP +
    LABEL_LINE_HEIGHT_PX +
    SPACING_CONFIG.SEAT_VERTICAL_PADDING * 2;
  const ow = iw + SPACING_CONFIG.SEAT_HORIZONTAL_PADDING * 2;
  return { ow, oh };
}

function defaultRowMinHeight(): number {
  return getCellOuterDims("seater", "portrait").oh;
}

/**
 * Per-column width and per-row height so sleepers reserve vertical space and seaters align in mixed decks.
 */
export function computeGridMetrics(rows: CellInfo[][]): { colW: number[]; rowH: number[] } {
  const R = rows.length;
  const C = rows[0]?.length ?? 0;
  const colW = Array(C).fill(0);
  const rowH = Array(R).fill(0);
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const cell = rows[r][c];
      if (!cell?.label) {
        const t = (cell.type ?? "aisle") as CellType;
        if (t === "blank") {
          colW[c] = Math.max(colW[c], SPACING_CONFIG.BLANK_CELL_WIDTH);
          rowH[r] = Math.max(rowH[r], defaultRowMinHeight());
        } else {
          colW[c] = Math.max(colW[c], SPACING_CONFIG.AISLE_WIDTH);
        }
        continue;
      }
      const ori: SeatOrientation = cell.orientation === "landscape" ? "landscape" : "portrait";
      const t = (cell.type ?? "seater") as CellType;
      const { ow, oh } = getCellOuterDims(t, ori);
      colW[c] = Math.max(colW[c], ow);
      rowH[r] = Math.max(rowH[r], oh);
    }
  }
  const minR = defaultRowMinHeight();
  for (let r = 0; r < R; r++) {
    if (rowH[r] < minR) rowH[r] = minR;
  }
  return { colW, rowH };
}

function gridBodyHeightPx(rowH: number[], rowGapPx: number, topSpacerPx: number): number {
  if (rowH.length === 0) return topSpacerPx;
  const sum = rowH.reduce((a, h) => a + h, 0);
  const between = Math.max(0, rowH.length - 1) * rowGapPx;
  return topSpacerPx + sum + between;
}

/** Same vertical sync as passenger SeatLayout: stretch row gaps so lower/upper decks align. */
export function computeSyncedDeckRowGaps(
  lower: CellInfo[][],
  upper: CellInfo[][]
): {
  lowerRowGapPx: number;
  upperRowGapPx: number;
  lowerGridPadY: number;
  upperGridPadY: number;
} {
  const baseGap = SPACING_CONFIG.ROW_GAP;
  if (upper.length === 0) {
    return {
      lowerRowGapPx: baseGap,
      upperRowGapPx: baseGap,
      lowerGridPadY: 0,
      upperGridPadY: 0,
    };
  }
  const { rowH: rowHL } = computeGridMetrics(lower);
  const { rowH: rowHU } = computeGridMetrics(upper);
  const topSpacer =
    SPACING_CONFIG.STEERING_ROW_HEIGHT > 0 ? SPACING_CONFIG.STEERING_ROW_HEIGHT : 0;
  const hLo = gridBodyHeightPx(rowHL, baseGap, topSpacer);
  const hUp = gridBodyHeightPx(rowHU, baseGap, topSpacer);
  const target = Math.max(hLo, hUp);

  let lg = baseGap;
  let ug = baseGap;
  let lp = 0;
  let up = 0;

  if (rowHL.length > 1) {
    lg = baseGap + (target - hLo) / (rowHL.length - 1);
  } else if (rowHL.length === 1 && hLo < target) {
    lp = (target - hLo) / 2;
  }

  if (rowHU.length > 1) {
    ug = baseGap + (target - hUp) / (rowHU.length - 1);
  } else if (rowHU.length === 1 && hUp < target) {
    up = (target - hUp) / 2;
  }

  return {
    lowerRowGapPx: lg,
    upperRowGapPx: ug,
    lowerGridPadY: lp,
    upperGridPadY: up,
  };
}

/** Full bus matrix for operator editor — same cell model as DeckGrid / OperatorSeatEditorGrid. */
export function buildSeatEditorMatrix(
  rows: number,
  cols: number,
  labels: string[],
  cellTypes: SeatCellType[],
  cellOrientations: SeatOrientation[]
): CellInfo[][] {
  const m: CellInfo[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CellInfo[] = [];
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const label = labels[i] ?? "";
      const type = (cellTypes[i] ?? "seater") as CellType;
      const orientation: SeatOrientation =
        cellOrientations[i] === "landscape" ? "landscape" : "portrait";
      row.push({ label, type, orientation });
    }
    m.push(row);
  }
  return m;
}

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
 * Sleeper Icon - tall rounded berth (passenger + operator preview)
 */
export const SleeperBerthIcon = ({
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
 * Seater / semi-sleeper / sleeper with correct visual orientation for landscape cells.
 * Portrait SVGs use default preserveAspectRatio "meet"; only swapping width/height leaves a tall
 * graphic centered in a wide cell (still looks vertical). Rotating 90° makes horizontal berths/benches read correctly.
 */
function OrientedSeatBerthGraphic({
  cellType,
  orientation,
  iw,
  ih,
  fillOpacity = 0,
}: {
  cellType: "seater" | "sleeper" | "semi_sleeper";
  orientation: SeatOrientation;
  iw: number;
  ih: number;
  fillOpacity?: number;
}) {
  const isLandscape = orientation === "landscape";
  const sw = sleeperNarrowWidthPx();
  const sh = SPACING_CONFIG.SLEEPER_ICON_HEIGHT_PX;

  if (cellType === "sleeper") {
    if (isLandscape) {
      return (
        <div
          className="flex items-center justify-center overflow-visible"
          style={{ width: iw, height: ih }}
        >
          <SleeperBerthIcon
            className="block shrink-0"
            style={{
              width: sw,
              height: sh,
              transform: "rotate(90deg)",
              transformOrigin: "center center",
              display: "block",
            }}
            strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
            fillOpacity={fillOpacity}
          />
        </div>
      );
    }
    return (
      <SleeperBerthIcon
        className="block shrink-0"
        style={{ width: iw, height: ih, display: "block" }}
        strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
        fillOpacity={fillOpacity}
      />
    );
  }

  if (isLandscape) {
    return (
      <div
        className="flex items-center justify-center overflow-visible"
        style={{ width: iw, height: ih }}
      >
        <SeaterTopViewIcon
          className="block shrink-0"
          style={{
            width: ih,
            height: iw,
            transform: "rotate(90deg)",
            transformOrigin: "center center",
            display: "block",
          }}
          fillOpacity={fillOpacity}
          strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
        />
      </div>
    );
  }

  return (
    <SeaterTopViewIcon
      className="block shrink-0"
      style={{ width: iw, height: ih, display: "block" }}
      fillOpacity={fillOpacity}
      strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
    />
  );
}

/** Upper grip + hand cutouts (mask): hands nudged toward hub for a tighter “on wheel” read */
const STEERING_MASK_TOP = `
  M 8.6 12.5
  Q 16.0 4.0 23.4 12.5
  Q 20.5 14.5 16.0 13.1
  Q 11.5 14.5 8.6 12.5
  Z
`;
const STEERING_MASK_HAND_L = `
  M 8.5 17.6
  Q 9.2 23.8 13.6 23.6
  Q 12.8 20.0 10.9 17.8
  Q 9.6 16.4 8.5 17.6
  Z
`;
const STEERING_MASK_HAND_R = `
  M 23.5 17.6
  Q 22.8 23.8 18.4 23.6
  Q 19.2 20.0 21.1 17.8
  Q 22.4 16.4 23.5 17.6
  Z
`;

/**
 * Steering Wheel Icon
 */
function SteeringWheelIcon({ className }: { className?: string }) {
  const maskId = `steeringMask-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <mask id={maskId}>
          <rect width="32" height="32" fill="white" />
          <circle cx="16" cy="17.5" r="1.9" fill="black" />
          <path fill="black" d={STEERING_MASK_TOP} />
          <path fill="black" d={STEERING_MASK_HAND_L} />
          <path fill="black" d={STEERING_MASK_HAND_R} />
        </mask>
      </defs>
      <circle cx="16" cy="16" r="11.7" fill="currentColor" mask={`url(#${maskId})`} />
      {/* White rim at hand / grip cutouts so silhouette separates from wheel fill */}
      <g fill="none" stroke="#ffffff" strokeWidth={1.05} strokeLinejoin="round" strokeLinecap="round" opacity={0.92}>
        <path d={STEERING_MASK_TOP} />
        <path d={STEERING_MASK_HAND_L} />
        <path d={STEERING_MASK_HAND_R} />
      </g>
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
  types?: string[],
  orientations?: string[],
  hasUpperDeck = true,
  deckSplitRowFromLayout?: number
): { lower: CellInfo[][]; upper: CellInfo[][] } {
  const lower: CellInfo[][] = [];
  const upper: CellInfo[][] = [];
  let splitRow: number;
  if (!hasUpperDeck) {
    splitRow = rows;
  } else if (
    typeof deckSplitRowFromLayout === "number" &&
    Number.isFinite(deckSplitRowFromLayout) &&
    deckSplitRowFromLayout >= 1 &&
    deckSplitRowFromLayout < rows
  ) {
    splitRow = Math.floor(deckSplitRowFromLayout);
  } else {
    splitRow = Math.ceil(rows / 2);
  }

  for (let r = 0; r < rows; r++) {
    const rowCells: CellInfo[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const label = labels[idx] ?? "";
      const type = (types?.[idx] as CellType) ?? (label ? "seater" : "aisle");
      const raw = orientations?.[idx];
      const orientation: SeatOrientation =
        String(raw).toLowerCase() === "landscape" ? "landscape" : "portrait";
      rowCells.push({ label, type, orientation });
    }
    if (r < splitRow) lower.push(rowCells);
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
  seatFares,
  selectedSet,
  onSelect,
  femaleOnlySet,
  onFemaleOnlySeatClick,
  topSpacerRow,
  deckType = "lower",
  rowGapPx,
  showSeatLabels = false,
}: {
  rows: CellInfo[][];
  occupiedSet: Set<string>;
  genderMap: Map<string, string>;
  fare: string;
  seatFares?: Record<string, string>;
  selectedSet: Set<string>;
  onSelect: (seat: string) => void;
  femaleOnlySet: Set<string>;
  onFemaleOnlySeatClick?: (seat: string) => void;
  /** When true, add an empty first row so seat rows align between lower and upper deck */
  topSpacerRow?: boolean;
  deckType?: "lower" | "upper";
  /** Override vertical gap between rows (e.g. sync seater deck height to sleeper deck) */
  rowGapPx?: number;
  showSeatLabels?: boolean;
}) {
  const cols = rows[0]?.length ?? 0;
  const numRows = rows.length;

  if (cols === 0 || numRows === 0) return null;

  const spacerHeight = SPACING_CONFIG.STEERING_ROW_HEIGHT;
  const hasTopRow = !!topSpacerRow && spacerHeight > 0;

  const defaultFareInt = Math.round(Number(fare)) || 0;
  const priceForLabel = (label: string) => {
    const raw = seatFares?.[label];
    if (raw != null && String(raw).trim() !== "") {
      const n = Math.round(Number(raw));
      return Number.isFinite(n) ? n : defaultFareInt;
    }
    return defaultFareInt;
  };
  const { colW, rowH } = computeGridMetrics(rows);
  const gapY = rowGapPx ?? SPACING_CONFIG.ROW_GAP;

  const colTemplate = colW.map((w) => `${w}px`).join(" ");
  const rowTemplate = hasTopRow
    ? `${spacerHeight}px ${rowH.map((h) => `${h}px`).join(" ")}`
    : rowH.map((h) => `${h}px`).join(" ");

  return (
    <div
      className="inline-grid items-stretch justify-items-center"
      style={{
        gridTemplateColumns: colTemplate,
        gridTemplateRows: rowTemplate,
        columnGap: `${SPACING_CONFIG.COLUMN_GAP}px`,
        rowGap: `${gapY}px`,
      }}
    >
      {hasTopRow &&
        Array.from({ length: cols }, (_, c) => (
          <div
            key={`top-spacer-${c}`}
            style={{ width: colW[c], height: spacerHeight }}
            aria-hidden
          />
        ))}

      {rows.map((row, r) =>
        row.map((cell, c) => {
          if (!cell?.label) {
            const emptyType = (cell.type ?? "aisle") as CellType;
            if (emptyType === "blank") {
              return (
                <div
                  key={`blank-${r}-${c}`}
                  style={{ width: colW[c], height: rowH[r] }}
                  className="rounded-sm border border-dotted border-muted-foreground/20 bg-muted/5"
                  aria-hidden
                />
              );
            }
            return (
              <div
                key={`aisle-${r}-${c}`}
                style={{ width: colW[c], height: rowH[r] }}
                className="bg-muted/10 rounded-sm"
                aria-hidden
              />
            );
          }

          const label = cell.label;
          const type = cell.type ?? "seater";
          const orientation: SeatOrientation =
            cell.orientation === "landscape" ? "landscape" : "portrait";
          const isOccupied = occupiedSet.has(label);
          const isSelected = selectedSet.has(label);
          const isAvailable = !isOccupied;
          const canClick = isAvailable || isSelected;
          const isFemaleOnly = isAvailable && femaleOnlySet.has(label);
          const femaleOnlyHighlight = isFemaleOnly && !isSelected;
          const gender = genderMap.get(label);
          const occupiedFemale = isOccupied && gender === "F";
          const isSemi = type === "semi_sleeper";
          const palette = (() => {
            if (isOccupied) {
              if (occupiedFemale) return { icon: "text-pink-200", fill: 0.5 };
              return { icon: "text-blue-200", fill: 0.5 };
            }
            if (isSelected) {
              if (isSemi) return { icon: "text-amber-900", fill: 0.5 };
              if (type === "sleeper") return { icon: "text-blue-900", fill: 0.5 };
              return { icon: "text-green-800", fill: 0.5 };
            }
            if (femaleOnlyHighlight) return { icon: "text-pink-600", fill: 0 };
            if (isSemi) return { icon: "text-amber-700", fill: 0 };
            if (type === "sleeper") return { icon: "text-blue-700", fill: 0 };
            return { icon: "text-green-700", fill: 0 };
          })();

          const { iw, ih } = getIconBoxDims(type, orientation);
          const seatRenderType: "seater" | "sleeper" | "semi_sleeper" =
            type === "sleeper" ? "sleeper" : type === "semi_sleeper" ? "semi_sleeper" : "seater";

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
              className={cn(
                "flex flex-col items-center justify-center overflow-visible transition-colors text-xs font-medium w-full",
                isOccupied
                  ? occupiedFemale
                    ? "text-pink-300 cursor-not-allowed"
                    : "text-blue-300 cursor-not-allowed"
                  : isSemi
                    ? "text-amber-800"
                    : type === "sleeper"
                      ? "text-blue-800"
                      : "text-green-800"
              )}
              style={{
                width: colW[c],
                height: rowH[r],
                gap: `${SPACING_CONFIG.ICON_TO_PRICE_GAP}px`,
                padding: `${SPACING_CONFIG.SEAT_VERTICAL_PADDING}px ${SPACING_CONFIG.SEAT_HORIZONTAL_PADDING}px`,
                margin: 0,
                border: "none",
                background: "transparent",
                boxSizing: "border-box",
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-visible leading-[0] [&>*]:block">
                <div className={palette.icon}>
                  <OrientedSeatBerthGraphic
                    cellType={seatRenderType}
                    orientation={orientation}
                    iw={iw}
                    ih={ih}
                    fillOpacity={palette.fill ?? 0}
                  />
                </div>
              </div>
              {isOccupied && (
                <span
                  className={cn(
                    "text-[10px] leading-none shrink-0",
                    occupiedFemale ? "text-pink-400" : "text-blue-400"
                  )}
                >
                  Sold
                </span>
              )}
              {isAvailable && showSeatLabels ? (
                <span className="max-w-full truncate text-center text-[9px] font-semibold leading-none text-slate-600 dark:text-slate-300">
                  {label}
                </span>
              ) : null}
              {isAvailable && (
                <span className="text-[10px] leading-none shrink-0 text-gray-500 dark:text-gray-400">
                  ₹{priceForLabel(label)}
                </span>
              )}
            </button>
          );

          if (isFemaleOnly) {
            return (
              <div
                key={label}
                className="relative flex flex-col items-center justify-start group"
                style={{ width: colW[c], height: rowH[r] }}
              >
                <div
                  className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-max min-w-[5.5rem] -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  role="tooltip"
                >
                  <div className="rounded-lg bg-zinc-900 px-3 py-2 text-center text-white shadow-lg dark:bg-zinc-950">
                    <p className="text-sm font-semibold leading-tight tabular-nums">₹{priceForLabel(label)}</p>
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
      <SleeperBerthIcon
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
      <SleeperBerthIcon
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
                <SleeperBerthIcon
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
  seatFares,
  selected,
  onSelect,
  onFemaleOnlySeatClick,
  hideLegend = false,
  showSeatLabels = false,
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
  
  const hasUpperDeck = layout.has_upper_deck !== false;

  const { lower, upper } = useMemo(
    () =>
      splitDecks(
        layout.rows,
        layout.cols,
        layout.labels,
        layout.types,
        layout.orientations,
        hasUpperDeck,
        layout.deck_split_row
      ),
    [layout.rows, layout.cols, layout.labels, layout.types, layout.orientations, hasUpperDeck, layout.deck_split_row]
  );

  const singleDeck = !hasUpperDeck || upper.length === 0;

  const { lowerRowGapPx, upperRowGapPx, lowerGridPadY, upperGridPadY } = useMemo(() => {
    if (singleDeck) {
      return {
        lowerRowGapPx: SPACING_CONFIG.ROW_GAP,
        upperRowGapPx: SPACING_CONFIG.ROW_GAP,
        lowerGridPadY: 0,
        upperGridPadY: 0,
      };
    }
    return computeSyncedDeckRowGaps(lower, upper);
  }, [lower, upper, singleDeck]);
  
  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto">
      {/* Legend */}
      {!hideLegend ? <SeatTypesLegend /> : null}
      
      {/* Decks: width hugs seat grid (tight sides); equal card height; row gaps sync vertical span */}
      <div
        className="flex w-full flex-col items-stretch justify-center sm:flex-row sm:items-stretch"
        style={{ gap: `${SPACING_CONFIG.DECK_GAP}px` }}
      >
        {/* Lower Deck */}
        <div
          className="flex w-fit max-w-full min-w-0 flex-col rounded-lg border bg-muted/20 sm:min-w-0"
          style={{ padding: `${SPACING_CONFIG.DECK_PADDING}px` }}
        >
          <div className="mb-4 flex min-h-[3rem] shrink-0 items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {singleDeck ? "Seat layout" : "Lower deck"}
            </p>
            <span title="Bus direction (front)">
              <SteeringWheelIcon className="h-12 w-12 shrink-0 text-gray-400" />
            </span>
          </div>
          <div
            className="flex flex-col items-stretch"
            style={{
              paddingTop: lowerGridPadY,
              paddingBottom: lowerGridPadY,
            }}
          >
            <DeckGrid
              rows={lower}
              occupiedSet={occupiedSet}
              genderMap={genderMap}
              fare={fare}
              seatFares={seatFares}
              selectedSet={selectedSet}
              onSelect={onSelect}
              femaleOnlySet={femaleOnlySet}
              onFemaleOnlySeatClick={onFemaleOnlySeatClick}
              topSpacerRow
              deckType="lower"
              rowGapPx={lowerRowGapPx}
              showSeatLabels={showSeatLabels}
            />
          </div>
        </div>

        {!singleDeck ? (
          <div
            className="flex w-fit max-w-full min-w-0 flex-col rounded-lg border bg-muted/20 sm:min-w-0"
            style={{ padding: `${SPACING_CONFIG.DECK_PADDING}px` }}
          >
            <div className="mb-4 flex min-h-[3rem] shrink-0 items-center justify-between gap-2">
              <p className="text-xs font-semibold text-muted-foreground">Upper deck</p>
              <span className="inline-flex h-12 w-12 shrink-0" aria-hidden />
            </div>
            <div
              className="flex flex-col items-stretch"
              style={{
                paddingTop: upperGridPadY,
                paddingBottom: upperGridPadY,
              }}
            >
              <DeckGrid
                rows={upper}
                occupiedSet={occupiedSet}
                genderMap={genderMap}
                fare={fare}
                seatFares={seatFares}
                selectedSet={selectedSet}
                onSelect={onSelect}
                femaleOnlySet={femaleOnlySet}
                onFemaleOnlySeatClick={onFemaleOnlySeatClick}
                topSpacerRow
                deckType="upper"
                rowGapPx={upperRowGapPx}
                showSeatLabels={showSeatLabels}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Operator visual editor: same icon geometry and column/row sizing as the passenger seat map.
 * Click a cell to apply the currently selected palette type (handled by parent).
 * Set `readOnly` for a non-interactive preview (e.g. preset templates on Add bus).
 */
export function OperatorSeatEditorGrid({
  rows,
  cols,
  labels,
  cellTypes,
  cellOrientations,
  onPaintCell,
  rowSlice,
  globalMetrics,
  readOnly = false,
}: {
  rows: number;
  cols: number;
  labels: string[];
  cellTypes: SeatCellType[];
  cellOrientations: SeatOrientation[];
  onPaintCell?: (flatIndex: number) => void;
  /** If set, only render this row range (inclusive start, exclusive end). Used for lower/upper preview. */
  rowSlice?: { start: number; end: number };
  /**
   * When set, column widths and row heights come from the full-bus layout (matches passenger map).
   * Row gaps / vertical padding match synced lower/upper decks when provided.
   */
  globalMetrics?: {
    colW: number[];
    rowH: number[];
    rowGapPx: number;
    gridPadY: number;
  };
  /** When true, cells are static (no painting). Omit or no-op `onPaintCell`. */
  readOnly?: boolean;
}) {
  const r0 = rowSlice?.start ?? 0;
  const r1 = rowSlice?.end ?? rows;
  const paintBrushRef = useRef(false);

  useEffect(() => {
    if (readOnly) return;
    const stop = () => {
      paintBrushRef.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [readOnly]);

  const matrix = useMemo(() => {
    const m: CellInfo[][] = [];
    for (let r = r0; r < r1; r++) {
      const row: CellInfo[] = [];
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const label = labels[i] ?? "";
        const type = (cellTypes[i] ?? "seater") as CellType;
        const orientation: SeatOrientation =
          cellOrientations[i] === "landscape" ? "landscape" : "portrait";
        row.push({ label, type, orientation });
      }
      m.push(row);
    }
    return m;
  }, [rows, cols, labels, cellTypes, cellOrientations, r0, r1]);

  const localMetrics = useMemo(() => computeGridMetrics(matrix), [matrix]);
  const colW = globalMetrics?.colW ?? localMetrics.colW;
  const rowH = useMemo(() => {
    if (!globalMetrics?.rowH) return localMetrics.rowH;
    const out: number[] = [];
    const minR = defaultRowMinHeight();
    for (let r = r0; r < r1; r++) {
      out.push(globalMetrics.rowH[r] ?? minR);
    }
    return out;
  }, [globalMetrics?.rowH, r0, r1, localMetrics.rowH]);
  const rowGapPx = globalMetrics?.rowGapPx ?? SPACING_CONFIG.ROW_GAP;
  const gridPadY = globalMetrics?.gridPadY ?? 0;

  const colTemplate = colW.map((w) => `${w}px`).join(" ");
  const rowTemplate = rowH.map((h) => `${h}px`).join(" ");
  const sliceRows = r1 - r0;

  const paint = onPaintCell ?? (() => {});

  const paintProps = (flatIndex: number) =>
    readOnly
      ? {}
      : {
          onPointerDown: (e: React.PointerEvent) => {
            if (e.button !== 0) return;
            paintBrushRef.current = true;
            paint(flatIndex);
          },
          onPointerEnter: (e: React.PointerEvent) => {
            if (e.buttons === 1 && paintBrushRef.current) paint(flatIndex);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              paint(flatIndex);
            }
          },
        };

  if (sliceRows <= 0 || matrix.length === 0) {
    return (
      <div className="flex min-h-[72px] items-center justify-center rounded-lg border border-dashed border-muted-foreground/35 bg-muted/15 px-3 text-center text-[11px] text-muted-foreground">
        No rows in this deck
      </div>
    );
  }

  const grid = (
    <div
      className={cn(
        "inline-grid select-none items-stretch justify-items-center",
        readOnly ? "touch-auto" : "touch-none"
      )}
      style={{
        gridTemplateColumns: colTemplate,
        gridTemplateRows: rowTemplate,
        columnGap: `${SPACING_CONFIG.COLUMN_GAP}px`,
        rowGap: `${rowGapPx}px`,
      }}
    >
      {matrix.map((row, r) =>
        row.map((cell, c) => {
          const globalR = r0 + r;
          const flatIndex = globalR * cols + c;
          if (cell.type === "blank") {
            const blankStyle = {
              width: colW[c],
              height: rowH[r],
              boxSizing: "border-box" as const,
            };
            const blankClass = cn(
              "flex items-center justify-center rounded-md border border-dotted border-slate-400/70 bg-slate-50/80 text-[9px] font-medium text-slate-400 dark:border-slate-600 dark:bg-zinc-900/40 dark:text-slate-500",
              !readOnly &&
                "transition-colors hover:border-primary/50 hover:bg-slate-100"
            );
            return readOnly ? (
              <div
                key={`blank-${flatIndex}`}
                className={blankClass}
                style={blankStyle}
                role="img"
                aria-label="Blank spacer"
              >
                Blank
              </div>
            ) : (
              <button
                key={`blank-${flatIndex}`}
                type="button"
                {...paintProps(flatIndex)}
                className={blankClass}
                style={blankStyle}
                title="Blank spacer (not a seat or walkway)"
              >
                Blank
              </button>
            );
          }
          if (!cell.label) {
            const aisleStyle = {
              width: colW[c],
              height: rowH[r],
              boxSizing: "border-box" as const,
            };
            const aisleClass = cn(
              "flex items-center justify-center rounded-md border-2 border-dashed border-slate-400/90 bg-slate-100/90 text-[9px] font-medium text-slate-500 dark:border-slate-600 dark:bg-muted/40",
              !readOnly && "transition-colors hover:bg-slate-200/90 hover:text-slate-700 dark:hover:bg-muted/60"
            );
            return readOnly ? (
              <div
                key={`aisle-${flatIndex}`}
                className={aisleClass}
                style={aisleStyle}
                role="img"
                aria-label="Aisle"
              >
                Aisle
              </div>
            ) : (
              <button
                key={`aisle-${flatIndex}`}
                type="button"
                {...paintProps(flatIndex)}
                className={aisleClass}
                style={aisleStyle}
              >
                Aisle
              </button>
            );
          }

          const t = cell.type ?? "seater";
          const orientation = cell.orientation ?? "portrait";
          const { iw, ih } = getIconBoxDims(t, orientation);
          const isSleeper = t === "sleeper";
          const isSemi = t === "semi_sleeper";
          const seatRenderType: "seater" | "sleeper" | "semi_sleeper" =
            t === "sleeper" ? "sleeper" : t === "semi_sleeper" ? "semi_sleeper" : "seater";

          const seatShell = cn(
            "flex flex-col items-center justify-center gap-0.5 overflow-visible rounded-lg border-2 shadow-sm",
            !readOnly &&
              "transition-colors hover:border-primary hover:ring-2 hover:ring-primary/25 dark:hover:border-primary",
            isSleeper &&
              "border-blue-300 bg-blue-50/80 dark:border-blue-700 dark:bg-blue-950/40",
            isSemi &&
              "border-amber-400 bg-amber-50/90 dark:border-amber-600 dark:bg-amber-950/35",
            !isSleeper &&
              !isSemi &&
              "border-emerald-200 bg-white dark:border-emerald-900/50 dark:bg-zinc-900/80"
          );

          const seatStyle = {
            width: colW[c],
            height: rowH[r],
            boxSizing: "border-box" as const,
            padding: `${SPACING_CONFIG.SEAT_VERTICAL_PADDING}px ${SPACING_CONFIG.SEAT_HORIZONTAL_PADDING}px`,
          };

          const seatInner = (
            <>
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col items-center justify-center overflow-visible leading-[0]",
                  isSleeper && "text-blue-800 dark:text-blue-300",
                  isSemi && "text-amber-900 dark:text-amber-300",
                  !isSleeper && !isSemi && "text-emerald-800 dark:text-emerald-400"
                )}
              >
                <OrientedSeatBerthGraphic
                  cellType={seatRenderType}
                  orientation={orientation}
                  iw={iw}
                  ih={ih}
                  fillOpacity={0}
                />
              </div>
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-slate-800 dark:text-slate-100">
                {cell.label}
              </span>
            </>
          );

          return readOnly ? (
            <div
              key={`seat-${flatIndex}`}
              className={seatShell}
              style={seatStyle}
              role="img"
              aria-label={`Seat ${cell.label}`}
            >
              {seatInner}
            </div>
          ) : (
            <button
              key={`seat-${flatIndex}`}
              type="button"
              {...paintProps(flatIndex)}
              className={seatShell}
              style={seatStyle}
              title="Click or drag to paint with the selected type"
            >
              {seatInner}
            </button>
          );
        })
      )}
    </div>
  );

  if (gridPadY > 0) {
    return (
      <div
        className="inline-block"
        style={{ paddingTop: gridPadY, paddingBottom: gridPadY }}
      >
        {grid}
      </div>
    );
  }

  return grid;
}
