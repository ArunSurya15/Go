"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { OperationsGate } from "@/app/operator/capability-gates";
import { operatorApi, type OperatorSalesResponse } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { ClipboardList, IndianRupee, Sparkles, Ticket } from "lucide-react";
import { cn } from "@/lib/utils";

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

function monthStartYMD(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-01`;
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

function KpiTile({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  accent: "indigo" | "emerald" | "violet";
}) {
  const ring =
    accent === "emerald"
      ? "from-emerald-400 to-teal-400"
      : accent === "violet"
        ? "from-violet-400 to-fuchsia-400"
        : "from-indigo-400 to-sky-400";
  const iconBg =
    accent === "emerald"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : accent === "violet"
        ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300"
        : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm ring-1 ring-slate-200/40 dark:border-slate-800 dark:bg-slate-900/85 dark:ring-slate-800/50">
      <div className={cn("absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-90", ring)} aria-hidden />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", iconBg)}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
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
  const to = todayYMD();

  const applyPreset = (days: number | "month") => {
    if (days === "month") {
      setDateFrom(monthStartYMD());
      setDateTo(to);
      return;
    }
    setDateFrom(addDaysYMD(to, -days));
    setDateTo(to);
  };

  return (
    <OperationsGate>
    <div className="mx-auto max-w-5xl space-y-6 pb-16">
      <div>
        <Link
          href="/operator/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400"
        >
          ← Dashboard
        </Link>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" aria-hidden />
          Revenue
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Sales</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          Confirmed revenue by <strong className="font-medium text-slate-700 dark:text-slate-300">sale date</strong> (when
          payment was confirmed). Summary counts <strong className="font-medium text-slate-700 dark:text-slate-300">active</strong>{" "}
          lines only. Raw export lives in Django admin → Operator sales.
        </p>
      </div>

      <Card className="rounded-2xl border-slate-200/80 bg-white/90 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
        <CardHeader className="space-y-0 pb-2 pt-4 px-4 sm:px-5">
          <CardTitle className="text-base font-semibold">Filters</CardTitle>
          <CardDescription className="text-xs">Adjust range and presets reload the table automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:px-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label htmlFor="sales-from" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  From
                </Label>
                <DatePickerField id="sales-from" value={dateFrom} onChange={setDateFrom} max={dateTo} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sales-to" className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  To
                </Label>
                <DatePickerField id="sales-to" value={dateTo} onChange={setDateTo} min={dateFrom} />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100/90 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:bg-slate-800/80 lg:ml-0">
              <input
                type="checkbox"
                checked={activeOnly}
                onChange={(e) => setActiveOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:border-slate-600"
              />
              <span className="leading-snug">Hide refunded / cancelled in the table</span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quick</span>
            {(
              [
                { label: "7 days", fn: () => applyPreset(7) },
                { label: "30 days", fn: () => applyPreset(30) },
                { label: "This month", fn: () => applyPreset("month") },
              ] as const
            ).map((p) => (
              <Button
                key={p.label}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/80 hover:text-indigo-800 dark:border-slate-600 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950/40"
                onClick={p.fn}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {err ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          {err}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile
          label="Active bookings"
          value={loading ? "…" : String(summary?.active_booking_count ?? "—")}
          icon={ClipboardList}
          accent="indigo"
        />
        <KpiTile
          label="Gross (₹)"
          value={loading ? "…" : summary ? `₹${summary.gross_amount}` : "—"}
          icon={IndianRupee}
          accent="emerald"
        />
        <KpiTile
          label="Seats sold"
          value={loading ? "…" : String(summary?.seat_count ?? "—")}
          icon={Ticket}
          accent="violet"
        />
      </div>

      <Card className="overflow-hidden rounded-2xl border-slate-200/80 bg-white/90 shadow-sm ring-1 ring-slate-200/50 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:ring-slate-800/60">
        <CardHeader className="border-b border-slate-100 py-3 dark:border-slate-800 sm:px-5">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between">
            <CardTitle className="text-base font-semibold">Sale lines</CardTitle>
            <CardDescription className="text-xs sm:text-right">
              {loading ? "Loading…" : `${data?.results.length ?? 0} row${(data?.results.length ?? 0) === 1 ? "" : "s"} in range`}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!loading && data && data.results.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <Ticket className="mx-auto mb-2 h-8 w-8 text-slate-200 dark:text-slate-700" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No sales in this range.</p>
            </div>
          ) : !loading && data ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/95 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                    <th className="px-3 py-2 sm:px-4">PNR</th>
                    <th className="px-3 py-2 sm:px-4">Route</th>
                    <th className="px-3 py-2 sm:px-4">Departure</th>
                    <th className="px-3 py-2 sm:px-4">Confirmed</th>
                    <th className="px-3 py-2 text-right sm:px-4">Amount</th>
                    <th className="px-3 py-2 text-right sm:px-4">Seats</th>
                    <th className="px-3 py-2 sm:px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data.results.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-slate-600 dark:text-slate-400 sm:px-4 sm:text-xs">
                        {r.pnr}
                      </td>
                      <td className="max-w-[10rem] px-3 py-2 text-slate-800 dark:text-slate-200 sm:max-w-none sm:px-4">
                        <span className="line-clamp-2 font-medium leading-snug">
                          {r.origin} → {r.destination}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400 sm:px-4">
                        {formatDt(r.departure_dt)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400 sm:px-4">
                        {formatDt(r.confirmed_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-100 sm:px-4">
                        ₹{r.gross_amount}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-300 sm:px-4">
                        {r.seat_count}
                      </td>
                      <td className="px-3 py-2 sm:px-4">
                        {r.reversal_status ? (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                            {r.reversal_status}
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
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
            <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600 dark:border-indigo-900 dark:border-t-indigo-400" />
              Loading…
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Link
          href="/operator/schedules"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300 dark:hover:bg-slate-800"
        >
          Schedules &amp; manifests
        </Link>
      </div>
    </div>
    </OperationsGate>
  );
}
