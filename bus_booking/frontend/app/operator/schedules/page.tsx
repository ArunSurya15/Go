"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { operatorApi, type Schedule } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

export default function OperatorSchedulesPage() {
  const router = useRouter();
  const { getValidToken } = useAuth();
  const [loading, setLoading] = useState(true);
  const [schedules, setSchedules] = useState<Schedule[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getValidToken();
      if (!token) {
        router.replace("/operator/login");
        return;
      }
      try {
        const s = await operatorApi.schedules(token);
        if (!cancelled) setSchedules(Array.isArray(s) ? s : []);
      } catch {
        router.replace("/operator/login");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getValidToken, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <p className="text-slate-500">Loading schedules…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Schedules & pricing</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Update fares and offers for trips that don&apos;t have confirmed bookings yet.
          </p>
        </div>
        <Button asChild>
          <Link href="/operator/schedules/new">Add schedule</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All trips</CardTitle>
          <CardDescription>
            {schedules.length} schedule{schedules.length !== 1 ? "s" : ""}. Use{" "}
            <strong className="text-slate-700 dark:text-slate-300">Edit pricing</strong> to change fare,
            discounts, and how offers appear to passengers.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {schedules.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-slate-500">
              No schedules yet.{" "}
              <Link href="/operator/schedules/new" className="text-indigo-600 hover:underline">
                Create one
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
                          Fare/MRP locked — confirmed passengers already paid. You can still edit offer display.
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
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
