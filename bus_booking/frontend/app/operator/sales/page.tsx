"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type OperatorSalesResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

function todayYMD(): string {
  const t = new Date();
  const y = t.getFullYear();
  const m = String(t.getMonth() + 1).padStart(2, "0");
  const d = String(t.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysYMD(ymd: string, days: number): string {
  const [y, mo, da] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, da);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function formatDt(iso: string) {
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

export default function OperatorSalesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const defaultRange = useMemo(() => {
    const from = addDaysYMD(todayYMD(), -30);
    const to = todayYMD();
    return { from, to };
  }, []);

  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [activeOnly, setActiveOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OperatorSalesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      setLoading(true);
      setErr(null);
      try {
        const res = await operatorApi.sales(token, {
          date_from: dateFrom,
          date_to: dateTo,
          active_only: activeOnly,
        });
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "Could not load sales.");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getValidToken, router, dateFrom, dateTo, activeOnly]);

  const summary = data?.summary;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <Link
          href="/operator/dashboard"
          className="text-sm text-slate-600 hover:text-indigo-600 dark:text-slate-400"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">Sales</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Confirmed booking revenue by sale date. Totals below include only <strong>active</strong> sales (not
          refunded or cancelled). Staff can also open <strong>Operator sales</strong> in Django admin for raw rows.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Filter by when the payment was confirmed (sale date).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="sales-from">From</Label>
            <input
              id="sales-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sales-to">To</Label>
            <input
              id="sales-to"
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => setDateTo(e.target.value)}
              className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-slate-300"
            />
            Hide refunded / cancelled rows
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => setDateFrom(addDaysYMD(todayYMD(), -7))}>
            Last 7 days
          </Button>
        </CardContent>
      </Card>

      {err ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {err}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active bookings (in range)</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? "…" : summary?.active_booking_count ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross (active, ₹)</CardDescription>
            <CardTitle className="text-2xl">
              {loading ? "…" : summary ? `₹${summary.gross_amount}` : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Seats sold (active)</CardDescription>
            <CardTitle className="text-2xl">{loading ? "…" : summary?.seat_count ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sale lines</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${data?.results.length ?? 0} row(s).`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && data && data.results.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">No sales in this range.</p>
          ) : !loading && data ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
                    <th className="px-4 py-3">PNR</th>
                    <th className="px-4 py-3">Route</th>
                    <th className="px-4 py-3">Departure</th>
                    <th className="px-4 py-3">Confirmed</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Seats</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.results.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs">{r.pnr}</td>
                      <td className="px-4 py-3">
                        {r.origin} → {r.destination}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatDt(r.departure_dt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                        {formatDt(r.confirmed_at)}
                      </td>
                      <td className="px-4 py-3">₹{r.gross_amount}</td>
                      <td className="px-4 py-3">{r.seat_count}</td>
                      <td className="px-4 py-3">
                        {r.reversal_status ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                            {r.reversal_status}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-6 pb-6 text-sm text-slate-500">Loading…</p>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-slate-500">
        <Link href="/operator/schedules" className="text-indigo-600 hover:underline">
          Schedules &amp; manifests
        </Link>
      </p>
    </div>
  );
}
