"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, routes, type BusFeatureDef } from "@/lib/api";
import { BUS_FEATURES_FALLBACK } from "@/lib/bus-features";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  OperatorSeatEditorGrid,
  SeaterTopViewIcon,
  SleeperBerthIcon,
  SPACING_CONFIG,
  buildSeatEditorMatrix,
  computeGridMetrics,
  computeSyncedDeckRowGaps,
  type SeatCellType,
  type SeatOrientation,
} from "@/components/seat-layout";
import {
  LAYOUT_TEMPLATES,
  LAYOUT_OPTION_GROUP_LABEL,
  LAYOUT_OPTION_GROUP_ORDER,
  countBookableCells,
  buildTypesFromTemplate,
  getTemplateDeckSplitRow,
  resolveDeckSplitRow,
  mirrorTypesForDoubleDeck,
} from "@/lib/operator-bus-layout-templates";

const COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const SEAT_TYPES: { id: SeatCellType; label: string; color: string; icon?: React.ReactNode }[] = [
  {
    id: "seater",
    label: "Seater",
    color: "bg-green-100 border-green-500",
    icon: (
      <SeaterTopViewIcon
        className="h-9 w-9 shrink-0 text-green-800"
        fillOpacity={0}
        strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
      />
    ),
  },
  {
    id: "sleeper",
    label: "Sleeper",
    color: "bg-blue-100 border-blue-500",
    icon: (
      <SleeperBerthIcon
        className="h-10 w-[1.65rem] shrink-0 text-green-800"
        strokeWidth={SPACING_CONFIG.SLEEPER_STROKE_WIDTH}
        fillOpacity={0}
      />
    ),
  },
  {
    id: "semi_sleeper",
    label: "Semi-sleeper",
    color: "bg-amber-100 border-amber-500",
    icon: (
      <SeaterTopViewIcon
        className="h-9 w-9 shrink-0 text-amber-900"
        fillOpacity={0}
        strokeWidth={SPACING_CONFIG.SEATER_STROKE_WIDTH}
      />
    ),
  },
  { id: "aisle", label: "Aisle (pathway)", color: "bg-slate-100 border-dashed border-slate-400" },
  {
    id: "blank",
    label: "Blank spacer",
    color: "bg-zinc-50 border-zinc-300 border-dotted",
  },
];

function generateSeatLabels(rows: number, cols: number, types: SeatCellType[]): string[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const labels: string[] = [];
  for (let r = 0; r < rows; r++) {
    let colLetterIndex = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (types[idx] === "aisle" || types[idx] === "blank") {
        labels.push("");
      } else {
        labels.push(`${r + 1}${letters[colLetterIndex] ?? colLetterIndex + 1}`);
        colLetterIndex++;
      }
    }
  }
  return labels;
}

type EditorLayoutMetricsBundle = {
  colW: number[];
  rowH: number[];
  gaps: {
    lowerRowGapPx: number;
    upperRowGapPx: number;
    lowerGridPadY: number;
    upperGridPadY: number;
  };
};

/** Shared lower/upper (or single-deck) preview — editable or read-only. */
function LayoutPreviewDeckGrids({
  rows,
  cols,
  labels,
  types,
  orientations,
  hasUpperDeck,
  deckSplitRow,
  editorLayoutMetrics,
  readOnly,
  onPaintCell,
}: {
  rows: number;
  cols: number;
  labels: string[];
  types: SeatCellType[];
  orientations: SeatOrientation[];
  hasUpperDeck: boolean;
  deckSplitRow: number;
  editorLayoutMetrics: EditorLayoutMetricsBundle;
  readOnly: boolean;
  onPaintCell?: (index: number) => void;
}) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-zinc-950/50">
      <p className="mb-3 text-[11px] font-medium text-slate-600 dark:text-slate-400">
        Layout preview (front of bus at the top of each grid)
      </p>
      {hasUpperDeck ? (
        <div
          className="flex flex-col items-stretch sm:flex-row sm:justify-center"
          style={{ gap: `${SPACING_CONFIG.DECK_GAP}px` }}
        >
          <div className="flex min-w-0 flex-col items-center sm:items-stretch">
            <p className="mb-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 sm:text-left">
              Lower
            </p>
            <div className="flex justify-center sm:justify-start">
              <OperatorSeatEditorGrid
                rows={rows}
                cols={cols}
                labels={labels}
                cellTypes={types}
                cellOrientations={orientations}
                readOnly={readOnly}
                onPaintCell={onPaintCell}
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
            <p className="mb-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 sm:text-left">
              Upper
            </p>
            <div className="flex justify-center sm:justify-start">
              <OperatorSeatEditorGrid
                rows={rows}
                cols={cols}
                labels={labels}
                cellTypes={types}
                cellOrientations={orientations}
                readOnly={readOnly}
                onPaintCell={onPaintCell}
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
            readOnly={readOnly}
            onPaintCell={onPaintCell}
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

export default function AddBusPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    registration_no: "",
    service_name: "",
    layout_template: "standard_2_2",
    capacity: 40,
    rows: 10,
    cols: 5,
  });
  const [selectedType, setSelectedType] = useState<SeatCellType>("seater");
  const [cellTypes, setCellTypes] = useState<SeatCellType[]>(() => Array(10 * 5).fill("seater"));
  const [cellOrientations, setCellOrientations] = useState<SeatOrientation[]>(() =>
    Array(10 * 5).fill("portrait")
  );
  /** When painting seats: false = portrait (vertical berth / normal seat); true = landscape (horizontal along the row). */
  const [alongRowBlock, setAlongRowBlock] = useState(false);
  /** Double-decker: split rows into lower + upper in the passenger seat map. Off = single “Seat layout” panel. */
  const [hasUpperDeck, setHasUpperDeck] = useState(false); // seaters have no upper deck
  const [sidesMirrored, setSidesMirrored] = useState(false);
  /** When layout is Custom, preserves lower/upper row split from the template (e.g. 10+6 vs default 8+8). */
  const [customDeckSplitRow, setCustomDeckSplitRow] = useState<number | null>(null);
  const [featureCatalog, setFeatureCatalog] = useState<BusFeatureDef[]>(BUS_FEATURES_FALLBACK);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [extrasNote, setExtrasNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await routes.busFeatures();
        if (!cancelled && Array.isArray(r.features) && r.features.length > 0) {
          setFeatureCatalog(r.features);
        }
      } catch {
        if (!cancelled) setFeatureCatalog(BUS_FEATURES_FALLBACK);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router]);

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const totalCells = form.rows * form.cols;
  const capacityFromLayout = useMemo(() => {
    if (form.layout_template === "custom") {
      return countBookableCells(cellTypes.slice(0, totalCells));
    }
    let types = buildTypesFromTemplate(form.layout_template, form.rows, form.cols);
    if (sidesMirrored) {
      const split = resolveDeckSplitRow(
        form.layout_template,
        form.rows,
        customDeckSplitRow,
        hasUpperDeck
      );
      types = mirrorTypesForDoubleDeck(types, form.rows, form.cols, split);
    }
    return countBookableCells(types);
  }, [
    form.layout_template,
    form.rows,
    form.cols,
    cellTypes,
    totalCells,
    sidesMirrored,
    customDeckSplitRow,
    hasUpperDeck,
  ]);

  const deckSplitRow = useMemo(
    () =>
      resolveDeckSplitRow(form.layout_template, form.rows, customDeckSplitRow, hasUpperDeck),
    [form.layout_template, form.rows, customDeckSplitRow, hasUpperDeck]
  );

  const deckSplitExplanation = useMemo(() => {
    const n = form.rows;
    const split = deckSplitRow;
    const upperFirst = split + 1;
    const lowerCount = split;
    const upperCount = n - split;
    return `Lower deck = rows 1–${split} (${lowerCount} row${lowerCount === 1 ? "" : "s"}). Upper deck = rows ${upperFirst}–${n} (${upperCount} row${upperCount === 1 ? "" : "s"}).`;
  }, [form.rows, deckSplitRow]);

  const applyTemplate = (templateId: string) => {
    const t = LAYOUT_TEMPLATES.find((x) => x.id === templateId);
    if (t) {
      const newTypes =
        templateId === "custom"
          ? (Array(t.rows * t.cols).fill("seater") as SeatCellType[])
          : buildTypesFromTemplate(templateId, t.rows, t.cols);
      const cap = countBookableCells(newTypes);
      setForm((f) => ({
        ...f,
        layout_template: templateId,
        rows: t.rows,
        cols: t.cols,
        capacity: cap,
      }));
      setCellTypes(newTypes);
      setCellOrientations(Array(t.rows * t.cols).fill("portrait") as SeatOrientation[]);
      setHasUpperDeck(t.has_upper_deck === true);
      setSidesMirrored(false);
      setCustomDeckSplitRow(null);
    }
  };

  const handleRowsColsChange = (newRows: number, newCols: number) => {
    const newTotal = newRows * newCols;
    setCellTypes((prev) => {
      const next = Array(newTotal).fill("seater") as SeatCellType[];
      for (let i = 0; i < Math.min(prev.length, newTotal); i++) next[i] = prev[i];
      return next;
    });
    setCellOrientations((prev) => {
      const next = Array(newTotal).fill("portrait") as SeatOrientation[];
      for (let i = 0; i < Math.min(prev.length, newTotal); i++) next[i] = prev[i];
      return next;
    });
    setCustomDeckSplitRow((prev) => {
      if (prev === null) return null;
      if (newRows < 2) return null;
      return Math.min(Math.max(1, prev), newRows - 1);
    });
  };

  const setCellType = (index: number) => {
    if (form.layout_template !== "custom") return;
    setCellTypes((prev) => {
      const next = [...prev];
      next[index] = selectedType;
      return next;
    });
    setCellOrientations((prev) => {
      const next = [...prev];
      if (
        selectedType === "sleeper" ||
        selectedType === "seater" ||
        selectedType === "semi_sleeper"
      ) {
        next[index] = alongRowBlock ? "landscape" : "portrait";
      } else {
        next[index] = "portrait";
      }
      return next;
    });
  };

  const fillColumnWithSelection = (col: number) => {
    if (form.layout_template !== "custom") return;
    const { rows, cols } = form;
    setCellTypes((prev) => {
      const next = [...prev];
      for (let r = 0; r < rows; r++) {
        const i = r * cols + col;
        next[i] = selectedType;
      }
      return next;
    });
    setCellOrientations((prev) => {
      const next = [...prev];
      for (let r = 0; r < rows; r++) {
        const i = r * cols + col;
        if (
          selectedType === "sleeper" ||
          selectedType === "seater" ||
          selectedType === "semi_sleeper"
        ) {
          next[i] = alongRowBlock ? "landscape" : "portrait";
        } else {
          next[i] = "portrait";
        }
      }
      return next;
    });
  };

  const showVisualEditor = form.layout_template === "custom";

  const totalSeatCells = form.rows * form.cols;

  const layoutPreviewTypes = useMemo((): SeatCellType[] => {
    if (form.layout_template === "custom") {
      const next = cellTypes.slice(0, totalSeatCells);
      while (next.length < totalSeatCells) next.push("seater");
      return next;
    }
    let types = buildTypesFromTemplate(form.layout_template, form.rows, form.cols);
    if (sidesMirrored) {
      const split = resolveDeckSplitRow(
        form.layout_template,
        form.rows,
        customDeckSplitRow,
        hasUpperDeck
      );
      types = mirrorTypesForDoubleDeck(types, form.rows, form.cols, split);
    }
    return types;
  }, [
    form.layout_template,
    form.rows,
    form.cols,
    cellTypes,
    totalSeatCells,
    sidesMirrored,
    customDeckSplitRow,
    hasUpperDeck,
  ]);

  const layoutPreviewLabels = useMemo(
    () => generateSeatLabels(form.rows, form.cols, layoutPreviewTypes),
    [form.rows, form.cols, layoutPreviewTypes]
  );

  const layoutPreviewOrientations = useMemo((): SeatOrientation[] => {
    if (form.layout_template === "custom") {
      const next = cellOrientations.slice(0, totalSeatCells);
      while (next.length < totalSeatCells) next.push("portrait");
      return next;
    }
    return Array(totalSeatCells).fill("portrait") as SeatOrientation[];
  }, [form.layout_template, form.rows, form.cols, cellOrientations, totalSeatCells]);

  const editorFullMatrix = useMemo(
    () =>
      buildSeatEditorMatrix(
        form.rows,
        form.cols,
        layoutPreviewLabels,
        layoutPreviewTypes,
        layoutPreviewOrientations
      ),
    [form.rows, form.cols, layoutPreviewLabels, layoutPreviewTypes, layoutPreviewOrientations]
  );

  const editorLayoutMetrics = useMemo(() => {
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
  }, [editorFullMatrix, hasUpperDeck, deckSplitRow]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    const rows = Math.max(1, form.rows);
    const cols = Math.max(1, form.cols);

    let labels: string[];
    let types: SeatCellType[];

    if (form.layout_template === "custom") {
      types = cellTypes.slice(0, rows * cols);
    } else {
      types = buildTypesFromTemplate(form.layout_template, rows, cols);
      if (sidesMirrored) {
        const split = resolveDeckSplitRow(
          form.layout_template,
          rows,
          customDeckSplitRow,
          hasUpperDeck
        );
        types = mirrorTypesForDoubleDeck(types, rows, cols, split);
      }
    }
    labels = generateSeatLabels(rows, cols, types);

    const capacity = labels.filter((l) => l !== "").length;
    const totalCells = rows * cols;
    const orientations: SeatOrientation[] =
      form.layout_template === "custom"
        ? (() => {
            const o = cellOrientations.slice(0, totalCells);
            while (o.length < totalCells) o.push("portrait");
            return o;
          })()
        : Array(totalCells).fill("portrait");

    const deckSplitForApi =
      hasUpperDeck && rows >= 2
        ? resolveDeckSplitRow(form.layout_template, rows, customDeckSplitRow, hasUpperDeck)
        : undefined;

    try {
      await operatorApi.createBus(token, {
        registration_no: form.registration_no.trim(),
        capacity,
        seat_map: {
          rows,
          cols,
          labels,
          types,
          orientations,
          has_upper_deck: hasUpperDeck,
          ...(deckSplitForApi !== undefined && deckSplitForApi < rows
            ? { deck_split_row: deckSplitForApi }
            : {}),
        },
        features: selectedFeatures,
        extras_note: extrasNote.trim(),
        ...(form.service_name.trim() ? { service_name: form.service_name.trim() } : {}),
      });
      router.push("/operator/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add bus.");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Load the currently-selected template's cells into the custom editor,
   * then switch to custom mode — so the operator can tweak any preset.
   */
  const handleCustomizeTemplate = () => {
    setCustomDeckSplitRow(
      getTemplateDeckSplitRow(form.layout_template, form.rows)
    );
    setCellTypes([...layoutPreviewTypes] as SeatCellType[]);
    setCellOrientations(Array(form.rows * form.cols).fill("portrait") as SeatOrientation[]);
    setForm((f) => ({ ...f, layout_template: "custom" }));
    setSidesMirrored(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/operator/dashboard" className="text-sm text-slate-600 hover:text-indigo-600">
          ← Dashboard
        </Link>
      </div>
      <Card className="border-slate-200 shadow-md">
        <CardHeader>
          <CardTitle>Add bus</CardTitle>
          <CardDescription>
            Choose an industry-style layout (seater, sleeper, semi-sleeper recliner, or hybrid) or paint a custom grid.
            Templates match common Indian bus types: 2×2 / 2×1 / 3×2 seaters, 2×1 and 1×1 sleepers, recliners, and mixed decks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 border border-amber-200">{error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="registration_no">Registration number</Label>
              <Input
                id="registration_no"
                value={form.registration_no}
                onChange={(e) => setForm((f) => ({ ...f, registration_no: e.target.value }))}
                placeholder="e.g. KA01AB1234"
                required
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_name">Service name (optional)</Label>
              <Input
                id="service_name"
                value={form.service_name}
                onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
                placeholder='e.g. Bharat Benz A/C Sleeper (2+1)'
                className="w-full"
              />
              <p className="text-xs text-slate-500">Shown on search results under your operator name.</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-3">
              <div>
                <p className="text-sm font-medium text-slate-800">Amenities</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tick what this bus offers — passengers can filter by these on the schedules page.
                </p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {featureCatalog.map((f) => {
                  const on = selectedFeatures.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleFeature(f.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                        on
                          ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-primary/30"
                          : "border-slate-200 bg-white text-slate-700 hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-slate-300 bg-white"
                          )}
                          aria-hidden
                        >
                          {on ? "✓" : ""}
                        </span>
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="space-y-2">
                <Label htmlFor="extras_note">Extra details (optional)</Label>
                <textarea
                  id="extras_note"
                  value={extrasNote}
                  onChange={(e) => setExtrasNote(e.target.value)}
                  placeholder="e.g. Pillow on request, veg meals available at halt…"
                  maxLength={500}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-h-[80px] resize-y"
                />
                <p className="text-xs text-slate-500">{extrasNote.length}/500</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="layout_template">Bus layout template</Label>
              <select
                id="layout_template"
                value={form.layout_template}
                onChange={(e) => applyTemplate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LAYOUT_OPTION_GROUP_ORDER.map((group) => (
                  <optgroup key={group} label={LAYOUT_OPTION_GROUP_LABEL[group]}>
                    {LAYOUT_TEMPLATES.filter((t) => t.optionGroup === group).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                {LAYOUT_TEMPLATES.find((t) => t.id === form.layout_template)?.description}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5 dark:border-slate-700 dark:bg-zinc-900/30">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">Capacity</p>
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:border-indigo-800 dark:text-indigo-300">
                  {capacityFromLayout} seats
                </span>
                {hasUpperDeck && (
                  <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-600 dark:bg-zinc-800 dark:border-zinc-700 dark:text-slate-400">
                    lower + upper deck
                  </span>
                )}
              </div>
              {hasUpperDeck && (
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {deckSplitExplanation}
                </p>
              )}
              {showVisualEditor ? (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div className="space-y-2">
                    <Label htmlFor="rows">
                      Rows{" "}
                      <span className="font-normal text-slate-400 text-[11px]">(more rows = more seats)</span>
                    </Label>
                    <Input
                      id="rows"
                      type="number"
                      min={1}
                      max={30}
                      value={form.rows}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setForm((f) => ({ ...f, rows: v }));
                        handleRowsColsChange(v, form.cols);
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cols">
                      Columns{" "}
                      <span className="font-normal text-slate-400 text-[11px]">(includes aisle)</span>
                    </Label>
                    <Input
                      id="cols"
                      type="number"
                      min={1}
                      max={8}
                      value={form.cols}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                        setForm((f) => ({ ...f, cols: v }));
                        handleRowsColsChange(form.rows, v);
                      }}
                    />
                  </div>
                  {hasUpperDeck && form.rows >= 2 && (
                    <div className="col-span-2 space-y-2">
                      <Label htmlFor="lower_deck_rows">
                        Rows on lower deck{" "}
                        <span className="font-normal text-slate-400 text-[11px]">
                          (upper starts the row after this)
                        </span>
                      </Label>
                      <Input
                        id="lower_deck_rows"
                        type="number"
                        min={1}
                        max={form.rows - 1}
                        value={deckSplitRow}
                        onChange={(e) => {
                          const v = Math.max(
                            1,
                            Math.min(form.rows - 1, parseInt(e.target.value, 10) || 1)
                          );
                          setCustomDeckSplitRow(v);
                        }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Template uses <strong className="text-slate-700 dark:text-slate-300">{form.rows} rows</strong>.{" "}
                  Need more or fewer seats? Pick <strong>Custom</strong> and adjust the row count.
                </p>
              )}
            </div>

            {!showVisualEditor && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4 space-y-2 dark:border-slate-700 dark:bg-zinc-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Layout preview</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSidesMirrored((m) => !m)}
                      title="Swap which side has fewer / more seats (e.g. 2+1 ↔ 1+2)"
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        sidesMirrored
                          ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-400"
                      }`}
                    >
                      <span aria-hidden>⇄</span>
                      {sidesMirrored ? "Sides interchanged" : "Interchange sides"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomizeTemplate}
                      title="Load this template into the custom editor to tweak seats, blank out cells, or change row count"
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 dark:border-slate-700 dark:bg-zinc-900 dark:text-slate-400 dark:hover:border-amber-700 dark:hover:bg-amber-950/30 dark:hover:text-amber-300"
                    >
                      <span aria-hidden>✏</span> Customize
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Use <strong className="text-slate-600 dark:text-slate-300">Interchange</strong> to swap left/right sides. Use <strong className="text-slate-600 dark:text-slate-300">Customize</strong> to edit seat types, blank cells, or change row count.
                </p>
                <LayoutPreviewDeckGrids
                  rows={form.rows}
                  cols={form.cols}
                  labels={layoutPreviewLabels}
                  types={layoutPreviewTypes}
                  orientations={layoutPreviewOrientations}
                  hasUpperDeck={hasUpperDeck}
                  deckSplitRow={deckSplitRow}
                  editorLayoutMetrics={editorLayoutMetrics}
                  readOnly
                />
              </div>
            )}

            {showVisualEditor && (
              <div className="rounded-lg border bg-slate-50/50 p-4 space-y-4">
                <p className="text-sm font-medium">Visual layout editor</p>
                <p className="text-xs text-slate-500">
                  Select a type below, then click a cell. <strong>Aisle</strong> = walkable passage (dashed).{" "}
                  <strong>Blank</strong> = empty spacer (not a seat, not a walkway). Seat labels are generated automatically.
                  Seaters are green-tinted, semi-sleepers orange, sleepers blue — matching the passenger map.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Seat type (click to select)</Label>
                    <div className="flex flex-wrap gap-2">
                      {SEAT_TYPES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setSelectedType(st.id)}
                          className={`rounded-lg border-2 px-3 py-2 text-xs font-medium transition-colors flex items-center gap-1.5 ${st.color} ${
                            selectedType === st.id ? "ring-2 ring-offset-2 ring-primary" : ""
                          }`}
                        >
                          {st.icon}
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">
                      Selected:{" "}
                      <strong>{SEAT_TYPES.find((t) => t.id === selectedType)?.label}</strong>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 pt-2">
                      <span className="text-[11px] text-slate-500">Fill column:</span>
                      {Array.from({ length: form.cols }, (_, c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => fillColumnWithSelection(c)}
                          className="h-7 min-w-7 rounded border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-primary hover:bg-primary/5 dark:border-slate-600 dark:bg-zinc-900 dark:text-slate-200"
                          title={`Set column ${COL_LETTERS[c] ?? c + 1} to ${SEAT_TYPES.find((t) => t.id === selectedType)?.label ?? selectedType}`}
                        >
                          {COL_LETTERS[c] ?? c + 1}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] leading-snug text-slate-500 pt-1">
                      <strong>Drag to paint:</strong> hold the mouse button and move across cells (best for long aisles).
                      Use <strong>Fill column</strong> for a full vertical aisle in one click.
                    </p>
                    {selectedType !== "aisle" && selectedType !== "blank" ? (
                      <fieldset className="mt-3 space-y-2 border-0 p-0">
                        <legend className="text-xs font-medium text-slate-800 dark:text-slate-200">
                          Seat / berth direction (how it faces in the grid)
                        </legend>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name="paint-orientation"
                            checked={!alongRowBlock}
                            onChange={() => setAlongRowBlock(false)}
                            className="border-slate-400"
                          />
                          <span>
                            <strong>Vertical</strong> — default (chair upright; sleeper head-to-toe along the bus length)
                          </span>
                        </label>
                        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                          <input
                            type="radio"
                            name="paint-orientation"
                            checked={alongRowBlock}
                            onChange={() => setAlongRowBlock(true)}
                            className="border-slate-400"
                          />
                          <span>
                            <strong>Horizontal</strong> — wide block along the row (berth lying across the bus, or front
                            bench seats). The preview updates to show wide cells when a cell was painted in this mode.
                          </span>
                        </label>
                        <p className="text-[11px] leading-snug text-slate-500 pl-6">
                          Tip: choose <strong>Horizontal</strong> before painting cells to draw sleepers or benches that
                          span sideways in the layout.
                        </p>
                      </fieldset>
                    ) : null}
                    <p className="text-sm font-medium pt-1">Seats: {capacityFromLayout}</p>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-slate-200 bg-white/80 px-3 py-2.5 text-sm text-slate-800 dark:border-slate-600 dark:bg-zinc-900/40 dark:text-slate-200">
                      <input
                        type="checkbox"
                        checked={!hasUpperDeck}
                        onChange={(e) => setHasUpperDeck(!e.target.checked)}
                        className="mt-0.5 rounded border-slate-400"
                      />
                      <span>
                        <span className="font-medium">Remove upper berth</span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          When checked, passengers see a single deck. When unchecked, the first half of rows is{" "}
                          <strong>Lower</strong> and the second half <strong>Upper</strong> (preview below).
                        </span>
                      </span>
                    </label>
                  </div>

                  <LayoutPreviewDeckGrids
                    rows={form.rows}
                    cols={form.cols}
                    labels={layoutPreviewLabels}
                    types={layoutPreviewTypes}
                    orientations={layoutPreviewOrientations}
                    hasUpperDeck={hasUpperDeck}
                    deckSplitRow={deckSplitRow}
                    editorLayoutMetrics={editorLayoutMetrics}
                    readOnly={false}
                    onPaintCell={setCellType}
                  />
                </div>
              </div>
            )}

            <p className="text-sm text-slate-500">
              Total seats: {capacityFromLayout}
            </p>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving || !form.registration_no.trim()}>
                {saving ? "Adding…" : "Add bus"}
              </Button>
              <Link href="/operator/dashboard">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

