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
import { Copy, Archive, ArchiveRestore, LayoutList, X, CheckCircle } from "lucide-react";

function formatDt(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
}

function todayYMD(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function addDaysYMD(ymd: string, days: number): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

const RANGE_PRESETS = [
  { label: "3 days", days: 3 }, { label: "7 days", days: 7 },
  { label: "14 days", days: 14 }, { label: "30 days", days: 30 },
];

/** Small modal for picking a duplicate date */
function DuplicateModal({
  schedule,
  onClose,
  onDone,
}: {
  schedule: Schedule;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const { getValidToken } = useAuth();
  const [date, setDate] = useState(todayYMD());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const route = schedule.route as { origin?: string; destination?: string };

  const handle = async () => {
    setError(""); setSaving(true);
    const token = await getValidToken();
    if (!token) return;
    try {
      const res = await operatorApi.duplicateSchedule(token, schedule.id, date);
      onDone(res.message || `Duplicated to ${date}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100">Duplicate schedule</h3>
            <p className="text-sm text-slate-500 mt-0.5">{route.origin} → {route.destination}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 rounded-lg p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dup-date">New departure date</Label>
          <input
            id="dup-date"
            type="date"
            value={date}
            min={todayYMD()}
            onChange={(e) => setDate(e.target.value)}
            className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-slate-500">Arrival is shifted by the same number of days. New schedule starts as PENDING.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2 pt-1">
          <Button onClick={handle} disabled={saving || !date} className="flex-1">
            {saving ? "Duplicating…" : "Duplicate"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

export default function OperatorSchedulesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [exportDay, setExportDay] = useState(todayYMD());
  const [dayExporting, setDayExporting] = useState<"csv" | "pdf" | null>(null);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<Schedule | null>(null);
  const [archivingId, setArchivingId] = useState<number | null>(null);

  const defaultRange = useMemo(() => {
    const from = todayYMD();
    return { from, to: addDaysYMD(from, 6) };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);

  const loadSchedules = async () => {
    const token = await getValidToken();
    if (!token) { router.replace("/operator/login"); return; }
    setLoading(true);
    try {
      const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
      if (showArchived) params.show_archived = "1";
      const s = await operatorApi.schedules(token, params);
      setSchedules(Array.isArray(s) ? s : []);
    } catch {
      router.replace("/operator/login");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) { router.replace("/operator/login"); return; }
      setLoading(true);
      try {
        const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo };
        if (showArchived) params.show_archived = "1";
        const s = await operatorApi.schedules(token, params);
        if (!cancelled) setSchedules(Array.isArray(s) ? s : []);
      } catch {
        if (!cancelled) router.replace("/operator/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [getValidToken, router, dateFrom, dateTo, showArchived]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleArchive = async (schedule: Schedule) => {
    const newArchived = !(schedule as Schedule & { archived?: boolean }).archived;
    setArchivingId(schedule.id);
    const token = await getValidToken();
    if (!token) return;
    try {
      await operatorApi.archiveSchedule(token, schedule.id, newArchived);
      setSchedules((prev) =>
        prev.map((s) => s.id === schedule.id ? { ...s, archived: newArchived } as Schedule : s)
      );
      showToast(newArchived ? "Schedule archived." : "Schedule restored.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed.");
    } finally {
      setArchivingId(null);
    }
  };

  const applyPresetRange = (numDays: number) => {
    const from = todayYMD();
    setDateFrom(from);
    setDateTo(addDaysYMD(from, Math.max(0, numDays - 1)));
  };

  const downloadDayManifest = async (format: "csv" | "pdf") => {
    const token = await getValidToken();
    if (!token) { router.replace("/operator/login"); return; }
    setDayExporting(format); setExportErr(null);
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
      {new Date(dateFrom + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
      {" — "}
      {new Date(dateTo + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
    </span>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-4 py-3 shadow-xl text-sm font-medium">
          <CheckCircle className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />{toast}
        </div>
      )}

      {/* Duplicate modal */}
      {duplicateTarget && (
        <DuplicateModal
          schedule={duplicateTarget}
          onClose={() => setDuplicateTarget(null)}
          onDone={(msg) => {
            setDuplicateTarget(null);
            showToast(msg);
            loadSchedules();
          }}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Schedules &amp; pricing</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">Filter trips by departure date. Duplicate, bulk-create, or archive schedules.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/operator/schedules/bulk-new">
              <LayoutList className="h-4 w-4 mr-1.5" />Bulk create
            </Link>
          </Button>
          <Button asChild>
            <Link href="/operator/schedules/new">Add schedule</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Trip dates</CardTitle>
          <CardDescription>Only departures between these dates are listed. Default: next 7 days.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="op-from">From</Label>
              <input id="op-from" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="op-to">To</Label>
              <input id="op-to" type="date" value={dateTo} min={dateFrom} onChange={(e) => setDateTo(e.target.value)}
                className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 cursor-pointer pb-1">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="rounded" />
              Show archived
            </label>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Quick ranges</p>
            <div className="flex flex-wrap gap-2">
              {RANGE_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => applyPresetRange(p.days)}
                  className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50",
                    "dark:border-slate-600 dark:bg-slate-900 dark:hover:border-indigo-500 dark:hover:bg-indigo-950/40")}>
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
          <CardDescription>Export all bookings for every trip on a single day.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="op-manifest-day">Day</Label>
            <input id="op-manifest-day" type="date" value={exportDay} onChange={(e) => setExportDay(e.target.value)}
              className="flex h-10 rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!!dayExporting} onClick={() => downloadDayManifest("csv")}>
              {dayExporting === "csv" ? "Preparing…" : "Download CSV"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!!dayExporting} onClick={() => downloadDayManifest("pdf")}>
              {dayExporting === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
          {exportErr && <p className="w-full text-sm text-amber-800 dark:text-amber-200">{exportErr}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trips in this range</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : (
              <>{schedules.length} schedule{schedules.length !== 1 ? "s" : ""} · {rangeSummary}</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && schedules.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">
              No schedules in this range.{" "}
              <Link href="/operator/schedules/new" className="text-indigo-600 hover:underline">Create one</Link> or{" "}
              <Link href="/operator/schedules/bulk-new" className="text-indigo-600 hover:underline">bulk-create</Link>.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {schedules.map((s) => {
                const route = s.route as { origin?: string; destination?: string };
                const isArchived = (s as Schedule & { archived?: boolean }).archived;
                return (
                  <div key={s.id} className={cn("px-6 py-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", isArchived && "opacity-60")}>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-slate-900 dark:text-slate-100">
                          {route.origin} → {route.destination}
                        </p>
                        {isArchived && (
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500">Archived</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500">{formatDt(s.departure_dt)}</p>
                      <p className="text-sm">
                        <span className="font-semibold text-slate-800 dark:text-slate-200">₹{s.fare}</span>
                        {s.fare_original && Number(s.fare_original) > Number(s.fare) && (
                          <span className="ml-2 text-slate-400 line-through">₹{s.fare_original}</span>
                        )}
                        <span className={cn("ml-2 rounded-full px-2 py-0.5 text-xs",
                          s.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200")}>
                          {s.status}
                        </span>
                        {(s.confirmed_bookings_count ?? 0) > 0 && (
                          <span className="ml-2 text-xs text-slate-500">
                            {s.confirmed_bookings_count} booking{s.confirmed_bookings_count !== 1 ? "s" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 items-center">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/operator/schedules/${s.id}/bookings`}>Bookings</Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/operator/schedules/${s.id}/edit`}>Edit</Link>
                      </Button>
                      <button
                        type="button"
                        title="Duplicate to another date"
                        onClick={() => setDuplicateTarget(s)}
                        className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50 transition-colors"
                      >
                        <Copy className="h-3.5 w-3.5" />Duplicate
                      </button>
                      <button
                        type="button"
                        title={isArchived ? "Restore schedule" : "Archive schedule"}
                        disabled={archivingId === s.id}
                        onClick={() => handleArchive(s)}
                        className={cn(
                          "flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
                          isArchived
                            ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                            : "border-slate-200 dark:border-slate-700 text-slate-500 hover:border-amber-300 hover:text-amber-700 hover:bg-amber-50 dark:hover:border-amber-700 dark:hover:text-amber-400"
                        )}
                      >
                        {archivingId === s.id ? "…" : isArchived ? (
                          <><ArchiveRestore className="h-3.5 w-3.5" />Restore</>
                        ) : (
                          <><Archive className="h-3.5 w-3.5" />Archive</>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/operator/dashboard" className="text-indigo-600 hover:underline">← Back to dashboard</Link>
      </p>
    </div>
  );
}
