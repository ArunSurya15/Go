"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { OperationsGate } from "@/app/operator/capability-gates";
import { operatorApi, routes, type BusFeatureDef } from "@/lib/api";
import { BUS_FEATURES_FALLBACK } from "@/lib/bus-features";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Bus, Info } from "lucide-react";

export default function EditBusPage() {
  const router = useRouter();
  const params = useParams();
  const busId = Number(params.id);
  const { getValidToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [featureCatalog, setFeatureCatalog] = useState<BusFeatureDef[]>(BUS_FEATURES_FALLBACK);

  const [form, setForm] = useState({
    registration_no: "",
    service_name: "",
    extras_note: "",
  });
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [capacity, setCapacity] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) { router.replace("/operator/login"); return; }
      try {
        const [buses, catalog] = await Promise.all([
          operatorApi.buses(token),
          routes.busFeatures().then((r) => r.features || BUS_FEATURES_FALLBACK).catch(() => BUS_FEATURES_FALLBACK),
        ]);
        if (cancelled) return;
        const bus = buses.find((b) => b.id === busId);
        if (!bus) { setError("Bus not found."); setLoading(false); return; }
        setFeatureCatalog(catalog);
        setForm({
          registration_no: bus.registration_no || "",
          service_name: (bus as { service_name?: string }).service_name || "",
          extras_note: (bus as { extras_note?: string }).extras_note || "",
        });
        setSelectedFeatures((bus.features || []).map((f: { id: string } | string) =>
          typeof f === "string" ? f : f.id
        ));
        setCapacity(bus.capacity);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load bus.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router, busId]);

  const toggleFeature = (id: string) => {
    setSelectedFeatures((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSaved(false); setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      await operatorApi.updateBus(token, busId, {
        registration_no: form.registration_no.trim(),
        features: selectedFeatures,
        extras_note: form.extras_note.trim(),
        ...(form.service_name.trim() ? { service_name: form.service_name.trim() } : {}),
      } as Parameters<typeof operatorApi.updateBus>[2]);
      setSaved(true);
      setTimeout(() => router.push("/operator/buses"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <OperationsGate>
        <div className="flex justify-center py-16"><p className="text-slate-500">Loading bus…</p></div>
      </OperationsGate>
    );
  }

  return (
    <OperationsGate>
    <div className="mx-auto max-w-2xl space-y-6 pb-16">
      <div>
        <Link href="/operator/buses" className="text-sm text-slate-500 hover:text-indigo-600">
          ← All buses
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Edit bus</h1>
        {capacity && (
          <p className="text-sm text-slate-500 mt-1 flex items-center gap-1.5">
            <Bus className="h-4 w-4" /> {capacity} seats · Seat layout is fixed after creation.
          </p>
        )}
      </div>

      {/* Seat layout notice */}
      <div className="flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900 px-4 py-3">
        <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800 dark:text-amber-300">
          The seat layout (rows, columns, type) cannot be changed once bookings may exist.
          To change the layout, create a new bus. You can edit registration, service name, amenities, and notes below.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bus details</CardTitle>
          <CardDescription>Changes take effect immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 px-3 py-2 text-sm text-red-700 dark:text-red-400">{error}</p>
            )}
            {saved && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="h-4 w-4" /> Saved! Redirecting…
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="registration_no">Registration number</Label>
              <Input
                id="registration_no"
                value={form.registration_no}
                onChange={(e) => setForm((f) => ({ ...f, registration_no: e.target.value }))}
                placeholder="e.g. KA01AB1234"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="service_name">Service name (optional)</Label>
              <Input
                id="service_name"
                value={form.service_name}
                onChange={(e) => setForm((f) => ({ ...f, service_name: e.target.value }))}
                placeholder="e.g. Bharat Benz A/C Sleeper (2+1)"
              />
              <p className="text-xs text-slate-500">Shown to passengers in search results.</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Amenities</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {featureCatalog.map((f) => {
                  const on = selectedFeatures.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleFeature(f.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-all",
                        on
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-indigo-300"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]",
                          on ? "border-indigo-500 bg-indigo-500 text-white" : "border-slate-300 dark:border-slate-600"
                        )}>
                          {on ? "✓" : ""}
                        </span>
                        {f.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="extras_note">Extra details (optional)</Label>
              <textarea
                id="extras_note"
                value={form.extras_note}
                onChange={(e) => setForm((f) => ({ ...f, extras_note: e.target.value }))}
                placeholder="e.g. Pillow on request, veg meals at halt…"
                maxLength={500}
                rows={3}
                className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-y min-h-[80px] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-slate-500">{form.extras_note.length}/500</p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={saving || !form.registration_no.trim()}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.push("/operator/buses")}>
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
