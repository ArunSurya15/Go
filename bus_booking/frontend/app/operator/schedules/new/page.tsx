"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  operatorApi,
  routes as routesApi,
  type OperatorBus,
  type Route,
  type BoardingPointWrite,
  type DroppingPointWrite,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function toLocalISO(dateStr: string, timeStr: string): string {
  if (!dateStr || !timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const d = new Date(dateStr);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toISOString().slice(0, 19);
}

export default function AddSchedulePage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [buses, setBuses] = useState<OperatorBus[]>([]);
  const [routesList, setRoutesList] = useState<Route[]>([]);
  const [form, setForm] = useState({
    bus_id: "",
    route_id: "",
    departure_date: "",
    departure_time: "09:00",
    arrival_date: "",
    arrival_time: "18:00",
    fare: "500",
  });
  const [boardingPoints, setBoardingPoints] = useState<BoardingPointWrite[]>([]);
  const [droppingPoints, setDroppingPoints] = useState<DroppingPointWrite[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      try {
        const [b, r] = await Promise.all([
          operatorApi.buses(token),
          routesApi.list(),
        ]);
        if (!cancelled) {
          setBuses(b);
          setRoutesList(r);
        }
      } catch {
        if (!cancelled) setError("Could not load buses or routes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const token = await getValidToken();
    if (!token) return;
    const busId = parseInt(form.bus_id, 10);
    const routeId = parseInt(form.route_id, 10);
    const departure_dt = toLocalISO(form.departure_date, form.departure_time);
    const arrival_dt = toLocalISO(form.arrival_date, form.arrival_time);
    if (!departure_dt || !arrival_dt) {
      setError("Please set departure and arrival date & time.");
      return;
    }
    setSaving(true);
    try {
      await operatorApi.createSchedule(token, {
        bus: busId,
        route: routeId,
        departure_dt,
        arrival_dt,
        fare: form.fare.trim(),
        boarding_points: boardingPoints.filter((p) => p.location_name.trim()),
        dropping_points: droppingPoints.filter((p) => p.location_name.trim()),
      });
      router.push("/operator/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create schedule.");
    } finally {
      setSaving(false);
    }
  };

  const addBoarding = () =>
    setBoardingPoints((prev) => [...prev, { time: "09:00", location_name: "", landmark: "" }]);
  const addDropping = () =>
    setDroppingPoints((prev) => [...prev, { time: "18:00", location_name: "", description: "" }]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
          <CardTitle>Add schedule</CardTitle>
          <CardDescription>
            Create a new trip: select bus and route, set departure/arrival and fare. New schedules are created as PENDING until approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="bus_id">Bus</Label>
                <select
                  id="bus_id"
                  value={form.bus_id}
                  onChange={(e) => setForm((f) => ({ ...f, bus_id: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select bus</option>
                  {buses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.registration_no} ({b.capacity} seats)
                    </option>
                  ))}
                </select>
                {buses.length === 0 && (
                  <p className="text-xs text-amber-600">
                    <Link href="/operator/buses/new" className="underline">Add a bus</Link> first.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="route_id">Route</Label>
                <select
                  id="route_id"
                  value={form.route_id}
                  onChange={(e) => setForm((f) => ({ ...f, route_id: e.target.value }))}
                  required
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select route</option>
                  {routesList.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.origin} → {r.destination}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="departure_date">Departure date</Label>
                <Input
                  id="departure_date"
                  type="date"
                  value={form.departure_date}
                  onChange={(e) => setForm((f) => ({ ...f, departure_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departure_time">Departure time</Label>
                <Input
                  id="departure_time"
                  type="time"
                  value={form.departure_time}
                  onChange={(e) => setForm((f) => ({ ...f, departure_time: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="arrival_date">Arrival date</Label>
                <Input
                  id="arrival_date"
                  type="date"
                  value={form.arrival_date}
                  onChange={(e) => setForm((f) => ({ ...f, arrival_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="arrival_time">Arrival time</Label>
                <Input
                  id="arrival_time"
                  type="time"
                  value={form.arrival_time}
                  onChange={(e) => setForm((f) => ({ ...f, arrival_time: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fare">Fare (₹)</Label>
              <Input
                id="fare"
                type="text"
                inputMode="decimal"
                value={form.fare}
                onChange={(e) => setForm((f) => ({ ...f, fare: e.target.value }))}
                placeholder="500.00"
                required
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Boarding points (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addBoarding}>
                  + Add
                </Button>
              </div>
              {boardingPoints.map((_, i) => (
                <div key={i} className="flex flex-wrap gap-2 rounded border p-2">
                  <Input
                    type="time"
                    value={boardingPoints[i].time}
                    onChange={(e) =>
                      setBoardingPoints((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], time: e.target.value };
                        return next;
                      })
                    }
                    className="w-24"
                  />
                  <Input
                    placeholder="Location name"
                    value={boardingPoints[i].location_name}
                    onChange={(e) =>
                      setBoardingPoints((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], location_name: e.target.value };
                        return next;
                      })
                    }
                    className="min-w-[140px] flex-1"
                  />
                  <Input
                    placeholder="Landmark"
                    value={boardingPoints[i].landmark ?? ""}
                    onChange={(e) =>
                      setBoardingPoints((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], landmark: e.target.value };
                        return next;
                      })
                    }
                    className="min-w-[120px] flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setBoardingPoints((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Dropping points (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addDropping}>
                  + Add
                </Button>
              </div>
              {droppingPoints.map((_, i) => (
                <div key={i} className="flex flex-wrap gap-2 rounded border p-2">
                  <Input
                    type="time"
                    value={droppingPoints[i].time}
                    onChange={(e) =>
                      setDroppingPoints((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], time: e.target.value };
                        return next;
                      })
                    }
                    className="w-24"
                  />
                  <Input
                    placeholder="Location name"
                    value={droppingPoints[i].location_name}
                    onChange={(e) =>
                      setDroppingPoints((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], location_name: e.target.value };
                        return next;
                      })
                    }
                    className="min-w-[140px] flex-1"
                  />
                  <Input
                    placeholder="Description"
                    value={droppingPoints[i].description ?? ""}
                    onChange={(e) =>
                      setDroppingPoints((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], description: e.target.value };
                        return next;
                      })
                    }
                    className="min-w-[120px] flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDroppingPoints((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={
                  saving ||
                  !form.bus_id ||
                  !form.route_id ||
                  !form.departure_date ||
                  !form.arrival_date ||
                  !form.fare.trim()
                }
              >
                {saving ? "Creating…" : "Create schedule"}
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
