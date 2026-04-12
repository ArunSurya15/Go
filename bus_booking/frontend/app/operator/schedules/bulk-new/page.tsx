"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { OperationsGate } from "@/app/operator/capability-gates";
import { operatorApi, routes as routesApi, type OperatorBus, type Route } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle, Calendar, AlertCircle } from "lucide-react";

const DAYS = [
  { id: 0, label: "Mon" }, { id: 1, label: "Tue" }, { id: 2, label: "Wed" },
  { id: 3, label: "Thu" }, { id: 4, label: "Fri" }, { id: 5, label: "Sat" }, { id: 6, label: "Sun" },
];

function countDates(from: string, to: string, days: number[]): number {
  if (!from || !to || !days.length) return 0;
  try {
    let count = 0;
    const cur = new Date(from + "T00:00:00");
    const end = new Date(to + "T00:00:00");
    while (cur <= end && count <= 400) {
      if (days.includes(cur.getDay() === 0 ? 6 : cur.getDay() - 1)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  } catch { return 0; }
}

export default function BulkNewSchedulesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    schedule_status?: "ACTIVE" | "PENDING";
  } | null>(null);

  const [buses, setBuses] = useState<OperatorBus[]>([]);
  const [routesList, setRoutesList] = useState<Route[]>([]);

  const [form, setForm] = useState({
    bus_id: "",
    route_id: "",
    departure_time: "09:00",
    arrival_time: "18:00",
    arrival_next_day: false,
    fare: "500",
    date_from: "",
    date_to: "",
  });
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);

  useEffect(() => {
    (async () => {
      const token = await getValidToken();
      if (!token) { router.replace("/operator/login"); return; }
      try {
        const [b, r] = await Promise.all([operatorApi.buses(token), routesApi.list()]);
        setBuses(b);
        setRoutesList(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [getValidToken, router]);

  const previewCount = useMemo(
    () => countDates(form.date_from, form.date_to, selectedDays),
    [form.date_from, form.date_to, selectedDays]
  );

  const toggleDay = (id: number) => {
    setSelectedDays((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDays.length) { setError("Select at least one day."); return; }
    setError(""); setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await operatorApi.bulkCreateSchedules(token, {
        bus: parseInt(form.bus_id),
        route: parseInt(form.route_id),
        departure_time: form.departure_time,
        arrival_time: form.arrival_time,
        arrival_next_day: form.arrival_next_day,
        fare: form.fare.trim(),
        date_from: form.date_from,
        date_to: form.date_to,
        days_of_week: selectedDays,
      });
      setResult({
        created: res.created,
        skipped: res.skipped,
        schedule_status: res.schedule_status,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk create failed.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <OperationsGate>
        <div className="py-16 text-center text-slate-500">Loading…</div>
      </OperationsGate>
    );
  }

  if (result) {
    return (
      <OperationsGate>
      <div className="mx-auto max-w-lg py-16 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40 mx-auto">
          <CheckCircle className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Schedules created!</h2>
        <p className="text-slate-600 dark:text-slate-400">
          <strong>{result.created}</strong> schedule{result.created !== 1 ? "s" : ""} created as{" "}
          {result.schedule_status === "ACTIVE" ? (
            <>
              <span className="text-emerald-600 font-medium">ACTIVE</span> (live — your operator is verified with e-GO).
            </>
          ) : (
            <>
              <span className="text-amber-600 font-medium">PENDING</span> (awaiting admin approval until KYC is verified).
            </>
          )}
          {result.skipped > 0 && ` ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""} skipped.`}
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => router.push("/operator/schedules")}>View schedules</Button>
          <Button variant="outline" onClick={() => setResult(null)}>Create more</Button>
        </div>
      </div>
      </OperationsGate>
    );
  }

  return (
    <OperationsGate>
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <Link href="/operator/schedules" className="text-sm text-slate-500 hover:text-indigo-600">
          ← Schedules
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">Bulk create schedules</h1>
        <p className="text-sm text-slate-500 mt-1">Create the same trip for multiple days at once — e.g. every Mon–Fri for 3 months.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trip details</CardTitle>
          <CardDescription>
            All created schedules share the same bus, route, times, and fare. Verified operators get trips live
            immediately; new operators stay pending until admin verifies KYC.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 px-3 py-2.5 text-sm text-red-700 dark:text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{error}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Bus</Label>
                <select
                  value={form.bus_id}
                  onChange={(e) => setForm((f) => ({ ...f, bus_id: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select bus</option>
                  {buses.map((b) => <option key={b.id} value={b.id}>{b.registration_no} ({b.capacity} seats)</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Route</Label>
                <select
                  value={form.route_id}
                  onChange={(e) => setForm((f) => ({ ...f, route_id: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select route</option>
                  {routesList.map((r) => <option key={r.id} value={r.id}>{r.origin} → {r.destination}</option>)}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Departure time</Label>
                <Input type="time" value={form.departure_time} onChange={(e) => setForm((f) => ({ ...f, departure_time: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                <Label>Arrival time</Label>
                <Input type="time" value={form.arrival_time} onChange={(e) => setForm((f) => ({ ...f, arrival_time: e.target.value }))} required />
                <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-1">
                  <input
                    type="checkbox"
                    checked={form.arrival_next_day}
                    onChange={(e) => setForm((f) => ({ ...f, arrival_next_day: e.target.checked }))}
                  />
                  Arrives next day (overnight trip)
                </label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Fare (₹)</Label>
              <Input type="text" inputMode="decimal" value={form.fare} onChange={(e) => setForm((f) => ({ ...f, fare: e.target.value }))} placeholder="500" required />
            </div>

            {/* Date range */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>From date</Label>
                <DatePickerField value={form.date_from} onChange={(v) => setForm((f) => ({ ...f, date_from: v }))} max={form.date_to} />
              </div>
              <div className="space-y-1.5">
                <Label>To date</Label>
                <DatePickerField value={form.date_to} onChange={(v) => setForm((f) => ({ ...f, date_to: v }))} min={form.date_from} />
              </div>
            </div>

            {/* Days of week */}
            <div className="space-y-2">
              <Label>Days of week</Label>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = selectedDays.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleDay(d.id)}
                      className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                        on
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-indigo-600 hover:underline" onClick={() => setSelectedDays([0,1,2,3,4])}>Weekdays</button>
                <span className="text-slate-300">·</span>
                <button type="button" className="text-indigo-600 hover:underline" onClick={() => setSelectedDays([5,6])}>Weekends</button>
                <span className="text-slate-300">·</span>
                <button type="button" className="text-indigo-600 hover:underline" onClick={() => setSelectedDays([0,1,2,3,4,5,6])}>All days</button>
              </div>
            </div>

            {/* Preview */}
            {previewCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 px-4 py-3">
                <Calendar className="h-5 w-5 text-indigo-600 shrink-0" />
                <p className="text-sm text-indigo-800 dark:text-indigo-300">
                  This will create <strong>{previewCount}</strong> schedule{previewCount !== 1 ? "s" : ""} (duplicates on the same bus + time will be skipped).
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={saving || !form.bus_id || !form.route_id || !form.date_from || !form.date_to || !selectedDays.length}
              >
                {saving ? `Creating ${previewCount} schedule${previewCount !== 1 ? "s" : ""}…` : `Create ${previewCount || ""} schedules`}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/operator/schedules")}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
    </OperationsGate>
  );
}
