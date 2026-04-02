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

const COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export type LayoutTemplateDef = {
  id: string;
  name: string;
  rows: number;
  cols: number;
  description: string;
  /** Single-deck bus: all rows in one panel when booking. Omit = double deck (split rows). */
  has_upper_deck?: boolean;
};

/** Standard layouts: top view — left side = first columns, right side = last columns. */
export const LAYOUT_TEMPLATES: LayoutTemplateDef[] = [
  { id: "standard_2_2", name: "Standard 2+2 (seater)", rows: 9, cols: 4, description: "9 rows × 4 seats (2 left, 2 right)" },
  { id: "standard_2_1", name: "Standard 2+1", rows: 9, cols: 3, description: "9 rows × 3 (2 left, 1 right)" },
  {
    id: "sleeper_1_1_1_lower",
    name: "Sleeper 1+1+1 (single deck)",
    rows: 10,
    cols: 3,
    description: "10 rows × 3 berths — one deck only (no upper section in the seat map).",
    has_upper_deck: false,
  },
  {
    id: "sleeper_1_1_1_upper",
    name: "Sleeper 1+1+1 (single deck, upper-style grid)",
    rows: 10,
    cols: 3,
    description: "10 rows × 3 berths — one deck; use for upper-only style numbering if needed.",
    has_upper_deck: false,
  },
  {
    id: "sleeper_2_1_lower",
    name: "Sleeper 2+1 (single deck)",
    rows: 10,
    cols: 3,
    description: "10 rows × 3 (2+1) — one deck only.",
    has_upper_deck: false,
  },
  {
    id: "sleeper_double",
    name: "Sleeper lower + upper (1+1+1)",
    rows: 20,
    cols: 3,
    description: "20 rows × 3 berths — first half = lower deck, second half = upper deck (double-decker).",
    has_upper_deck: true,
  },
  {
    id: "custom",
    name: "Custom (visual editor)",
    rows: 9,
    cols: 4,
    description: "Draw your own layout: seater, sleeper, semi-sleeper, aisle, blank spacer.",
  },
];

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

const SLEEPER_TEMPLATE_IDS = new Set<string>([
  "sleeper_1_1_1_lower",
  "sleeper_1_1_1_upper",
  "sleeper_2_1_lower",
  "sleeper_double",
]);

function buildTypesFromTemplate(templateId: string, rows: number, cols: number): SeatCellType[] {
  const total = rows * cols;
  const types: SeatCellType[] = Array(total).fill("seater");
  if (SLEEPER_TEMPLATE_IDS.has(templateId)) {
    for (let i = 0; i < total; i++) types[i] = "sleeper";
  }
  return types;
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
    capacity: 36,
    rows: 9,
    cols: 4,
  });
  const [selectedType, setSelectedType] = useState<SeatCellType>("seater");
  const [cellTypes, setCellTypes] = useState<SeatCellType[]>(() => Array(9 * 4).fill("seater"));
  const [cellOrientations, setCellOrientations] = useState<SeatOrientation[]>(() =>
    Array(9 * 4).fill("portrait")
  );
  /** When painting seats: false = portrait (vertical berth / normal seat); true = landscape (horizontal along the row). */
  const [alongRowBlock, setAlongRowBlock] = useState(false);
  /** Double-decker: split rows into lower + upper in the passenger seat map. Off = single “Seat layout” panel. */
  const [hasUpperDeck, setHasUpperDeck] = useState(true);
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
      return cellTypes.slice(0, totalCells).filter((t) => t !== "aisle" && t !== "blank").length;
    }
    return totalCells;
  }, [form.layout_template, form.rows, form.cols, cellTypes, totalCells]);

  const deckSplitRow = useMemo(() => Math.ceil(form.rows / 2), [form.rows]);

  const applyTemplate = (templateId: string) => {
    const t = LAYOUT_TEMPLATES.find((x) => x.id === templateId);
    if (t) {
      setForm((f) => ({
        ...f,
        layout_template: templateId,
        rows: t.rows,
        cols: t.cols,
        capacity: templateId === "custom" ? capacityFromLayout : t.rows * t.cols,
      }));
      const newTypes = templateId === "custom"
        ? Array(t.rows * t.cols).fill("seater") as SeatCellType[]
        : buildTypesFromTemplate(templateId, t.rows, t.cols);
      setCellTypes((prev) => {
        const next = [...newTypes];
        for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
        return next;
      });
      setCellOrientations((prev) => {
        const next = Array(t.rows * t.cols).fill("portrait") as SeatOrientation[];
        for (let i = 0; i < Math.min(prev.length, next.length); i++) next[i] = prev[i];
        return next;
      });
      setHasUpperDeck(t.has_upper_deck !== undefined ? t.has_upper_deck : true);
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

  const editorPreviewLabels = useMemo(
    () =>
      showVisualEditor ? generateSeatLabels(form.rows, form.cols, cellTypes) : [],
    [showVisualEditor, form.rows, form.cols, cellTypes]
  );

  const editorFullMatrix = useMemo(() => {
    if (!showVisualEditor) return null;
    return buildSeatEditorMatrix(
      form.rows,
      form.cols,
      editorPreviewLabels,
      cellTypes,
      cellOrientations
    );
  }, [showVisualEditor, form.rows, form.cols, editorPreviewLabels, cellTypes, cellOrientations]);

  const editorLayoutMetrics = useMemo(() => {
    if (!editorFullMatrix) return null;
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
      labels = generateSeatLabels(rows, cols, types);
    } else {
      const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      labels = [];
      for (let r = 1; r <= rows; r++) {
        for (let c = 0; c < cols; c++) {
          labels.push(`${r}${letters[c] ?? String(c + 1)}`);
        }
      }
      types = buildTypesFromTemplate(form.layout_template, rows, cols);
    }

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

    try {
      await operatorApi.createBus(token, {
        registration_no: form.registration_no.trim(),
        capacity,
        seat_map: { rows, cols, labels, types, orientations, has_upper_deck: hasUpperDeck },
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
            Pick a template or draw a custom grid. Sleeper templates include a true double-decker (lower + upper) option.
            In the editor, set horizontal vs vertical seats and use blank spacers or aisles where you need gaps.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 border border-amber-200">{error}</p>
            )}

            <div className="space-y-2">
              <Label htmlFor="layout_template">Layout</Label>
              <select
                id="layout_template"
                value={form.layout_template}
                onChange={(e) => applyTemplate(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {LAYOUT_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                {LAYOUT_TEMPLATES.find((t) => t.id === form.layout_template)?.description}
              </p>
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rows">Rows</Label>
                <Input
                  id="rows"
                  type="number"
                  min={1}
                  max={30}
                  value={form.rows}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setForm((f) => ({ ...f, rows: v }));
                    if (showVisualEditor) handleRowsColsChange(v, form.cols);
                  }}
                  disabled={!showVisualEditor}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cols">Columns</Label>
                <Input
                  id="cols"
                  type="number"
                  min={1}
                  max={8}
                  value={form.cols}
                  onChange={(e) => {
                    const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setForm((f) => ({ ...f, cols: v }));
                    if (showVisualEditor) handleRowsColsChange(form.rows, v);
                  }}
                  disabled={!showVisualEditor}
                />
              </div>
            </div>

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
                              rows={form.rows}
                              cols={form.cols}
                              labels={editorPreviewLabels}
                              cellTypes={cellTypes}
                              cellOrientations={cellOrientations}
                              onPaintCell={setCellType}
                              rowSlice={{ start: 0, end: deckSplitRow }}
                              globalMetrics={
                                editorLayoutMetrics
                                  ? {
                                      colW: editorLayoutMetrics.colW,
                                      rowH: editorLayoutMetrics.rowH,
                                      rowGapPx: editorLayoutMetrics.gaps.lowerRowGapPx,
                                      gridPadY: editorLayoutMetrics.gaps.lowerGridPadY,
                                    }
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                        <div className="flex min-w-0 flex-col items-center sm:items-stretch">
                          <p className="mb-2 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 sm:text-left">
                            Upper
                          </p>
                          <div className="flex justify-center sm:justify-start">
                            <OperatorSeatEditorGrid
                              rows={form.rows}
                              cols={form.cols}
                              labels={editorPreviewLabels}
                              cellTypes={cellTypes}
                              cellOrientations={cellOrientations}
                              onPaintCell={setCellType}
                              rowSlice={{ start: deckSplitRow, end: form.rows }}
                              globalMetrics={
                                editorLayoutMetrics
                                  ? {
                                      colW: editorLayoutMetrics.colW,
                                      rowH: editorLayoutMetrics.rowH,
                                      rowGapPx: editorLayoutMetrics.gaps.upperRowGapPx,
                                      gridPadY: editorLayoutMetrics.gaps.upperGridPadY,
                                    }
                                  : undefined
                              }
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <OperatorSeatEditorGrid
                          rows={form.rows}
                          cols={form.cols}
                          labels={editorPreviewLabels}
                          cellTypes={cellTypes}
                          cellOrientations={cellOrientations}
                          onPaintCell={setCellType}
                          globalMetrics={
                            editorLayoutMetrics
                              ? {
                                  colW: editorLayoutMetrics.colW,
                                  rowH: editorLayoutMetrics.rowH,
                                  rowGapPx: SPACING_CONFIG.ROW_GAP,
                                  gridPadY: 0,
                                }
                              : undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-slate-500">
              Total seats: {form.layout_template === "custom" ? capacityFromLayout : totalCells}
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
