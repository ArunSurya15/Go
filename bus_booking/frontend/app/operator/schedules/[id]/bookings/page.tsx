"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorManifestBooking, type Schedule } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function formatDt(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
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

function passengerSummary(b: OperatorManifestBooking): string {
  const parts = b.passengers
    .filter((p) => p.name || p.seat)
    .map((p) => (p.name ? `${p.name}${p.seat ? ` (${p.seat})` : ""}` : p.seat));
  if (parts.length) return parts.join(", ");
  return b.seats?.length ? b.seats.join(", ") : "—";
}

export default function OperatorScheduleBookingsPage() {
  const params = useParams();
  const router = useRouter();
  const idRaw = params.id;
  const scheduleId = typeof idRaw === "string" ? Number(idRaw) : Array.isArray(idRaw) ? Number(idRaw[0]) : NaN;
  const { getValidToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [rows, setRows] = useState<OperatorManifestBooking[]>([]);
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(scheduleId)) {
      setErr("Invalid schedule.");
      setLoading(false);
      return;
    }
    const token = await getValidToken();
    if (!token) {
      router.replace("/operator/login");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const [s, list] = await Promise.all([
        operatorApi.getSchedule(token, scheduleId),
        operatorApi.scheduleBookings(token, scheduleId),
      ]);
      setSchedule(s);
      setRows(Array.isArray(list) ? list : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not load bookings.";
      setErr(msg);
      setSchedule(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [getValidToken, router, scheduleId]);

  useEffect(() => {
    load();
  }, [load]);

  const doExport = async (format: "csv" | "pdf") => {
    if (!Number.isFinite(scheduleId)) return;
    const token = await getValidToken();
    if (!token) {
      router.replace("/operator/login");
      return;
    }
    setExporting(format);
    setErr(null);
    try {
      await operatorApi.downloadManifest(token, { schedule_id: scheduleId, format });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  };

  const route = schedule?.route as { origin?: string; destination?: string } | undefined;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <Link
          href="/operator/schedules"
          className="text-sm text-slate-600 hover:text-indigo-600 dark:text-slate-400"
        >
          ← All schedules
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Bookings & manifest</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          {route ? (
            <>
              {route.origin} → {route.destination}
              {schedule ? (
                <>
                  {" "}
                  · {formatDt(schedule.departure_dt)}
                </>
              ) : null}
            </>
          ) : loading ? (
            "Loading trip…"
          ) : (
            "Trip"
          )}
        </p>
        {schedule ? (
          <p className="mt-2">
            <Link
              href={`/operator/schedules/${schedule.id}/edit`}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Edit pricing & offers
            </Link>
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Export this trip</CardTitle>
            <CardDescription>Download the same columns as the table below (one row per passenger seat).</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!exporting || loading}
              onClick={() => doExport("csv")}
            >
              {exporting === "csv" ? "Preparing…" : "CSV"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!!exporting || loading}
              onClick={() => doExport("pdf")}
            >
              {exporting === "pdf" ? "Preparing…" : "PDF"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {err ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {err}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Passenger list</CardTitle>
          <CardDescription>
            {loading
              ? "Loading…"
              : `${rows.length} booking${rows.length !== 1 ? "s" : ""} on this schedule.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="px-6 pb-6 text-sm text-slate-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">No bookings yet for this trip.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                    <th className="px-4 py-3">PNR</th>
                    <th className="px-4 py-3">Seats</th>
                    <th className="px-4 py-3">Passengers</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Booker</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {rows.map((b) => (
                    <tr key={b.id} className="align-top">
                      <td className="px-4 py-3 font-mono text-xs text-slate-900 dark:text-slate-100">{b.pnr}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {b.seats?.length ? b.seats.join(", ") : "—"}
                      </td>
                      <td className="max-w-[240px] px-4 py-3 text-slate-700 dark:text-slate-300">
                        {passengerSummary(b)}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {b.contact_phone || "—"}
                        {b.boarding_point_name ? (
                          <span className="mt-1 block text-xs text-slate-500">
                            Board: {b.boarding_point_name}
                          </span>
                        ) : null}
                      </td>
                      <td className="max-w-[200px] px-4 py-3 text-slate-700 dark:text-slate-300">
                        {b.booker_email || "—"}
                        {b.booker_phone ? (
                          <span className="mt-1 block text-xs text-slate-500">{b.booker_phone}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                        {b.payment_status || "—"}
                        {b.gateway_order_id ? (
                          <span className="mt-1 block font-mono text-xs text-slate-500">{b.gateway_order_id}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">₹{b.amount}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            b.status === "CONFIRMED"
                              ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                              : "rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          }
                        >
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/operator/dashboard" className="text-indigo-600 hover:underline">
          ← Dashboard
        </Link>
      </p>
    </div>
  );
}
