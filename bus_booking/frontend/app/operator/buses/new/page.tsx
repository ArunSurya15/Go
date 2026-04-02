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
  type SeatCellType,
  type SeatOrientation,
} from "@/components/seat-layout";

/** Standard layouts: top view — left side = first columns, right side = last columns. */
export const LAYOUT_TEMPLATES = [
  { id: "standard_2_2", name: "Standard 2+2 (seater)", rows: 9, cols: 4, description: "9 rows × 4 seats (2 left, 2 right)" },
  { id: "standard_2_1", name: "Standard 2+1", rows: 9, cols: 3, description: "9 rows × 3 (2 left, 1 right)" },
  { id: "sleeper_1_1_1_lower", name: "Sleeper 1+1+1 (lower deck)", rows: 10, cols: 3, description: "10 rows × 3 berths" },
  { id: "sleeper_1_1_1_upper", name: "Sleeper 1+1+1 (upper deck)", rows: 10, cols: 3, description: "10 rows × 3 berths" },
  { id: "sleeper_2_1_lower", name: "Sleeper 2+1 (lower deck)", rows: 10, cols: 3, description: "10 rows × 3 (2+1)" },
  { id: "custom", name: "Custom (visual editor)", rows: 9, cols: 4, description: "Draw your own layout: seater, sleeper, semi-sleeper, aisle" },
] as const;

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
];

function generateSeatLabels(rows: number, cols: number, types: SeatCellType[]): string[] {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const labels: string[] = [];
  for (let r = 0; r < rows; r++) {
    let colLetterIndex = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (types[idx] === "aisle") {
        labels.push("");
      } else {
        labels.push(`${r + 1}${letters[colLetterIndex] ?? colLetterIndex + 1}`);
        colLetterIndex++;
      }
    }
  }
  return labels;
}

function buildTypesFromTemplate(templateId: string, rows: number, cols: number): SeatCellType[] {
  const total = rows * cols;
  const types: SeatCellType[] = Array(total).fill("seater");
  if (templateId === "sleeper_1_1_1_lower" || templateId === "sleeper_1_1_1_upper" || templateId === "sleeper_2_1_lower") {
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
  /** When painting seats: portrait = default; landscape = berth or bench runs along the row (wide block). */
  const [alongRowBlock, setAlongRowBlock] = useState(false);
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
      return cellTypes.slice(0, totalCells).filter((t) => t !== "aisle").length;
    }
    return totalCells;
  }, [form.layout_template, form.rows, form.cols, cellTypes, totalCells]);

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

  const showVisualEditor = form.layout_template === "custom";

  const editorPreviewLabels = useMemo(
    () =>
      showVisualEditor ? generateSeatLabels(form.rows, form.cols, cellTypes) : [],
    [showVisualEditor, form.rows, form.cols, cellTypes]
  );

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
        seat_map: { rows, cols, labels, types, orientations },
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
            Choose a template or use the visual editor to set each cell as seater, sleeper, semi-sleeper, or aisle (pathway).
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
                  Select a type below, then click a cell to set it. Aisle = pathway (no seat). Seat names are auto-generated.
                </p>
                <div className="flex flex-col lg:flex-row gap-6">
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
                    {selectedType !== "aisle" ? (
                      <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          checked={alongRowBlock}
                          onChange={(e) => setAlongRowBlock(e.target.checked)}
                          className="rounded border-slate-400"
                        />
                        <span>
                          Along-row layout (wide block — horizontal sleeper or front bench seats)
                        </span>
                      </label>
                    ) : null}
                    <p className="text-sm font-medium mt-2">Seats: {capacityFromLayout}</p>
                  </div>
                  <div className="flex-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-zinc-950/50">
                    <p className="mb-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
                      Preview matches passenger seat map (spacing + icons). Lower deck = first half of
                      rows, upper = second half.
                    </p>
                    <OperatorSeatEditorGrid
                      rows={form.rows}
                      cols={form.cols}
                      labels={editorPreviewLabels}
                      cellTypes={cellTypes}
                      cellOrientations={cellOrientations}
                      onPaintCell={setCellType}
                    />
                    <p className="text-xs text-slate-500 mt-3">Front of bus at top of grid →</p>
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
