"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeatCellType } from "@/components/seat-layout";

/** Seat type icons — same as seat-layout: front-top view, rounded back, curved arms, U base */
function SeaterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="8" height="6" rx="2" />
      <path d="M7.5 9c0-1.5 1-2.5 2.5-2.5h4c1.5 0 2.5 1 2.5 2.5v0.8c0 1.2-.6 2.1-1.6 2.7l1.2 4.8c.3 1.2-.5 2-1.8 2H9.7c-1.3 0-2.1-.8-1.8-2l1.2-4.8c-1-.6-1.6-1.5-1.6-2.7z" />
    </svg>
  );
}

function SleeperIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <rect x="7" y="14" width="10" height="3" rx="1" strokeWidth="1.2" opacity={0.8} />
    </svg>
  );
}

function SemiSleeperIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="4" width="8" height="6" rx="2" />
      <path d="M7.5 9c0-1.5 1-2.5 2.5-2.5h4c1.5 0 2.5 1 2.5 2.5v0.8c0 1.2-.6 2.1-1.6 2.7l1.2 4.8c.3 1.2-.5 2-1.8 2H9.7c-1.3 0-2.1-.8-1.8-2l1.2-4.8c-1-.6-1.6-1.5-1.6-2.7z" />
      <path d="M9 8h6" strokeDasharray="2 2" opacity={0.7} />
    </svg>
  );
}

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
  { id: "seater", label: "Seater", color: "bg-green-100 border-green-500", icon: <SeaterIcon className="h-4 w-4" /> },
  { id: "sleeper", label: "Sleeper", color: "bg-blue-100 border-blue-500", icon: <SleeperIcon className="h-4 w-4" /> },
  { id: "semi_sleeper", label: "Semi-sleeper", color: "bg-amber-100 border-amber-500", icon: <SemiSleeperIcon className="h-4 w-4" /> },
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
    layout_template: "standard_2_2",
    capacity: 36,
    rows: 9,
    cols: 4,
  });
  const [selectedType, setSelectedType] = useState<SeatCellType>("seater");
  const [cellTypes, setCellTypes] = useState<SeatCellType[]>(() => Array(9 * 4).fill("seater"));

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
    }
  };

  const handleRowsColsChange = (newRows: number, newCols: number) => {
    const newTotal = newRows * newCols;
    setCellTypes((prev) => {
      const next = Array(newTotal).fill("seater") as SeatCellType[];
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
  };

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
    const layout_type = form.layout_template === "custom" ? undefined : form.layout_template;

    try {
      await operatorApi.createBus(token, {
        registration_no: form.registration_no.trim(),
        capacity,
        seat_map: { rows, cols, labels, types },
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

  const showVisualEditor = form.layout_template === "custom";

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
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
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
                            selectedType === st.id ? "ring-2 ring-offset-2 ring-indigo-500" : ""
                          }`}
                        >
                          {st.icon}
                          {st.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">
                      Selected: <strong>{SEAT_TYPES.find((t) => t.id === selectedType)?.label}</strong>
                    </p>
                    <p className="text-sm font-medium mt-2">Seats: {capacityFromLayout}</p>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <div
                      className="inline-grid gap-1 w-fit"
                      style={{
                        gridTemplateColumns: `repeat(${form.cols}, 44px)`,
                        gridTemplateRows: `repeat(${form.rows}, 40px)`,
                      }}
                    >
                      {Array.from({ length: totalCells }, (_, i) => {
                        const t = cellTypes[i] ?? "seater";
                        const isAisle = t === "aisle";
                        const labels = generateSeatLabels(form.rows, form.cols, cellTypes);
                        const label = labels[i] ?? "";
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setCellType(i)}
                            className={`
                              rounded border-2 text-[10px] font-medium flex flex-col items-center justify-center gap-0.5
                              ${t === "seater" ? "bg-green-100 border-green-500 text-green-800" : ""}
                              ${t === "sleeper" ? "bg-blue-100 border-blue-500 text-blue-800" : ""}
                              ${t === "semi_sleeper" ? "bg-amber-100 border-amber-500 text-amber-800" : ""}
                              ${t === "aisle" ? "bg-slate-100 border-dashed border-slate-400 text-slate-500" : ""}
                              hover:opacity-90
                            `}
                            title={`${t} (click to set to ${selectedType})`}
                          >
                            {isAisle ? (
                              "—"
                            ) : (
                              <>
                                {t === "seater" && <SeaterIcon className="h-3.5 w-3.5" />}
                                {t === "sleeper" && <SleeperIcon className="h-4 w-4" />}
                                {t === "semi_sleeper" && <SemiSleeperIcon className="h-3.5 w-3.5" />}
                                <span className="font-semibold">{label || `${Math.floor(i / form.cols) + 1}${String.fromCharCode(65 + (i % form.cols))}`}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Front of bus →</p>
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
