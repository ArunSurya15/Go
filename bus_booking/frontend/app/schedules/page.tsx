"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { routes, type Schedule } from "@/lib/api";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function duration(dep: string, arr: string) {
  const ms = new Date(arr).getTime() - new Date(dep).getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function SchedulesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const routeId = searchParams.get("route_id");
  const date = searchParams.get("date");
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeId || !date) {
      setError("Missing route or date.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    console.log(`Fetching schedules: route_id=${routeId}, date=${date}`);
    routes.schedules(Number(routeId), date)
      .then((s) => {
        console.log(`Received ${s.length} schedules:`, s);
        setSchedules(s);
        if (s.length === 0) {
          setError(`No buses found for ${from} → ${to} on ${date}. Make sure you've run: python manage.py seed_test_data`);
        }
      })
      .catch((err) => {
        console.error("Schedules API error:", err);
        setError(err instanceof Error ? err.message : "Failed to load schedules. Check console for details.");
      })
      .finally(() => setLoading(false));
  }, [routeId, date, from, to]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">Loading buses…</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Header bar: From, To, Date, Search (redBus-style) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-wrap items-center gap-3 mb-6 p-3 bg-card rounded-lg border"
      >
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">From</span>
          <span className="font-semibold">{from || "—"}</span>
        </div>
        <span className="text-muted-foreground">→</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">To</span>
          <span className="font-semibold">{to || "—"}</span>
        </div>
        <div className="flex items-center gap-2 text-sm ml-auto">
          <span className="text-muted-foreground">Date</span>
          <span className="font-medium">{date}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => router.push("/")}
        >
          Change search
        </Button>
      </motion.div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 mb-4">
          <p className="text-red-800 font-medium">Error</p>
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && schedules.length === 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 px-4 py-3 mb-4">
          <p className="text-yellow-800 font-medium">No buses found</p>
          <p className="text-yellow-700 text-sm">
            No buses available for {from} → {to} on {date}. Try a different date or route.
          </p>
          <p className="text-yellow-600 text-xs mt-2">
            Debug: route_id={routeId}, date={date}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <AnimatePresence mode="wait">
          {schedules.length === 0 && !loading ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground text-center py-12"
            >
              No buses found for this date.
            </motion.p>
          ) : (
            schedules.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Card className="overflow-hidden border rounded-xl hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 p-4 sm:p-5">
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-semibold text-foreground">
                          {s.bus.operator_name || "Bus"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          A/C Sleeper ({s.bus.capacity} seats)
                        </p>
                        <div className="flex flex-wrap items-baseline gap-2 text-sm mt-2">
                          <span className="font-mono font-medium">{formatTime(s.departure_dt)}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono font-medium">{formatTime(s.arrival_dt)}</span>
                          <span className="text-muted-foreground text-xs">
                            {duration(s.departure_dt, s.arrival_dt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex sm:flex-col sm:items-end justify-between sm:justify-center gap-3">
                        <div className="text-right">
                          <p className="text-xl font-bold text-foreground">₹{s.fare}</p>
                          <p className="text-xs text-muted-foreground">Onwards</p>
                        </div>
                        <Button asChild className="shrink-0 bg-red-600 hover:bg-red-700">
                          <Link
                            href={`/book/select-seats?schedule_id=${s.id}&date=${date}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&fare=${s.fare}`}
                          >
                            View seats
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
