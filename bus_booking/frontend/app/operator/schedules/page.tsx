"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type Schedule } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function formatDt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Today's date as YYYY-MM-DD in local time */
function todayYMD(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Add calendar days to a YYYY-MM-DD string */
function addDaysYMD(ymd: string, days: number): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

type RangePreset = { label: string; days: number };

const RANGE_PRESETS: RangePreset[] = [
  { label: "3 days", days: 3 },
  { label: "5 days", days: 5 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
  { label: "1 month", days: 31 },
];

export default function OperatorSchedulesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exportDay, setExportDay] = useState(todayYMD());
  const [dayExporting, setDayExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);

  const defaultRange = useMemo(() => {
    const from = todayYMD();
    return { from, to: addDaysYMD(from, 6) };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      setLoading(true);
      try {
        const s = await operatorApi.schedules(token, { date_from: dateFrom, date_to: dateTo });
        if (!cancelled) setSchedules(Array.isArray(s) ? s : []);
      } catch {
        if (!cancelled) router.replace("/operator/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getValidToken, router, dateFrom, dateTo]);

  const applyPresetRange = (numDays: number) => {
    const from = todayYMD();
    setDateFrom(from);
    setDateTo(addDaysYMD(from, Math.max(0, numDays - 1)));
  };

  const downloadDayManifest = async (format: "csv" | "pdf") => {
    const token = await getValidToken();
    if (!token) {
      router.replace("/operator/login");
      return;
    }
    setDayExporting(format);
    setExportErr(null);
    try {
      await operatorApi.downloadManifest(token, { date: exportDay, format });
    } catch (e) {
      setExportErr(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setDayExporting(null);
    }
  };

  const rangeSummary = (
    <span className="text-slate-600 dark:text-slate-400">
      {new Date(dateFrom + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}{" "}
      —{" "}
      {new Date(dateTo + "T12:00:00").toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}
    </span>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Schedules & pricing</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Filter trips by departure date. Use quick ranges or set your own dates.
          </p>
        </div>
        <Button asChild>
          <Link href="/operator/schedules/new">Add schedule</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip dates</CardTitle>
          <CardDescription>
            Only departures between these dates (inclusive) are listed. Default is the next 7 days.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="op-from">From</Label>
              <input
                id="op-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-to">To</Label>
              <input
                id="op-to"
                type="date"
                value={dateTo}
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Quick ranges (from today)</p>
            <div className="flex flex-wrap gap-2">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPresetRange(p.days)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50",
                    "dark:border-slate-600 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40",
                  )}
                >
                  Next {p.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Bookings manifest (by day)</CardTitle>
          <CardDescription>
            Export all bookings for every trip you operate on a single calendar day — PNR, seats, passenger names,
            contact, and payment status. Uses your trips’ departure date (local server date).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="op-manifest-day">Day</Label>
            <input
              id="op-manifest-day"
              type="date"
              value={exportDay}
              onChange={(e) => setExportDay(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!dayExporting}
              onClick={() => downloadDayManifest("csv")}
            >
              {dayExporting === "csv" ? "Preparing…" : "Download CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!dayExporting}
              onClick={() => downloadDayManifest("pdf")}
            >
              {dayExporting === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
          {exportErr ? <p className="w-full text-sm text-amber-800 dark:text-amber-200">{exportErr}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trips in this range</CardTitle>
          <CardDescription>
            {loading ? (
              "Loading…"
            ) : (
              <>
                {schedules.length} schedule{schedules.length !== 1 ? "s" : ""} · {rangeSummary}. Use{" "}
                <strong className="text-slate-700 dark:text-slate-300">Bookings</strong> for manifests, or{" "}
                <strong className="text-slate-700 dark:text-slate-300">Edit pricing &amp; offers</strong> for fares and
                ribbons.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && schedules.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">
              No schedules in this date range. Widen the range or{" "}
              <Link href="/operator/schedules/new" className="text-indigo-600 hover:underline">
                create one
              </Link>
              .
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {schedules.map((s) => {
                const route = s.route as { origin?: string; destination?: string };
                return (
                  <div
                    key={s.id}
                    className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {route.origin} → {route.destination}
                      </p>
                      <p className="text-sm text-slate-500">{formatDt(s.departure_dt)}</p>
                      <p className="text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">₹{s.fare}</span>
                        {s.fare_original && Number(s.fare_original) > Number(s.fare) ? (
                          <span className="ml-2 text-slate-400 line-through">₹{s.fare_original}</span>
                        ) : null}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                            s.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
                          }`}
                        >
                          {s.status}
                        </span>
                        {(s.confirmed_bookings_count ?? 0) > 0 ? (
                          <span className="ml-2 text-xs text-slate-500">
                            {s.confirmed_bookings_count} booking
                            {s.confirmed_bookings_count !== 1 ? "s" : ""} sold
                          </span>
                        ) : null}
                      </p>
                      {s.fare_editable === false ? (
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          Base fare/MRP locked — confirmed passengers already paid. Per-seat and offers can still be
                          edited where allowed.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/operator/schedules/${s.id}/bookings`}>Bookings</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/operator/schedules/${s.id}/edit`}>Edit pricing &amp; offers</Link>
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/operator/track/${s.id}`}>Track</Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/operator/dashboard" className="text-indigo-600 hover:underline">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
