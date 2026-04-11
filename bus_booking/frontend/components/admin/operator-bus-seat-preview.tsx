"use client";

import { useMemo } from "react";
import {
  OperatorSeatEditorGrid,
  SPACING_CONFIG,
  buildSeatEditorMatrix,
  computeGridMetrics,
  computeSyncedDeckRowGaps,
  type SeatCellType,
  type SeatOrientation,
} from "@/components/seat-layout";

type SeatMapLike = {
  rows?: number;
  cols?: number;
  labels?: string[];
  types?: string[];
  orientations?: string[];
  has_upper_deck?: boolean;
  deck_split_row?: number;
};

function normalizeSeatMap(sm: SeatMapLike | null | undefined) {
  if (!sm || typeof sm !== "object") return null;
  const rows = Math.max(1, Number(sm.rows) || 1);
  const cols = Math.max(1, Number(sm.cols) || 1);
  const total = rows * cols;
  let labels = Array.isArray(sm.labels) ? [...sm.labels] : [];
  while (labels.length < total) labels.push("");
  labels = labels.slice(0, total);
  let types = (Array.isArray(sm.types) ? [...sm.types] : []) as SeatCellType[];
  while (types.length < total) types.push("seater");
  types = types.slice(0, total) as SeatCellType[];
  let orientations = (Array.isArray(sm.orientations) ? [...sm.orientations] : []) as SeatOrientation[];
  while (orientations.length < total) orientations.push("portrait");
  orientations = orientations.slice(0, total) as SeatOrientation[];
  const hasUpperDeck = Boolean(sm.has_upper_deck) && rows >= 2;
  let deckSplitRow = Number(sm.deck_split_row);
  if (!Number.isFinite(deckSplitRow) || deckSplitRow < 1 || deckSplitRow >= rows) {
    deckSplitRow = Math.max(1, Math.floor(rows / 2));
  }
  if (!hasUpperDeck) deckSplitRow = rows;
  return { rows, cols, labels, types, orientations, hasUpperDeck, deckSplitRow };
}

type Metrics = {
  colW: number[];
  rowH: number[];
  gaps: {
    lowerRowGapPx: number;
    upperRowGapPx: number;
    lowerGridPadY: number;
    upperGridPadY: number;
  };
};

function LayoutPreviewDeckGrids({
  rows,
  cols,
  labels,
  types,
  orientations,
  hasUpperDeck,
  deckSplitRow,
  editorLayoutMetrics,
}: {
  rows: number;
  cols: number;
  labels: string[];
  types: SeatCellType[];
  orientations: SeatOrientation[];
  hasUpperDeck: boolean;
  deckSplitRow: number;
  editorLayoutMetrics: Metrics;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-zinc-950/50">
      <p className="mb-3 text-[11px] font-medium text-slate-600 dark:text-slate-400">
        Seat layout (front of bus at top)
      </p>
      {hasUpperDeck ? (
        <div
          className="flex flex-col items-stretch sm:flex-row sm:justify-center"
          style={{ gap: `${SPACING_CONFIG.DECK_GAP}px` }}
        >
          <div className="flex min-w-0 flex-col items-center sm:items-stretch">
            <p className="mb-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 sm:text-left">Lower</p>
            <div className="flex justify-center sm:justify-start">
              <OperatorSeatEditorGrid
                rows={rows}
                cols={cols}
                labels={labels}
                cellTypes={types}
                cellOrientations={orientations}
                readOnly
                rowSlice={{ start: 0, end: deckSplitRow }}
                globalMetrics={{
                  colW: editorLayoutMetrics.colW,
                  rowH: editorLayoutMetrics.rowH,
                  rowGapPx: editorLayoutMetrics.gaps.lowerRowGapPx,
                  gridPadY: editorLayoutMetrics.gaps.lowerGridPadY,
                }}
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center sm:items-stretch">
            <p className="mb-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 sm:text-left">Upper</p>
            <div className="flex justify-center sm:justify-start">
              <OperatorSeatEditorGrid
                rows={rows}
                cols={cols}
                labels={labels}
                cellTypes={types}
                cellOrientations={orientations}
                readOnly
                rowSlice={{ start: deckSplitRow, end: rows }}
                globalMetrics={{
                  colW: editorLayoutMetrics.colW,
                  rowH: editorLayoutMetrics.rowH,
                  rowGapPx: editorLayoutMetrics.gaps.upperRowGapPx,
                  gridPadY: editorLayoutMetrics.gaps.upperGridPadY,
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex justify-center">
          <OperatorSeatEditorGrid
            rows={rows}
            cols={cols}
            labels={labels}
            cellTypes={types}
            cellOrientations={orientations}
            readOnly
            globalMetrics={{
              colW: editorLayoutMetrics.colW,
              rowH: editorLayoutMetrics.rowH,
              rowGapPx: SPACING_CONFIG.ROW_GAP,
              gridPadY: 0,
            }}
          />
        </div>
      )}
    </div>
  );
}

export function OperatorBusSeatPreview({ seatMap }: { seatMap: SeatMapLike | null | undefined }) {
  const n = normalizeSeatMap(seatMap);
  const editorLayoutMetrics = useMemo(() => {
    if (!n) return null;
    const { rows, cols, labels, types, orientations, hasUpperDeck, deckSplitRow } = n;
    const editorFullMatrix = buildSeatEditorMatrix(rows, cols, labels, types, orientations);
    const { colW, rowH } = computeGridMetrics(editorFullMatrix);
    const lower = editorFullMatrix.slice(0, deckSplitRow);
    const upper = editorFullMatrix.slice(deckSplitRow);
    const gaps =
      hasUpperDeck && upper.length > 0
        ? computeSyncedDeckRowGaps(lower, upper)
        : {
            lowerRowGapPx: SPACING_CONFIG.ROW_GAP,
            upperRowGapPx: SPACING_CONFIG.ROW_GAP,
            lowerGridPadY: 0,
            upperGridPadY: 0,
          };
    return { colW, rowH, gaps };
  }, [n]);

  if (!n || !editorLayoutMetrics) {
    return <p className="text-xs text-slate-500">No seat layout stored for this bus.</p>;
  }

  const { rows, cols, labels, types, orientations, hasUpperDeck, deckSplitRow } = n;

  return (
    <LayoutPreviewDeckGrids
      rows={rows}
      cols={cols}
      labels={labels}
      types={types}
      orientations={orientations}
      hasUpperDeck={hasUpperDeck}
      deckSplitRow={deckSplitRow}
      editorLayoutMetrics={editorLayoutMetrics}
    />
  );
}
