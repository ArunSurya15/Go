"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorBus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function generateSeatLabels(rows: number, cols: number): string[] {
  const labels: string[] = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      labels.push(`${r}${letters[c] ?? String(c + 1)}`);
    }
  }
  return labels;
}

export default function AddBusPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    registration_no: "",
    capacity: 36,
    rows: 9,
    cols: 4,
  });

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

  const capacityFromLayout = form.rows * form.cols;
  const syncCapacity = () => setForm((f) => ({ ...f, capacity: capacityFromLayout }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    const rows = Math.max(1, form.rows);
    const cols = Math.max(1, form.cols);
    const labels = generateSeatLabels(rows, cols);
    try {
      await operatorApi.createBus(token, {
        registration_no: form.registration_no.trim(),
        capacity: labels.length,
        seat_map: { rows, cols, labels },
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
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/operator/dashboard"
          className="text-sm text-slate-600 hover:text-indigo-600"
        >
          ← Dashboard
        </Link>
      </div>
      <Card className="border-slate-200 shadow-md">
        <CardHeader>
          <CardTitle>Add bus</CardTitle>
          <CardDescription>
            Register a new bus. Seat layout is used for booking (e.g. 9 rows × 4 columns).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rows">Rows</Label>
                <Input
                  id="rows"
                  type="number"
                  min={1}
                  max={30}
                  value={form.rows}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rows: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                  }
                  onBlur={syncCapacity}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cols">Columns (seats per row)</Label>
                <Input
                  id="cols"
                  type="number"
                  min={1}
                  max={5}
                  value={form.cols}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cols: Math.max(1, parseInt(e.target.value, 10) || 1) }))
                  }
                  onBlur={syncCapacity}
                />
              </div>
            </div>
            <p className="text-sm text-slate-500">
              Total seats: {capacityFromLayout} (labels 1A–{form.rows}
              {String.fromCharCode(64 + form.cols)})
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
